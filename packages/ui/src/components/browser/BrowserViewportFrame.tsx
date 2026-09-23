import { useCallback, useRef, type ReactNode } from "react";
import type { BrowserTabSnapshot } from "../../types.js";
import { cn } from "../ui/primitives.js";

const MIN_DIM = 240;
const MAX_AREA = 3840 * 2160;

function clampSize(width: number, height: number): { width: number; height: number } {
  let w = Math.max(MIN_DIM, Math.round(width));
  let h = Math.max(MIN_DIM, Math.round(height));
  while (w * h > MAX_AREA) {
    w = Math.floor(w * 0.9);
    h = Math.floor(h * 0.9);
  }
  return { width: w, height: h };
}

type Handle = "n" | "s" | "e" | "w" | "ne" | "nw" | "se" | "sw";

export function BrowserViewportFrame(props: {
  tab: BrowserTabSnapshot;
  aspectLocked: boolean;
  onViewport: (viewport: BrowserTabSnapshot["viewport"]) => void;
  children: ReactNode;
}) {
  const ratioRef = useRef(props.tab.viewport.width / props.tab.viewport.height || 16 / 9);
  const resizable = props.tab.viewport.mode !== "fill";

  const startResize = useCallback(
    (handle: Handle, startX: number, startY: number) => {
      const startW = props.tab.viewport.width;
      const startH = props.tab.viewport.height;
      const aspect = ratioRef.current;

      const move = (ev: PointerEvent) => {
        const dx = ev.clientX - startX;
        const dy = ev.clientY - startY;
        let w = startW;
        let h = startH;
        if (handle.includes("e")) {
          w = startW + dx;
        }
        if (handle.includes("w")) {
          w = startW - dx;
        }
        if (handle.includes("s")) {
          h = startH + dy;
        }
        if (handle.includes("n")) {
          h = startH - dy;
        }
        if (props.aspectLocked) {
          if (handle === "e" || handle === "w") {
            h = w / aspect;
          } else if (handle === "n" || handle === "s") {
            w = h * aspect;
          } else {
            h = w / aspect;
          }
        }
        const next = clampSize(w, h);
        ratioRef.current = next.width / next.height;
        props.onViewport({
          ...props.tab.viewport,
          mode: "freeform",
          presetId: null,
          width: next.width,
          height: next.height,
        });
      };
      const up = () => {
        window.removeEventListener("pointermove", move);
        window.removeEventListener("pointerup", up);
      };
      window.addEventListener("pointermove", move);
      window.addEventListener("pointerup", up);
    },
    [props],
  );

  if (!resizable) {
    return <div className="relative h-full w-full">{props.children}</div>;
  }

  const handles: { id: Handle; className: string }[] = [
    { id: "n", className: "left-1/2 top-0 -translate-x-1/2 -translate-y-1/2 cursor-ns-resize" },
    { id: "s", className: "bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2 cursor-ns-resize" },
    { id: "e", className: "right-0 top-1/2 -translate-y-1/2 translate-x-1/2 cursor-ew-resize" },
    { id: "w", className: "left-0 top-1/2 -translate-y-1/2 -translate-x-1/2 cursor-ew-resize" },
    { id: "ne", className: "right-0 top-0 translate-x-1/2 -translate-y-1/2 cursor-nesw-resize" },
    { id: "nw", className: "left-0 top-0 -translate-x-1/2 -translate-y-1/2 cursor-nwse-resize" },
    { id: "se", className: "bottom-0 right-0 translate-x-1/2 translate-y-1/2 cursor-nwse-resize" },
    { id: "sw", className: "bottom-0 left-0 -translate-x-1/2 translate-y-1/2 cursor-nesw-resize" },
  ];

  return (
    <div className="relative flex h-full w-full items-center justify-center overflow-auto p-3">
      <div className="relative max-h-full max-w-full shadow-md ring-1 ring-line">
        {props.children}
        {handles.map((h) => (
          <div
            key={h.id}
            className={cn("absolute z-20 size-2.5 rounded-sm border border-line bg-surface", h.className)}
            onPointerDown={(e) => {
              e.preventDefault();
              e.stopPropagation();
              startResize(h.id, e.clientX, e.clientY);
            }}
          />
        ))}
      </div>
    </div>
  );
}
