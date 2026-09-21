import { useEffect, useRef, useState } from "react";

export function BrowserContextMenu(props: {
  open: boolean;
  x: number;
  y: number;
  onClose: () => void;
  onReload: () => void;
  onHardReload: () => void;
  onCopyLink: () => void;
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

  return (
    <div
      ref={ref}
      className="fixed z-50 min-w-[160px] rounded-md border border-line bg-surface py-1 text-xs shadow-lg"
      style={{ left: props.x, top: props.y }}
      onMouseDown={(e) => e.stopPropagation()}
    >
      <button type="button" className="block w-full px-3 py-1.5 text-left hover:bg-hover" onClick={() => { props.onReload(); props.onClose(); }}>
        Reload
      </button>
      <button type="button" className="block w-full px-3 py-1.5 text-left hover:bg-hover" onClick={() => { props.onHardReload(); props.onClose(); }}>
        Hard reload
      </button>
      <button type="button" className="block w-full px-3 py-1.5 text-left hover:bg-hover" onClick={() => { props.onCopyLink(); props.onClose(); }}>
        Copy link
      </button>
    </div>
  );
}
