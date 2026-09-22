import {
  ArrowLeft,
  ArrowRight,
  Camera,
  Circle,
  ExternalLink,
  Globe,
  MousePointer2,
  PictureInPicture2,
  Plus,
  RefreshCw,
  Square,
  Video,
  Volume2,
  VolumeX,
  X,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { shallowEqual, useApp, useController } from "../../app/context.js";
import { useOverlayDragProps } from "../../app/frame.js";
import { DEFAULT_BROWSER_WIDTH, BROWSER_WIDTH_MIN, BROWSER_WIDTH_MAX } from "../../model/store.js";
import { Button, IconButton, Spinner, cn } from "../ui/primitives.js";
import { AgentBrowserCursor } from "./AgentBrowserCursor.js";
import { BrowserAnnotateDialog } from "./BrowserAnnotateDialog.js";
import { BrowserContextMenu } from "./BrowserContextMenu.js";
import { BrowserDeviceToolbar } from "./BrowserDeviceToolbar.js";
import { BrowserViewportFrame } from "./BrowserViewportFrame.js";
import type { BrowserContextMenuProbe } from "../../types.js";
import { BrowserDownloadsPanel } from "./BrowserDownloadsPanel.js";
import { BrowserMoreMenu } from "./BrowserMoreMenu.js";
import { PreviewUnreachable } from "./PreviewUnreachable.js";

export function BrowserPanel(props: { sessionId: string }) {
  const controller = useController();
  const width = useApp((s) => s.prefs.browserWidth);
  const browser = useApp((s) => s.browser[props.sessionId] ?? null, shallowEqual);
  const [urlDraft, setUrlDraft] = useState("");
  const [aspectLocked, setAspectLocked] = useState(true);
  const [menu, setMenu] = useState<{ x: number; y: number; clientX: number; clientY: number } | null>(null);
  const [menuProbe, setMenuProbe] = useState<BrowserContextMenuProbe | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drag = useOverlayDragProps();

  useEffect(() => {
    void controller.ensureBrowser(props.sessionId);
  }, [controller, props.sessionId]);

  useEffect(() => {
    if (!browser?.frameDataUrl || !canvasRef.current) {
      return;
    }
    const img = new Image();
    img.onload = () => {
      const canvas = canvasRef.current;
      if (!canvas) {
        return;
      }
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext("2d");
      ctx?.drawImage(img, 0, 0);
    };
    img.src = browser.frameDataUrl;
  }, [browser?.frameDataUrl]);

  const active = browser?.tabs.find((t) => t.tabId === browser.activeTabId) ?? browser?.tabs[0] ?? null;
  const pending = browser?.pendingPick;
  const pickLabel =
    pending && typeof pending.payload["selector"] === "string"
      ? pending.payload["selector"]
      : pending && typeof pending.payload["text"] === "string"
        ? pending.payload["text"]
        : "element";

  return (
    <aside
      className="relative flex h-full min-h-0 shrink-0 flex-col bg-surface"
      style={{ width }}
      data-no-drag
    >
      <div {...drag} className="flex h-9 shrink-0 items-center gap-1 border-b border-line px-2">
        {browser?.tabs.map((tab) => (
          <div
            key={tab.tabId}
            role="tab"
            tabIndex={0}
            aria-selected={tab.tabId === active?.tabId}
            className={cn(
              "flex max-w-[140px] cursor-pointer items-center gap-1 rounded px-2 py-1 text-xs",
              tab.tabId === active?.tabId ? "bg-elevated text-fg" : "text-muted hover:bg-elevated/60",
            )}
            onClick={() => controller.setBrowserTab(props.sessionId, tab.tabId)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                controller.setBrowserTab(props.sessionId, tab.tabId);
              }
            }}
          >
            {tab.faviconDataUrl ? (
              <img src={tab.faviconDataUrl} alt="" className="size-3 shrink-0 rounded-sm" />
            ) : null}
            <span className="truncate">{tab.title || tab.url || "New tab"}</span>
            {tab.audible || tab.muted ? (
              <span
                role="button"
                tabIndex={0}
                className="shrink-0 opacity-70 hover:opacity-100"
                title={tab.muted ? "Unmute tab" : "Mute tab"}
                onClick={(e) => {
                  e.stopPropagation();
                  void controller.toggleBrowserMute(props.sessionId, tab.tabId);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    e.stopPropagation();
                    void controller.toggleBrowserMute(props.sessionId, tab.tabId);
                  }
                }}
              >
                {tab.muted ? <VolumeX size={12} /> : <Volume2 size={12} />}
              </span>
            ) : null}
            <span
              role="button"
              tabIndex={0}
              className="shrink-0 opacity-60 hover:opacity-100"
              aria-label="Close tab"
              onClick={(e) => {
                e.stopPropagation();
                void controller.closeBrowserTab(props.sessionId, tab.tabId);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  e.stopPropagation();
                  void controller.closeBrowserTab(props.sessionId, tab.tabId);
                }
              }}
            >
              <X size={12} />
            </span>
          </div>
        ))}
        <IconButton label="New browser tab" onClick={() => void controller.openBrowserTab(props.sessionId)}>
          <Plus size={14} />
        </IconButton>
      </div>
      {active ? (
        <BrowserDeviceToolbar
          tab={active}
          aspectLocked={aspectLocked}
          onAspectLockedChange={setAspectLocked}
          onViewport={(viewport) => void controller.resizeBrowserViewport(props.sessionId, active.tabId, viewport)}
        />
      ) : null}
      <div className="flex flex-wrap items-center gap-1 border-b border-line px-2 py-1.5">
        {active ? (
          <span className="rounded bg-elevated px-1.5 py-0.5 text-2xs text-muted" title="Profile for this tab">
            {active.profileId}
          </span>
        ) : null}
        <IconButton label="Back" onClick={() => active && void controller.backBrowserTab(props.sessionId, active.tabId)}>
          <ArrowLeft size={14} />
        </IconButton>
        <IconButton label="Forward" onClick={() => active && void controller.forwardBrowserTab(props.sessionId, active.tabId)}>
          <ArrowRight size={14} />
        </IconButton>
        <IconButton
          label={browser?.loading ? "Stop" : "Reload"}
          onClick={() => {
            if (!active) {
              return;
            }
            if (browser?.loading) {
              void controller.stopBrowserTab(props.sessionId, active.tabId);
            } else {
              void controller.reloadBrowserTab(props.sessionId, active.tabId);
            }
          }}
        >
          {browser?.loading ? <Square size={14} /> : <RefreshCw size={14} />}
        </IconButton>
        <IconButton
          label="Open in system browser"
          onClick={() => active?.url && void controller.openBrowserUrlExternally(active.url)}
        >
          <ExternalLink size={14} />
        </IconButton>
        <IconButton
          label="Pick element"
          active={browser?.pickActive}
          onClick={() => active && void controller.toggleBrowserPick(props.sessionId, active.tabId, !browser?.pickActive)}
        >
          <MousePointer2 size={14} />
        </IconButton>
        <IconButton
          label="Screenshot"
          onClick={() => active && void controller.captureBrowserScreenshot(props.sessionId, active.tabId)}
        >
          <Camera size={14} />
        </IconButton>
        <IconButton
          label={browser?.recording ? "Stop recording" : "Record"}
          active={browser?.recording}
          onClick={() =>
            active && void controller.toggleBrowserRecording(props.sessionId, active.tabId, !browser?.recording)
          }
        >
          {browser?.recording ? <Circle size={14} className="fill-red-500 text-red-500" /> : <Video size={14} />}
        </IconButton>
        <IconButton
          label="Picture-in-picture"
          onClick={() => active && void controller.openBrowserPip(props.sessionId, active.tabId)}
        >
          <PictureInPicture2 size={14} />
        </IconButton>
        <IconButton
          label="Mini player"
          onClick={() => controller.setBrowserMiniPlayer(props.sessionId, !browser?.miniPlayerOpen)}
        >
          <PictureInPicture2 size={14} className="rotate-180" />
        </IconButton>
        {active ? (
          <BrowserMoreMenu
            tab={active}
            profileLabel={active.profileId}
            onAppearance={(scheme) => void controller.setBrowserAppearance(props.sessionId, active.tabId, scheme)}
            onDevTools={() => void controller.openBrowserDevTools(props.sessionId, active.tabId)}
            onDownloads={() => controller.setBrowserDownloadsOpen(props.sessionId, true)}
            onHardReload={() => void controller.hardReloadBrowserTab(props.sessionId, active.tabId)}
            onClearCookies={() => void controller.clearBrowserProfileData(active.profileId, "cookies")}
            onClearCache={() => void controller.clearBrowserProfileData(active.profileId, "cache")}
          />
        ) : null}
        <input
          className="min-w-0 flex-1 rounded border border-line bg-canvas px-2 py-1 text-xs font-mono text-fg"
          value={urlDraft || active?.url || ""}
          onChange={(e) => setUrlDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              void controller.submitBrowserUrl(props.sessionId, urlDraft || active?.url || "");
              setUrlDraft("");
            }
          }}
          placeholder="https://"
        />
        <Button
          size="sm"
          onClick={() => void controller.submitBrowserUrl(props.sessionId, urlDraft || active?.url || "")}
        >
          Go
        </Button>
      </div>
      <div className="relative min-h-0 flex-1 bg-canvas">
        {browser?.loading ? (
          <div className="absolute inset-0 z-10 grid place-items-center">
            <Spinner />
          </div>
        ) : null}
        {active?.failed ? (
          <PreviewUnreachable code={active.failed} onRetry={() => void controller.reloadBrowserTab(props.sessionId, active.tabId)} />
        ) : null}
        {!active?.failed && !browser?.tabs.length ? (
          <EmptyBrowser
            history={browser?.history ?? []}
            discovered={browser?.discovered ?? []}
            onOpen={(url) => void controller.openBrowserTab(props.sessionId, url)}
            onRemoveHistory={(url) => void controller.removeBrowserHistoryEntry(props.sessionId, url)}
          />
        ) : (
          <>
            <BrowserViewportFrame
              tab={active}
              aspectLocked={aspectLocked}
              onViewport={(viewport) => void controller.resizeBrowserViewport(props.sessionId, active.tabId, viewport)}
            >
              <canvas
                ref={canvasRef}
                className="max-h-full max-w-full cursor-crosshair"
                onPointerDown={(e) => {
                  if (!active || !canvasRef.current) {
                    return;
                  }
                  controller.browserHumanInput(props.sessionId, active.tabId);
                  void controller.browserCanvasPointer(props.sessionId, active.tabId, e.clientX, e.clientY, canvasRef.current);
                }}
                onContextMenu={(e) => {
                  e.preventDefault();
                  if (!active || !canvasRef.current) {
                    return;
                  }
                  setMenu({ x: e.clientX, y: e.clientY, clientX: e.clientX, clientY: e.clientY });
                  setMenuProbe(null);
                  void controller
                    .probeBrowserContextMenu(props.sessionId, active.tabId, e.clientX, e.clientY, canvasRef.current)
                    .then(setMenuProbe);
                }}
              />
            </BrowserViewportFrame>
            {browser?.crashRecovery?.tabId === active.tabId && browser.crashRecovery.phase === "recovering" ? (
              <div className="pointer-events-none absolute inset-0 z-20 grid place-items-center bg-canvas/85 text-sm text-muted">
                <span>Recovering from a crash…</span>
              </div>
            ) : null}
            <BrowserContextMenu
              open={menu !== null}
              x={menu?.x ?? 0}
              y={menu?.y ?? 0}
              probe={menuProbe}
              pageUrl={active?.url ?? null}
              onClose={() => {
                setMenu(null);
                setMenuProbe(null);
              }}
              onReload={() => active && void controller.reloadBrowserTab(props.sessionId, active.tabId)}
              onHardReload={() => active && void controller.hardReloadBrowserTab(props.sessionId, active.tabId)}
              onAction={(action) => {
                if (!active || !canvasRef.current || !menu) {
                  return;
                }
                void controller.runBrowserContextMenuAction(
                  props.sessionId,
                  active.tabId,
                  menu.clientX,
                  menu.clientY,
                  canvasRef.current,
                  action,
                );
              }}
            />
            {browser?.agentCursor?.visible ? (
              <AgentBrowserCursor x={browser.agentCursor.x} y={browser.agentCursor.y} visible />
            ) : null}
            <BrowserAnnotateDialog
              open={Boolean(pending)}
              selectorLabel={pickLabel}
              onCancel={() => controller.dismissBrowserPick(props.sessionId)}
              onSubmit={(comment) => void controller.submitBrowserPickAnnotation(props.sessionId, comment)}
            />
            <BrowserDownloadsPanel
              open={browser?.downloadsOpen ?? false}
              onClose={() => controller.setBrowserDownloadsOpen(props.sessionId, false)}
            />
          </>
        )}
      </div>
      <ResizeHandle onResize={(w) => controller.setBrowserWidth(w)} />
    </aside>
  );
}

