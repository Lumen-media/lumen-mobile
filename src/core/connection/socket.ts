import { type ClientEvent, parseServerMessage, type ServerMessage } from '@/src/core/protocol';

import { emitServerMessage } from './bus';

const ACK_EVENTS = new Set([
  'queue_op_ok',
  'queue_op_fail',
  'presentation_op_ok',
  'presentation_op_fail',
  'chat_error',
]);

type Pending = {
  resolve: (message: ServerMessage) => void;
  reject: (error: Error) => void;
  timer: ReturnType<typeof setTimeout>;
};

const DEFAULT_ACK_TIMEOUT_MS = 5000;

/**
 * Thin WebSocket wrapper: JSON frames in, Zod-parsed messages out.
 *
 * - `send` for fire-and-forget events
 * - `request` attaches a monotonic `request_id` and resolves on the matching
 *   `*_op_ok` / `*_op_fail` / `chat_error` frame (rejects on timeout)
 * - every parsed message is also emitted on the app-wide bus
 */
export class LumenSocket {
  private ws: WebSocket | null = null;
  private nextRequestId = 1;
  private pending = new Map<number, Pending>();

  onClose: ((code: number) => void) | null = null;

  get isOpen(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  connect(url: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(url);
      this.ws = ws;
      let settled = false;

      ws.onopen = () => {
        settled = true;
        resolve();
      };
      ws.onmessage = (event) => {
        this.handleMessage(String(event.data));
      };
      ws.onerror = () => {
        if (!settled) {
          settled = true;
          reject(new Error('websocket_error'));
        }
      };
      ws.onclose = (event) => {
        this.rejectAllPending();
        if (!settled) {
          settled = true;
          reject(new Error('websocket_closed'));
        }
        this.onClose?.(event.code);
      };
    });
  }

  send(event: ClientEvent): void {
    this.ws?.send(JSON.stringify(event));
  }

  /** Sends `event` with a fresh `request_id` and waits for its ack. */
  request(event: ClientEvent, timeoutMs = DEFAULT_ACK_TIMEOUT_MS): Promise<ServerMessage> {
    const id = this.nextRequestId++;
    const payload = { ...event, request_id: id } as ClientEvent;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error('ack_timeout'));
      }, timeoutMs);
      this.pending.set(id, { resolve, reject, timer });
      try {
        this.send(payload);
      } catch (error) {
        clearTimeout(timer);
        this.pending.delete(id);
        reject(error instanceof Error ? error : new Error(String(error)));
      }
    });
  }

  /** Closes without notifying `onClose` (manual/suspend shutdown). */
  close(): void {
    this.onClose = null;
    const ws = this.ws;
    this.ws = null;
    this.rejectAllPending();
    if (ws) {
      ws.onopen = null;
      ws.onmessage = null;
      ws.onerror = null;
      ws.onclose = null;
      try {
        ws.close();
      } catch {
        // Already closing.
      }
    }
  }

  private handleMessage(raw: string): void {
    const message = parseServerMessage(raw);
    if (!message) return;

    if (ACK_EVENTS.has(message.event) && 'request_id' in message) {
      const id = message.request_id;
      if (typeof id === 'number') {
        const waiter = this.pending.get(id);
        if (waiter) {
          clearTimeout(waiter.timer);
          this.pending.delete(id);
          waiter.resolve(message);
        }
      }
    }

    emitServerMessage(message);
  }

  private rejectAllPending(): void {
    for (const waiter of this.pending.values()) {
      clearTimeout(waiter.timer);
      waiter.reject(new Error('socket_closed'));
    }
    this.pending.clear();
  }
}
