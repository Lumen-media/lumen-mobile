import Constants from "expo-constants";
import { AppState, Platform, type AppStateStatus } from "react-native";

import {
  DEFAULT_PERMISSIONS,
  type AuthOk,
  type Permissions,
  type ServerMessage,
} from "@/src/core/protocol";
import {
  getOrCreateDeviceId,
  getLastConnected,
  removePaired,
  savePaired,
  touchPaired,
  type PairedDevice,
} from "@/src/core/secure/devices";

import { onServerMessage } from "./bus";
import { LumenSocket } from "./socket";
import {
  resetConnection,
  setConnection,
  useConnectionStore,
} from "./store";

const BACKOFF_MS = [500, 1000, 2000, 4000, 8000, 10000];
const AUTH_TIMEOUT_MS = 8000;
const TERMINAL_CLOSE_CODES: Record<number, "denied" | "expired"> = {
  4001: "denied",
  4003: "expired",
  4004: "expired",
  4005: "expired",
};

type Desired =
  | { mode: "auth"; device: PairedDevice }
  | { mode: "register"; host: string; port: number; token: string };

function normalizePermissions(raw: Record<string, boolean>): Permissions {
  return { ...DEFAULT_PERMISSIONS, ...raw };
}

function deviceName(): string {
  return Constants.deviceName ?? "Lumen Remote";
}

function appVersion(): string {
  return Constants.expoConfig?.version ?? "1.0.0";
}

/**
 * Owns the WS lifecycle: auto-connect to the last desktop, QR registration,
 * exponential-backoff reconnect, suspend/resume with AppState and terminal
 * close-code handling (4001–4005).
 */
class ConnectionManager {
  private socket: LumenSocket | null = null;
  private desired: Desired | null = null;
  private attempt = 0;
  private suspended = false;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private authTimer: ReturnType<typeof setTimeout> | null = null;
  private unsubscribe: (() => void) | null = null;
  private appStateSubscription: { remove: () => void } | null = null;
  private initialized = false;

  init(): void {
    if (this.initialized) return;
    this.initialized = true;
    this.unsubscribe = onServerMessage((message) => this.handleMessage(message));
    this.appStateSubscription = AppState.addEventListener("change", (state) =>
      this.handleAppState(state),
    );
  }

  /** Launch flow: connect to the most recently used desktop, if any. */
  async autoConnect(): Promise<void> {
    this.init();
    const device = await getLastConnected();
    if (!device) {
      setConnection({ status: "idle", autoConnecting: false });
      return;
    }
    setConnection({
      status: "connecting",
      autoConnecting: true,
      error: null,
      endpoint: { host: device.host, port: device.port },
      desktopName: device.desktopName,
    });
    this.desired = { mode: "auth", device };
    this.attempt = 0;
    await this.open();
  }

  /** Connect to a specific paired desktop (list tap). */
  async connectTo(device: PairedDevice): Promise<void> {
    this.init();
    setConnection({
      status: "connecting",
      autoConnecting: false,
      error: null,
      endpoint: { host: device.host, port: device.port },
      desktopName: device.desktopName,
    });
    this.desired = { mode: "auth", device };
    this.attempt = 0;
    await this.open();
  }

  /** One-time QR registration: obtains and stores the access token. */
  async pair(host: string, port: number, token: string): Promise<void> {
    this.init();
    setConnection({
      status: "registering",
      autoConnecting: false,
      error: null,
      endpoint: { host, port },
      desktopName: null,
    });
    this.desired = { mode: "register", host, port, token };
    this.attempt = 0;
    await this.open();
  }

  /** Asks the desktop to deactivate this device, then clears local state. */
  forget(): void {
    const current = useConnectionStore.getState().endpoint;
    const desired = this.desired;
    this.socket?.send({ event: "forget_device" });
    this.desired = null;
    if (desired?.mode === "auth" && current) {
      void removePaired(desired.device.key);
    }
    resetConnection();
    this.teardownSocket();
  }

  disconnect(): void {
    this.desired = null;
    this.attempt = 0;
    this.clearTimers();
    this.teardownSocket();
    resetConnection();
  }

  /** Fire-and-forget event. No-op when there is no live socket. */
  send(event: Parameters<LumenSocket["send"]>[0]): void {
    this.socket?.send(event);
  }

