import { Globe, Plus, RefreshCw, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { shallowEqual, useApp, useController } from "../../app/context.js";
import { useOverlayDragProps } from "../../app/frame.js";
import { DEFAULT_BROWSER_WIDTH, BROWSER_WIDTH_MIN, BROWSER_WIDTH_MAX } from "../../model/store.js";
import { Button, IconButton, Spinner, cn } from "../ui/primitives.js";
import { PreviewUnreachable } from "./PreviewUnreachable.js";

export function BrowserPanel(props: { sessionId: string }) {
  const controller = useController();
  const width = useApp((s) => s.prefs.browserWidth);
  const browser = useApp((s) => s.browser[props.sessionId] ?? null, shallowEqual);
  const [urlDraft, setUrlDraft] = useState("");
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

  return (
    <aside
      className="relative flex h-full min-h-0 shrink-0 flex-col bg-surface"
      style={{ width }}
      data-no-drag
    >
      <div {...drag} className="flex h-9 shrink-0 items-center gap-1 border-b border-line px-2">
        {browser?.tabs.map((tab) => (
          <button
            key={tab.tabId}
            type="button"
            className={cn(
              "flex max-w-[140px] items-center gap-1 rounded px-2 py-1 text-xs",
              tab.tabId === active?.tabId ? "bg-elevated text-fg" : "text-muted hover:bg-elevated/60",
            )}
            onClick={() => controller.setBrowserTab(props.sessionId, tab.tabId)}
          >
            <span className="truncate">{tab.title || tab.url || "New tab"}</span>
            <X
              size={12}
              className="shrink-0 opacity-60 hover:opacity-100"
              onClick={(e) => {
                e.stopPropagation();
                void controller.closeBrowserTab(props.sessionId, tab.tabId);
              }}
            />
          </button>
        ))}
        <IconButton label="New browser tab" onClick={() => void controller.openBrowserTab(props.sessionId)}>
          <Plus size={14} />
        </IconButton>
      </div>
      <div className="flex items-center gap-1 border-b border-line px-2 py-1.5">
        <IconButton
          label="Reload"
          onClick={() => active && void controller.reloadBrowserTab(props.sessionId, active.tabId)}
        >
          <RefreshCw size={14} />
        </IconButton>
        <input
          className="min-w-0 flex-1 rounded border border-line bg-canvas px-2 py-1 text-xs font-mono text-fg"
          value={urlDraft || active?.url || ""}
          onChange={(e) => setUrlDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && active) {
              void controller.navigateBrowser(props.sessionId, active.tabId, urlDraft || active.url);
              setUrlDraft("");
            }
          }}
          placeholder="https://"
        />
        <Button
          size="sm"
          onClick={() => active && void controller.navigateBrowser(props.sessionId, active.tabId, urlDraft || active.url)}
        >
          Go
        </Button>
      </div>
      <div className="relative min-h-0 flex-1 bg-canvas">
        {browser?.loading ? (
          <div className="absolute inset-0 grid place-items-center">
            <Spinner />
          </div>
        ) : null}
        {active?.failed ? <PreviewUnreachable code={active.failed} onRetry={() => void controller.reloadBrowserTab(props.sessionId, active.tabId)} /> : null}
        {!active?.failed && !browser?.tabs.length ? (
          <EmptyBrowser
            history={browser?.history ?? []}
            discovered={browser?.discovered ?? []}
            onOpen={(url) => void controller.openBrowserTab(props.sessionId, url)}
          />
        ) : (
          <canvas
            ref={canvasRef}
            className="h-full w-full cursor-crosshair"
            onPointerDown={() => active && controller.browserHumanInput(props.sessionId, active.tabId)}
          />
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
              <li key={h.url}>
                <button type="button" className="text-left hover:underline" onClick={() => props.onOpen(h.url)}>
                  {h.title ?? h.url}
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
        const move = (ev: PointerEvent) => props.onResize(Math.min(BROWSER_WIDTH_MAX, Math.max(BROWSER_WIDTH_MIN, startW - (ev.clientX - startX))));
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
