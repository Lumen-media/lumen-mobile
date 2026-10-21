import * as SecureStore from 'expo-secure-store';

const PAIRED_KEY = 'lumen.paired.v1';
const DEVICE_ID_KEY = 'lumen.device_id.v1';

export type PairedDevice = {
  /** Stable identity of the desktop: its machine name. */
  key: string;
  desktopName: string;
  host: string;
  port: number;
  deviceId: string;
  accessToken: string;
  lastConnectedAt: number;
};

function randomUuid(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/** Stable id for this install; used as `device_id` on register/auth. */
export async function getOrCreateDeviceId(): Promise<string> {
  const existing = await SecureStore.getItemAsync(DEVICE_ID_KEY);
  if (existing) return existing;
  const created = randomUuid();
  await SecureStore.setItemAsync(DEVICE_ID_KEY, created);
  return created;
}

export async function listPaired(): Promise<PairedDevice[]> {
  const raw = await SecureStore.getItemAsync(PAIRED_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed as PairedDevice[];
  } catch {
    return [];
  }
}

async function writePaired(devices: PairedDevice[]): Promise<void> {
  await SecureStore.setItemAsync(PAIRED_KEY, JSON.stringify(devices));
}

/** Upserts by desktop machine name and returns the stored entry. */
export async function savePaired(
  device: Omit<PairedDevice, 'lastConnectedAt'> & { lastConnectedAt?: number }
): Promise<PairedDevice> {
  const devices = await listPaired();
  const entry: PairedDevice = {
    ...device,
    lastConnectedAt: device.lastConnectedAt ?? Date.now(),
  };
  const next = devices.filter((d) => d.key !== entry.key);
  next.push(entry);
  await writePaired(next);
  return entry;
}

export async function touchPaired(key: string, host: string, port: number): Promise<void> {
  const devices = await listPaired();
  const next = devices.map((d) =>
    d.key === key ? { ...d, host, port, lastConnectedAt: Date.now() } : d
  );
  await writePaired(next);
}

export async function removePaired(key: string): Promise<void> {
  const devices = await listPaired();
  await writePaired(devices.filter((d) => d.key !== key));
}

/** The desktop to auto-connect on launch: the most recently used one. */
export async function getLastConnected(): Promise<PairedDevice | null> {
  const devices = await listPaired();
  if (devices.length === 0) return null;
  return devices.reduce((a, b) => (a.lastConnectedAt >= b.lastConnectedAt ? a : b));
}
