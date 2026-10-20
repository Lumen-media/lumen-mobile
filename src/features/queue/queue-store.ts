import { create } from "zustand";

import { connection } from "@/src/core/connection/manager";
import type { QueueItem, QueueSync } from "@/src/core/protocol";

type QueueState = {
  items: QueueItem[];
  currentIndex: number | null;

  applySync: (sync: QueueSync) => void;
  remove: (id: number) => void;
  jump: (id: number) => void;
  move: (id: number, position: number) => void;
  shuffle: () => void;
  clear: () => void;
  reset: () => void;
};

function logOpFail(result: { event: string; reason?: unknown }): void {
  if (result.event.endsWith("_op_fail")) {
    // TODO: revert optimistic state / surface a toast.
    console.warn("queue op failed:", result);
  }
}

async function op(
  event: Parameters<typeof connection.request>[0],
): Promise<void> {
  try {
    logOpFail(await connection.request(event));
  } catch {
    // Timeout/offline: the next queue_sync reconciles.
  }
}

export const useQueueStore = create<QueueState>((set, get) => ({
  items: [],
  currentIndex: null,

  applySync: (sync) =>
    set({
      items: sync.items,
      currentIndex: sync.current_index ?? null,
    }),

  remove: (id) => {
    set((s) => ({ items: s.items.filter((item) => item.id !== id) }));
    void op({ event: "queue_remove", id });
  },

  jump: (id) => {
    const index = get().items.findIndex((item) => item.id === id);
    if (index >= 0) set({ currentIndex: index });
    void op({ event: "queue_jump", id });
  },

  move: (id, position) => {
    const items = [...get().items];
    const from = items.findIndex((item) => item.id === id);
    if (from < 0) return;
    const [moved] = items.splice(from, 1);
    items.splice(Math.max(0, Math.min(position, items.length)), 0, moved);
    set({ items });
    void op({ event: "queue_move", id, position });
  },

  shuffle: () => {
    void op({ event: "queue_shuffle" });
  },

  clear: () => {
    set({ items: [], currentIndex: null });
    void op({ event: "queue_clear" });
  },

  reset: () => set({ items: [], currentIndex: null }),
}));
