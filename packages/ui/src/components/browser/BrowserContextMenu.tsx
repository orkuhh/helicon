import { useEffect, useRef } from "react";
import type { BrowserContextMenuAction, BrowserContextMenuProbe } from "../../types.js";

export function BrowserContextMenu(props: {
  open: boolean;
  x: number;
  y: number;
  probe: BrowserContextMenuProbe | null;
  pageUrl: string | null;
  onClose: () => void;
  onReload: () => void;
  onHardReload: () => void;
  onAction: (action: BrowserContextMenuAction) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!props.open) {
      return;
    }
    const close = () => props.onClose();
    window.addEventListener("mousedown", close);
    window.addEventListener("scroll", close, true);
    return () => {
      window.removeEventListener("mousedown", close);
      window.removeEventListener("scroll", close, true);
    };
  }, [props.open, props.onClose]);

  if (!props.open) {
    return null;
  }

  const probe = props.probe;
  const spell = probe?.spellSuggestions ?? [];

  return (
    <div
      ref={ref}
      className="fixed z-50 min-w-[180px] max-w-[240px] rounded-md border border-line bg-surface py-1 text-xs shadow-lg"
      style={{ left: props.x, top: props.y }}
      onMouseDown={(e) => e.stopPropagation()}
    >
      {spell.length > 0 ? (
        <>
          <div className="px-3 py-1 text-2xs font-semibold uppercase tracking-wide text-subtle">Spelling</div>
          {spell.map((s) => (
            <button
              key={s}
              type="button"
              className="block w-full px-3 py-1.5 text-left hover:bg-hover"
              onClick={() => {
                props.onAction({ type: "replaceSpelling", suggestion: s });
                props.onClose();
              }}
            >
              {s}
            </button>
          ))}
          <div className="my-1 border-t border-line" />
        </>
      ) : null}
      {probe?.canCut ? (
        <button type="button" className="block w-full px-3 py-1.5 text-left hover:bg-hover" onClick={() => { props.onAction("cut"); props.onClose(); }}>
          Cut
        </button>
      ) : null}
      {probe?.canCopy ? (
        <button type="button" className="block w-full px-3 py-1.5 text-left hover:bg-hover" onClick={() => { props.onAction("copy"); props.onClose(); }}>
          Copy
        </button>
      ) : null}
      {probe?.canPaste ? (
        <button type="button" className="block w-full px-3 py-1.5 text-left hover:bg-hover" onClick={() => { props.onAction("paste"); props.onClose(); }}>
          Paste
        </button>
      ) : null}
      {probe?.canSelectAll ? (
        <button type="button" className="block w-full px-3 py-1.5 text-left hover:bg-hover" onClick={() => { props.onAction("selectAll"); props.onClose(); }}>
          Select all
        </button>
      ) : null}
      {probe?.linkUrl ? (
        <button type="button" className="block w-full px-3 py-1.5 text-left hover:bg-hover" onClick={() => { props.onAction("copyLink"); props.onClose(); }}>
          Copy link
        </button>
      ) : props.pageUrl ? (
        <button
          type="button"
          className="block w-full px-3 py-1.5 text-left hover:bg-hover"
          onClick={() => {
            void navigator.clipboard.writeText(props.pageUrl ?? "");
            props.onClose();
          }}
        >
          Copy link
        </button>
      ) : null}
      {probe?.imageUrl ? (
        <button type="button" className="block w-full px-3 py-1.5 text-left hover:bg-hover" onClick={() => { props.onAction("copyImage"); props.onClose(); }}>
          Copy image address
        </button>
      ) : null}
      <div className="my-1 border-t border-line" />
      <button type="button" className="block w-full px-3 py-1.5 text-left hover:bg-hover" onClick={() => { props.onReload(); props.onClose(); }}>
        Reload
      </button>
      <button type="button" className="block w-full px-3 py-1.5 text-left hover:bg-hover" onClick={() => { props.onHardReload(); props.onClose(); }}>
        Hard reload
      </button>
    </div>
  );
}
