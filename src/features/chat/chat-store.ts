import { create } from "zustand";

import { connection } from "@/src/core/connection/manager";
import type { ChatMessage } from "@/src/core/protocol";

type ChatState = {
  messages: ChatMessage[];
  historyLoaded: boolean;
  sending: boolean;
  /** sender_id → display name of whoever is typing right now. */
  typing: Record<string, string>;

  applyMessage: (message: ChatMessage) => void;
  applyHistory: (messages: ChatMessage[]) => void;
  applyReaction: (payload: {
    message_id: number;
    emoji: string;
    sender_id: string;
    reaction: { emoji: string; sender_id: string; ts: number } | null;
  }) => void;
  applyTyping: (senderId: string, name: string | null, isTyping: boolean) => void;
  applyDeleted: (messageId: number) => void;
  loadHistory: () => void;
  send: (text: string) => Promise<boolean>;
  markRead: () => void;
  reset: () => void;
};

export const useChatStore = create<ChatState>((set, get) => ({
  messages: [],
  historyLoaded: false,
  sending: false,
  typing: {},

  applyMessage: (message) =>
    set((s) => ({
      messages: [...s.messages.filter((m) => m.id !== message.id), message].sort(
        (a, b) => a.id - b.id,
      ),
    })),

  applyHistory: (messages) => set({ messages, historyLoaded: true }),

  applyReaction: ({ message_id, reaction }) =>
    set((s) => ({
      messages: s.messages.map((m) => {
        if (m.id !== message_id) return m;
        const existing = m.reactions ?? [];
        const filtered = existing.filter(
          (r) => !(r.emoji === reaction?.emoji && r.sender_id === reaction?.sender_id),
        );
        return {
          ...m,
          reactions: reaction ? [...filtered, reaction] : filtered,
        };
      }),
    })),

  applyTyping: (senderId, name, isTyping) =>
    set((s) => {
      const typing = { ...s.typing };
      if (isTyping && name) typing[senderId] = name;
      else delete typing[senderId];
      return { typing };
    }),

  applyDeleted: (messageId) =>
    set((s) => ({ messages: s.messages.filter((m) => m.id !== messageId) })),

  loadHistory: () => {
    connection.send({ event: "chat_history", limit: 100 });
  },

  send: async (text) => {
    const trimmed = text.trim();
    if (!trimmed || get().sending) return false;
    set({ sending: true });
    try {
      await connection.request({ event: "chat_send", text: trimmed });
      return true;
    } catch {
      return false;
    } finally {
      set({ sending: false });
    }
  },

  markRead: () => {
    const last = get().messages.at(-1);
    if (last) connection.send({ event: "chat_read", last_read_id: last.id });
  },

  reset: () => set({ messages: [], historyLoaded: false, sending: false, typing: {} }),
}));
