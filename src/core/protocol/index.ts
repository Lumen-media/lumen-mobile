import { z } from "zod";

/**
 * Contract between the Lumen desktop and remote devices.
 *
 * Mirrors docs/websocket-access-api.md, docs/chat-websocket-events.md and
 * docs/architecture/desktop-app-preview-webrtc.md from the desktop repo.
 * Unknown events are tolerated (forward compatibility): they surface as
 * `UnknownEvent` instead of throwing.
 */

export const PROTOCOL_VERSION = 1;

export const CLOSE_CODES = {
  unauthorized: 4001,
  notRegistered: 4003,
  invalidToken: 4004,
  inactive: 4005,
} as const;

export type Permission =
  | "player"
  | "lyrics"
  | "bible"
  | "media"
  | "streaming"
  | "chat"
  | "presentation";

export type Permissions = Record<Permission, boolean>;

export const DEFAULT_PERMISSIONS: Permissions = {
  player: false,
  lyrics: false,
  bible: false,
  media: false,
  streaming: false,
  chat: false,
  presentation: false,
};

/** Event → required permission (None means every authenticated device). */
export const EVENT_PERMISSIONS: Partial<Record<string, Permission>> = {
  play_pause: "player",
  stop: "player",
  next: "player",
  previous: "player",
  mute: "player",
  set_volume: "player",
  seek: "player",
  set_loop: "player",
  load_url: "player",
  metadata: "player",
  progress: "player",
  queue_add: "player",
  queue_remove: "player",
  queue_move: "player",
  queue_jump: "player",
  queue_shuffle: "player",
  queue_clear: "player",
  load_lyric: "lyrics",
  subscribe_stream: "streaming",
  unsubscribe_stream: "streaming",
  webrtc_answer: "streaming",
  webrtc_ice_candidate: "streaming",
  mobile_offer: "streaming",
  chat_send: "chat",
  chat_file_send: "chat",
  chat_history: "chat",
  chat_reaction: "chat",
  chat_typing: "chat",
  chat_read: "chat",
  slide_next: "presentation",
  slide_prev: "presentation",
  slide_goto: "presentation",
  blackout: "presentation",
  wallpaper: "presentation",
};

export function canSend(event: string, perms: Permissions): boolean {
  const required = EVENT_PERMISSIONS[event];
  if (!required) return true;
  return perms[required] === true;
}

// ---------------------------------------------------------------------------
// Incoming (server → device)
// ---------------------------------------------------------------------------

const permissionsSchema = z.record(z.string(), z.boolean()).catch({});

const mediaSchema = z.object({
  url: z.string().nullish(),
  title: z.string().nullish(),
  artist: z.string().nullish(),
  type: z.string().nullish(),
});

const playbackSchema = z.object({
  is_playing: z.boolean(),
  position: z.number(),
  duration: z.number(),
  sent_at: z.number().nullish(),
});

const playerStateSchema = z.object({
  is_loop: z.boolean(),
  is_muted: z.boolean(),
  volume: z.number(),
});

const lyricSchema = z.object({
  active: z.boolean(),
  url: z.string().nullish(),
  slide_index: z.number(),
  total_slides: z.number(),
});

export const playerSyncSchema = z.object({
  event: z.literal("player_sync"),
  media: mediaSchema.nullish(),
  playback: playbackSchema,
  state: playerStateSchema,
  lyric: lyricSchema.nullish(),
  action: z.string().nullish(),
});
export type PlayerSync = z.infer<typeof playerSyncSchema>;

export const playerTickSchema = z.object({
  event: z.literal("player_tick"),
  position: z.number(),
  duration: z.number(),
  is_playing: z.boolean(),
  sent_at_ms: z.number(),
});
export type PlayerTick = z.infer<typeof playerTickSchema>;

export const queueItemSchema = z.object({
  id: z.number(),
  title: z.string().nullish(),
  artist: z.string().nullish(),
  type: z.string().nullish(),
  is_playing: z.boolean(),
  is_played: z.boolean(),
  duration: z.number().nullish(),
});
export type QueueItem = z.infer<typeof queueItemSchema>;

export const queueSyncSchema = z.object({
  event: z.literal("queue_sync"),
  items: z.array(queueItemSchema),
  current_index: z.number().nullish(),
});
export type QueueSync = z.infer<typeof queueSyncSchema>;

export const presentationSyncSchema = z.object({
  event: z.literal("presentation_sync"),
  kind: z.string().nullish(),
  current_deck: z.string().nullish(),
  slide_index: z.number(),
  total_slides: z.number(),
  is_black: z.boolean(),
  is_wallpaper: z.boolean(),
});
export type PresentationSync = z.infer<typeof presentationSyncSchema>;

