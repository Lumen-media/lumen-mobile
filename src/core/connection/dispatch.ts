import { onServerMessage } from "@/src/core/connection/bus";
import { useChatStore } from "@/src/features/chat/chat-store";
import { usePlayerStore } from "@/src/features/player/player-store";
import { usePresentationStore } from "@/src/features/presentation/presentation-store";
import { useQueueStore } from "@/src/features/queue/queue-store";

let initialized = false;

/** Routes server messages to the feature stores. Call once from the root layout. */
export function initDispatch(): void {
  if (initialized) return;
  initialized = true;

  onServerMessage((message) => {
    switch (message.event) {
      case "player_sync":
        usePlayerStore.getState().applySync(message);
        break;
      case "player_tick":
        usePlayerStore.getState().applyTick(message);
        break;
      case "queue_sync":
        useQueueStore.getState().applySync(message);
        break;
      case "presentation_sync":
        usePresentationStore.getState().applySync(message);
        break;
      case "chat_message":
        useChatStore.getState().applyMessage(message.message);
        break;
      case "chat_history":
        useChatStore.getState().applyHistory(message.messages);
        break;
      case "chat_reaction":
        useChatStore.getState().applyReaction({
          message_id: message.message_id,
          emoji: message.emoji,
          sender_id: message.sender_id,
          reaction: message.reaction ?? null,
        });
        break;
      case "chat_typing":
        useChatStore.getState().applyTyping(
          message.sender_id,
          message.sender_name ?? null,
          message.is_typing,
        );
        break;
      case "chat_deleted":
        useChatStore.getState().applyDeleted(message.message_id);
        break;
      default:
        break;
    }
  });
}
