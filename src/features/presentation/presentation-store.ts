import { create } from "zustand";

import { connection } from "@/src/core/connection/manager";
import type { PresentationSync } from "@/src/core/protocol";

type PresentationState = {
  kind: string | null;
  currentDeck: string | null;
  slideIndex: number;
  totalSlides: number;
  isBlack: boolean;
  isWallpaper: boolean;

  applySync: (sync: PresentationSync) => void;
  slideNext: () => void;
  slidePrev: () => void;
  slideGoto: (index: number) => void;
  toggleBlackout: () => void;
  toggleWallpaper: () => void;
  reset: () => void;
};

function request(
  event: Parameters<typeof connection.request>[0],
): void {
  connection.request(event).catch(() => {
    // Timeout/offline: presentation_sync reconciles.
  });
}

export const usePresentationStore = create<PresentationState>((set, get) => ({
  kind: null,
  currentDeck: null,
  slideIndex: 0,
  totalSlides: 0,
  isBlack: false,
  isWallpaper: false,

  applySync: (sync) =>
    set({
      kind: sync.kind ?? null,
      currentDeck: sync.current_deck ?? null,
      slideIndex: sync.slide_index,
      totalSlides: sync.total_slides,
      isBlack: sync.is_black,
      isWallpaper: sync.is_wallpaper,
    }),

  slideNext: () => {
    set((s) => ({ slideIndex: Math.min(s.slideIndex + 1, s.totalSlides) }));
    request({ event: "slide_next" });
  },
  slidePrev: () => {
    set((s) => ({ slideIndex: Math.max(s.slideIndex - 1, 0) }));
    request({ event: "slide_prev" });
  },
  slideGoto: (index) => {
    set({ slideIndex: index });
    request({ event: "slide_goto", index });
  },
  toggleBlackout: () => {
    const on = !get().isBlack;
    set({ isBlack: on });
    request({ event: "blackout", on });
  },
  toggleWallpaper: () => {
    const on = !get().isWallpaper;
    set({ isWallpaper: on });
    request({ event: "wallpaper", on });
  },

  reset: () =>
    set({
      kind: null,
      currentDeck: null,
      slideIndex: 0,
      totalSlides: 0,
      isBlack: false,
      isWallpaper: false,
    }),
}));