export const authOkSchema = z.object({
  event: z.literal("auth_ok"),
  session_id: z.string(),
  desktop_name: z.string(),
  access_token: z.string(),
  permissions: permissionsSchema,
});
export type AuthOk = z.infer<typeof authOkSchema>;

export const authFailSchema = z.object({
  event: z.literal("auth_fail"),
  reason: z.string(),
});
export type AuthFail = z.infer<typeof authFailSchema>;

export const permissionDeniedSchema = z.object({
  event: z.literal("permission_denied"),
  feature: z.string(),
});

const requestId = z.unknown();

export const queueOpOkSchema = z.object({
  event: z.literal("queue_op_ok"),
  request_id: requestId,
});
export const queueOpFailSchema = z.object({
  event: z.literal("queue_op_fail"),
  request_id: requestId,
  reason: z.string(),
});
export const presentationOpOkSchema = z.object({
  event: z.literal("presentation_op_ok"),
  request_id: requestId,
});
export const presentationOpFailSchema = z.object({
  event: z.literal("presentation_op_fail"),
  request_id: requestId,
  reason: z.string(),
});
export type OpFailReason =
  | "no_permission"
  | "missing_url"
  | "missing_id"
  | "missing_url_or_media_id"
  | "missing_id_or_position"
  | "missing_index";

const chatFileSchema = z.object({
  file_name: z.string(),
  file_path: z.string().nullish(),
  file_size: z.number().nullish(),
  file_url: z.string().nullish(),
  file_path_rel: z.string().nullish(),
});

const chatReactionSchema = z.object({
  emoji: z.string(),
  sender_id: z.string(),
  ts: z.number(),
});

export const chatMessageSchema = z.object({
  id: z.number(),
  sender_id: z.string(),
  sender_type: z.string(),
  sender_name: z.string(),
  text: z.string(),
  ts: z.number(),
  file: chatFileSchema.nullish(),
  reactions: z.array(chatReactionSchema).nullish(),
  reply_to: z
    .object({
      id: z.number(),
      sender_name: z.string().nullish(),
      text: z.string().nullish(),
      file: chatFileSchema.nullish(),
    })
    .nullish(),
});
export type ChatMessage = z.infer<typeof chatMessageSchema>;

export const chatMessageEventSchema = z.object({
  event: z.literal("chat_message"),
  message: chatMessageSchema,
});
export const chatHistorySchema = z.object({
  event: z.literal("chat_history"),
  messages: z.array(chatMessageSchema),
});
export const chatReactionEventSchema = z.object({
  event: z.literal("chat_reaction"),
  message_id: z.number(),
  emoji: z.string(),
  sender_id: z.string(),
  reaction: chatReactionSchema.nullish(),
});
export const chatTypingEventSchema = z.object({
  event: z.literal("chat_typing"),
  sender_id: z.string(),
  sender_name: z.string().nullish(),
  is_typing: z.boolean(),
});
export const chatDeletedSchema = z.object({
  event: z.literal("chat_deleted"),
  message_id: z.number(),
});
export const chatReadEventSchema = z.object({
  event: z.literal("chat_read"),
  device_id: z.string(),
  last_read_id: z.number(),
});
export const chatErrorSchema = z.object({
  event: z.literal("chat_error"),
  reason: z.string(),
  request_id: requestId,
});

export const streamOfferSchema = z.object({
  event: z.literal("stream_offer"),
  stream_type: z.string(),
  sdp: z.string(),
});
export const streamIceCandidateSchema = z.object({
  event: z.literal("stream_ice_candidate"),
  stream_type: z.string(),
  candidate: z.object({}).passthrough(),
});
export const streamStoppedSchema = z.object({
  event: z.literal("stream_stopped"),
  stream_type: z.string(),
});
export const streamErrorSchema = z.object({
  event: z.literal("stream_error"),
  stream_type: z.string(),
  reason: z.string(),
});

export const deviceDeactivatedSchema = z.object({
  event: z.literal("device_deactivated"),
  device_id: z.string(),
});

/** Handshake (pending on desktop): version + feature flags for the session. */
export const helloSchema = z.object({
  event: z.literal("hello"),
  protocol: z.number(),
  desktop_version: z.string().nullish(),
  features: z.array(z.string()).nullish(),
});
export type Hello = z.infer<typeof helloSchema>;

