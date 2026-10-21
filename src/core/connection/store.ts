import { create } from 'zustand';

import type { Permissions } from '@/src/core/protocol';

export type ConnectionStatus =
  | 'idle'
  | 'connecting'
  | 'registering'
  | 'authenticating'
  | 'connected'
  | 'reconnecting'
  | 'denied'
  | 'expired'
  | 'error';

export type Endpoint = { host: string; port: number };

type ConnectionState = {
  status: ConnectionStatus;
  error: string | null;
  desktopName: string | null;
  permissions: Permissions | null;
  endpoint: Endpoint | null;
  /** True while an auto-connect to the last desktop is in flight. */
  autoConnecting: boolean;
};

const initialState: ConnectionState = {
  status: 'idle',
  error: null,
  desktopName: null,
  permissions: null,
  endpoint: null,
  autoConnecting: false,
};

export const useConnectionStore = create<ConnectionState>(() => initialState);

export function setConnection(partial: Partial<ConnectionState>): void {
  useConnectionStore.setState(partial);
}

export function resetConnection(): void {
  useConnectionStore.setState(initialState);
}