function EmptyBrowser(props: {
  history: { url: string; title: string | null }[];
  discovered: { url: string; title: string | null }[];
  onOpen: (url: string) => void;
  onRemoveHistory: (url: string) => void;
}) {
  return (
    <div className="flex h-full flex-col gap-4 overflow-auto p-4 text-sm text-muted">
      <div className="flex items-center gap-2 text-fg">
        <Globe size={16} />
        <span className="font-medium">Browser</span>
      </div>
      {props.discovered.length > 0 ? (
        <section>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-subtle">Local servers</h3>
          <ul className="space-y-1">
            {props.discovered.map((s) => (
              <li key={s.url}>
                <button type="button" className="text-left text-accent-text hover:underline" onClick={() => props.onOpen(s.url)}>
                  {s.title ?? s.url}
                </button>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      {props.history.length > 0 ? (
        <section>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-subtle">Recently used</h3>
          <ul className="space-y-1">
            {props.history.map((h) => (
              <li key={h.url} className="flex items-center gap-2">
                <button type="button" className="min-w-0 flex-1 truncate text-left hover:underline" onClick={() => props.onOpen(h.url)}>
                  {h.title ?? h.url}
                </button>
                <button type="button" className="text-subtle hover:text-fg" title="Remove" onClick={() => props.onRemoveHistory(h.url)}>
                  <X size={12} />
                </button>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}

function ResizeHandle(props: { onResize: (width: number) => void }) {
  return (
    <div
      className="absolute left-0 top-0 z-10 h-full w-1 cursor-col-resize hover:bg-accent/30"
      style={{ marginLeft: -2 }}
      onPointerDown={(e) => {
        e.preventDefault();
        const startX = e.clientX;
        const startW = (e.currentTarget.parentElement as HTMLElement).offsetWidth;
        const move = (ev: PointerEvent) =>
          props.onResize(Math.min(BROWSER_WIDTH_MAX, Math.max(BROWSER_WIDTH_MIN, startW - (ev.clientX - startX))));
        const up = () => {
          window.removeEventListener("pointermove", move);
          window.removeEventListener("pointerup", up);
        };
        window.addEventListener("pointermove", move);
        window.addEventListener("pointerup", up);
      }}
    />
  );
}