const knownEventSchema = z.discriminatedUnion("event", [
  authOkSchema,
  authFailSchema,
  permissionDeniedSchema,
  queueOpOkSchema,
  queueOpFailSchema,
  presentationOpOkSchema,
  presentationOpFailSchema,
  playerSyncSchema,
  playerTickSchema,
  queueSyncSchema,
  presentationSyncSchema,
  chatMessageEventSchema,
  chatHistorySchema,
  chatReactionEventSchema,
  chatTypingEventSchema,
  chatDeletedSchema,
  chatReadEventSchema,
  chatErrorSchema,
  streamOfferSchema,
  streamIceCandidateSchema,
  streamStoppedSchema,
  streamErrorSchema,
  deviceDeactivatedSchema,
  helloSchema,
]);

export type KnownEvent = z.infer<typeof knownEventSchema>;

export type UnknownEvent = { event: string } & Record<string, unknown>;

export type ServerMessage = KnownEvent | UnknownEvent;

export function isKnown(message: ServerMessage): message is KnownEvent {
  return "protocol" in message || KNOWN_EVENT_NAMES.has(message.event);
}

const KNOWN_EVENT_NAMES = new Set(
  (
    [
      "auth_ok",
      "auth_fail",
      "permission_denied",
      "queue_op_ok",
      "queue_op_fail",
      "presentation_op_ok",
      "presentation_op_fail",
      "player_sync",
      "player_tick",
      "queue_sync",
      "presentation_sync",
      "chat_message",
      "chat_history",
      "chat_reaction",
      "chat_typing",
      "chat_deleted",
      "chat_read",
      "chat_error",
      "stream_offer",
      "stream_ice_candidate",
      "stream_stopped",
      "stream_error",
      "device_deactivated",
      "hello",
    ] as const
  ),
);

/** Parses a raw WS frame. Returns null when the frame is not valid JSON. */
export function parseServerMessage(raw: string): ServerMessage | null {
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return null;
  }
  if (typeof data !== "object" || data === null || !("event" in data)) {
    return null;
  }
  const known = knownEventSchema.safeParse(data);
  if (known.success) return known.data;
  return data as UnknownEvent;
}

// ---------------------------------------------------------------------------
// Outgoing (device → server)
// ---------------------------------------------------------------------------

export type RegisterPayload = {
  event: "register";
  token: string;
  device_id: string;
  device_name: string;
  device_type: "mobile";
  os: string;
  version: string;
};

export type AuthPayload = {
  event: "auth";
  device_id: string;
  access_token: string;
};

export type ClientEvent =
  | RegisterPayload
  | AuthPayload
  | { event: "forget_device" }
  | { event: "sync_request" }
  | { event: "play_pause" }
  | { event: "stop" }
  | { event: "next" }
  | { event: "previous" }
  | { event: "mute" }
  | { event: "set_volume"; value: number }
  | { event: "seek"; value: number }
  | { event: "set_loop"; value: 0 | 1 }
  | { event: "load_url"; url: string; value?: number }
  | { event: "load_lyric"; url: string }
  | {
      event: "queue_add";
      url?: string;
      media_id?: number;
      position?: number;
      request_id?: number;
    }
  | { event: "queue_remove"; id: number; request_id?: number }
  | { event: "queue_move"; id: number; position: number; request_id?: number }
  | { event: "queue_jump"; id: number; request_id?: number }
  | { event: "queue_shuffle"; request_id?: number }
  | { event: "queue_clear"; request_id?: number }
  | { event: "slide_next"; request_id?: number }
  | { event: "slide_prev"; request_id?: number }
  | { event: "slide_goto"; index: number; request_id?: number }
  | { event: "blackout"; on: boolean; request_id?: number }
  | { event: "wallpaper"; on: boolean; request_id?: number }
  | {
      event: "chat_send";
      text: string;
      reply_to_id?: number;
      request_id?: number;
    }
  | {
      event: "chat_file_send";
      file_name: string;
      data: string;
      text?: string;
      reply_to_id?: number;
      request_id?: number;
    }
  | { event: "chat_reaction"; message_id: number; emoji: string; request_id?: number }
  | { event: "chat_typing"; is_typing: boolean }
  | { event: "chat_history"; limit?: number; request_id?: number }
  | { event: "chat_read"; last_read_id: number }
  | { event: "subscribe_stream"; stream_type: "app_preview" }
  | { event: "unsubscribe_stream"; stream_type: "app_preview" }
  | { event: "webrtc_answer"; stream_type: "app_preview"; sdp: string }
  | {
      event: "webrtc_ice_candidate";
      stream_type: "app_preview";
      candidate: unknown;
    };

export type Acks =
  | typeof queueOpOkSchema
  | typeof queueOpFailSchema
  | typeof presentationOpOkSchema
  | typeof presentationOpFailSchema;
