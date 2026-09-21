import type { BrowserTabSnapshot } from "../types.js";

export type { BrowserTabSnapshot };

export interface BrowserWorkEntry {
  verb: string;
  detail: Record<string, unknown>;
  at: number;
}

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
  workLog: BrowserWorkEntry[];
  agentCursor: { x: number; y: number; visible: boolean } | null;
  pickActive: boolean;
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
    workLog: [],
    agentCursor: null,
    pickActive: false,
  };
}