  /** Event with `request_id`; rejects when socket is down or ack times out. */
  request(event: Parameters<LumenSocket["request"]>[0]): Promise<ServerMessage> {
    const socket = this.socket;
    if (!socket || !socket.isOpen) {
      return Promise.reject(new Error("not_connected"));
    }
    return socket.request(event);
  }

  private async open(): Promise<void> {
    this.clearAuthTimer();
    this.teardownSocket();

    const desired = this.desired;
    if (!desired) return;

    const host = desired.mode === "auth" ? desired.device.host : desired.host;
    const port = desired.mode === "auth" ? desired.device.port : desired.port;

    const socket = new LumenSocket();
    socket.onClose = (code) => this.handleClose(code);
    this.socket = socket;

    try {
      await socket.connect(`ws://${host}:${port}`);
    } catch {
      this.scheduleReconnect();
      return;
    }

    if (this.desired !== desired) return; // superseded while connecting

    if (desired.mode === "register") {
      socket.send({
        event: "register",
        token: desired.token,
        device_id: await getOrCreateDeviceId(),
        device_name: deviceName(),
        device_type: "mobile",
        os: Platform.OS,
        version: appVersion(),
      });
    } else {
      socket.send({
        event: "auth",
        device_id: desired.device.deviceId,
        access_token: desired.device.accessToken,
      });
    }

    this.authTimer = setTimeout(() => {
      const status = useConnectionStore.getState().status;
      if (status !== "connected") this.scheduleReconnect();
    }, AUTH_TIMEOUT_MS);
  }

  private handleMessage(message: ServerMessage): void {
    if (message.event === "auth_ok") {
      void this.handleAuthOk(message);
    } else if (message.event === "auth_fail") {
      this.handleAuthFail(message.reason);
    } else if (message.event === "device_deactivated") {
      this.desired = null;
      this.teardownSocket();
      setConnection({ status: "expired", error: "device_deactivated" });
    }
  }

  private async handleAuthOk(message: AuthOk): Promise<void> {
    this.clearAuthTimer();
    this.attempt = 0;

    setConnection({
      status: "connected",
      desktopName: message.desktop_name,
      permissions: normalizePermissions(message.permissions),
      error: null,
      autoConnecting: false,
    });

    const desired = this.desired;
    if (desired?.mode === "register") {
      await savePaired({
        key: message.desktop_name,
        desktopName: message.desktop_name,
        host: desired.host,
        port: desired.port,
        deviceId: await getOrCreateDeviceId(),
        accessToken: message.access_token,
      });
    } else if (desired?.mode === "auth") {
      await touchPaired(desired.device.key, desired.device.host, desired.device.port);
    }

    // Pull player/queue/presentation state right after the session opens
    // (pending on desktop; unknown events are ignored server-side).
    this.socket?.send({ event: "sync_request" });
  }

  private handleAuthFail(reason: string): void {
    this.clearAuthTimer();
    const status = reason === "unauthorized" ? "denied" : "expired";
    this.desired = null;
    setConnection({ status, error: reason, autoConnecting: false });
  }

  private handleClose(code: number): void {
    this.socket = null;
    if (this.suspended || !this.desired) return;

    const current = useConnectionStore.getState().status;
    if (current === "denied" || current === "expired") return;

    const terminal = TERMINAL_CLOSE_CODES[code];
    if (terminal) {
      this.desired = null;
      setConnection({ status: terminal, error: `close_${code}`, autoConnecting: false });
      return;
    }
    this.scheduleReconnect();
  }

  private scheduleReconnect(): void {
    if (!this.desired || this.suspended) return;
    const delay = BACKOFF_MS[Math.min(this.attempt, BACKOFF_MS.length - 1)];
    this.attempt += 1;
    setConnection({ status: "reconnecting", autoConnecting: false });
    this.reconnectTimer = setTimeout(() => {
      void this.open();
    }, delay);
  }

  private handleAppState(state: AppStateStatus): void {
    if (state === "background") {
      this.suspended = true;
      this.clearTimers();
      this.teardownSocket();
    } else if (state === "active" && this.suspended) {
      this.suspended = false;
      if (this.desired) {
        setConnection({ status: "reconnecting" });
        void this.open();
      }
    }
  }

  private teardownSocket(): void {
    if (this.socket) {
      this.socket.close();
      this.socket = null;
    }
  }

  private clearAuthTimer(): void {
    if (this.authTimer) {
      clearTimeout(this.authTimer);
      this.authTimer = null;
    }
  }

  private clearTimers(): void {
    this.clearAuthTimer();
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }
}

export const connection = new ConnectionManager();
