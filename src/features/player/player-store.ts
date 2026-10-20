import { create } from "zustand";

import { connection } from "@/src/core/connection/manager";
import type { PlayerSync, PlayerTick } from "@/src/core/protocol";

export type PlayerMedia = {
  url: string | null;
  title: string | null;
  artist: string | null;
  type: string | null;
};

export type PlayerLyric = {
  active: boolean;
  url: string | null;
  slideIndex: number;
  totalSlides: number;
};

type PlayerState = {
  media: PlayerMedia | null;
  isPlaying: boolean;
  /** Anchored playback position (seconds) valid at `anchoredAt` (local ms). */
  position: number;
  duration: number;
  anchoredAt: number;
  volume: number;
  isMuted: boolean;
  isLoop: boolean;
  lyric: PlayerLyric | null;

  applySync: (sync: PlayerSync) => void;
  applyTick: (tick: PlayerTick) => void;
  playPause: () => void;
  stop: () => void;
  next: () => void;
  previous: () => void;
  seek: (seconds: number) => void;
  setVolume: (value: number) => void;
  toggleMute: () => void;
  toggleLoop: () => void;
  reset: () => void;
};

const initialState = {
  media: null,
  isPlaying: false,
  position: 0,
  duration: 0,
  anchoredAt: 0,
  volume: 100,
  isMuted: false,
  isLoop: false,
  lyric: null,
} satisfies Omit<
  PlayerState,
  | "applySync"
  | "applyTick"
  | "playPause"
  | "stop"
  | "next"
  | "previous"
  | "seek"
  | "setVolume"
  | "toggleMute"
  | "toggleLoop"
  | "reset"
>;

/** Live position extrapolated from the last anchor while playing. */
export function getLivePosition(state: {
  isPlaying: boolean;
  position: number;
  anchoredAt: number;
}): number {
  if (!state.isPlaying) return state.position;
  const elapsed = (Date.now() - state.anchoredAt) / 1000;
  return Math.min(state.position + elapsed, state.duration || Number.MAX_SAFE_INTEGER);
}

export const usePlayerStore = create<PlayerState>((set, get) => ({
  ...initialState,

  applySync: (sync) =>
    set({
      media: sync.media
        ? {
            url: sync.media.url ?? null,
            title: sync.media.title ?? null,
            artist: sync.media.artist ?? null,
            type: sync.media.type ?? null,
          }
        : null,
      isPlaying: sync.playback.is_playing,
      position: sync.playback.position,
      duration: sync.playback.duration,
      anchoredAt: Date.now(),
      volume: sync.state.volume,
      isMuted: sync.state.is_muted,
      isLoop: sync.state.is_loop,
      lyric: sync.lyric
        ? {
            active: sync.lyric.active,
            url: sync.lyric.url ?? null,
            slideIndex: sync.lyric.slide_index,
            totalSlides: sync.lyric.total_slides,
          }
        : null,
    }),

  applyTick: (tick) =>
    set({
      position: tick.position,
      duration: tick.duration,
      isPlaying: tick.is_playing,
      anchoredAt: Date.now(),
    }),

  // Optimistic: playback resumes/pauses instantly, the next sync reconciles.
  playPause: () => {
    connection.send({ event: "play_pause" });
    set({ isPlaying: !get().isPlaying, anchoredAt: Date.now() });
  },
  stop: () => connection.send({ event: "stop" }),
  next: () => connection.send({ event: "next" }),
  previous: () => connection.send({ event: "previous" }),
  seek: (seconds) => {
    connection.send({ event: "seek", value: seconds });
    set({ position: seconds, anchoredAt: Date.now() });
  },
  setVolume: (value) => {
    connection.send({ event: "set_volume", value: Math.round(value) });
    set({ volume: value, isMuted: value === 0 });
  },
  toggleMute: () => {
    connection.send({ event: "mute" });
    set((s) => ({ isMuted: !s.isMuted }));
  },
  toggleLoop: () => {
    const next = get().isLoop ? 0 : 1;
    connection.send({ event: "set_loop", value: next as 0 | 1 });
    set({ isLoop: next === 1 });
  },

  reset: () => set({ ...initialState }),
}));
