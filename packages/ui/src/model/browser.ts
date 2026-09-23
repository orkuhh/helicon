import type { BrowserTabSnapshot } from "../types.js";

export type { BrowserTabSnapshot };

export interface BrowserWorkEntry {
  verb: string;
  detail: Record<string, unknown>;
  at: number;
}

export interface PendingBrowserPick {
  tabId: string;
  payload: Record<string, unknown>;
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
  recording: boolean;
  pendingPick: PendingBrowserPick | null;
  downloadsOpen: boolean;
  defaults: import("../client.js").BrowserDefaultsView | null;
  crashRecovery: { tabId: string; phase: "recovering" | "failed" } | null;
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
    recording: false,
    pendingPick: null,
    downloadsOpen: false,
    defaults: null,
    crashRecovery: null,
  };
}
