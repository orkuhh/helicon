import type { BrowserTabSnapshot } from "../types.js";

export type { BrowserTabSnapshot };

export interface BrowserSessionState {
  tabs: BrowserTabSnapshot[];
  activeTabId: string | null;
  loading: boolean;
  frameDataUrl: string | null;
  miniPlayerOpen: boolean;
  unreachable: string | null;
  discovered: { url: string; title: string | null }[];
  history: { url: string; title: string | null }[];
  controller: "none" | "human" | "agent";
}

export function emptyBrowserSession(): BrowserSessionState {
  return {
    tabs: [],
    activeTabId: null,
    loading: false,
    frameDataUrl: null,
    miniPlayerOpen: false,
    unreachable: null,
    discovered: [],
    history: [],
    controller: "none",
  };
}
