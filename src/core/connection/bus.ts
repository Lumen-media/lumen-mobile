import type { ServerMessage } from "@/src/core/protocol";

type Handler = (message: ServerMessage) => void;

const handlers = new Set<Handler>();

/** Subscribe to every parsed server message. Returns the unsubscribe fn. */
export function onServerMessage(handler: Handler): () => void {
  handlers.add(handler);
  return () => handlers.delete(handler);
}

export function emitServerMessage(message: ServerMessage): void {
  for (const handler of handlers) {
    try {
      handler(message);
    } catch {
      // A faulty subscriber must not break the socket pipeline.
    }
  }
}
