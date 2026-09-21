import { Lock, RotateCw, Unlock } from "lucide-react";
import type { BrowserTabSnapshot } from "../../types.js";
import { cn } from "../ui/primitives.js";
import { DEVICE_PRESETS, ZOOM_LADDER } from "./browserUiConstants.js";

export function BrowserDeviceToolbar(props: {
  tab: BrowserTabSnapshot;
  aspectLocked: boolean;
  onAspectLockedChange: (locked: boolean) => void;
  onViewport: (viewport: BrowserTabSnapshot["viewport"]) => void;
}) {
  const vp = props.tab.viewport;
  const presetValue = vp.presetId ?? (vp.mode === "fill" ? "responsive" : "freeform");

  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-line bg-elevated/40 px-2 py-1 text-xs text-muted">
      <label className="flex items-center gap-1">
        <span className="text-subtle">Device</span>
        <select
          className="max-w-[120px] rounded border border-line bg-canvas px-1 py-0.5 text-fg"
          value={presetValue}
          onChange={(e) => {
            const id = e.target.value;
            if (id === "freeform") {
              props.onViewport({ ...vp, mode: "freeform", presetId: null });
              return;
            }
            const preset = DEVICE_PRESETS.find((p) => p.id === id) ?? DEVICE_PRESETS[0];
            props.onViewport({
              mode: id === "responsive" ? "fill" : "preset",
              width: preset.width,
              height: preset.height,
              presetId: id === "responsive" ? null : id,
              zoom: vp.zoom,
            });
          }}
        >
          <option value="freeform">Freeform</option>
          {DEVICE_PRESETS.map((p) => (
            <option key={p.id} value={p.id}>{p.label}</option>
          ))}
        </select>
      </label>
      {vp.mode !== "fill" ? (
        <>
          <label className="flex items-center gap-0.5">
            W
            <input
              type="number"
              className="w-14 rounded border border-line bg-canvas px-1 py-0.5 text-fg"
              value={vp.width}
              min={240}
              onChange={(e) =>
                props.onViewport({ ...vp, mode: "freeform", presetId: null, width: Number(e.target.value) || vp.width })
              }
            />
          </label>
          <label className="flex items-center gap-0.5">
            H
            <input
              type="number"
              className="w-14 rounded border border-line bg-canvas px-1 py-0.5 text-fg"
              value={vp.height}
              min={240}
              onChange={(e) =>
                props.onViewport({ ...vp, mode: "freeform", presetId: null, height: Number(e.target.value) || vp.height })
              }
            />
          </label>
          <button
            type="button"
            className="rounded p-0.5 hover:bg-hover"
            title="Swap width and height"
            onClick={() => props.onViewport({ ...vp, width: vp.height, height: vp.width })}
          >
            <RotateCw size={12} />
          </button>
          <button
            type="button"
            className={cn("rounded p-0.5 hover:bg-hover", props.aspectLocked ? "text-accent-text" : "text-muted")}
            title={props.aspectLocked ? "Unlock aspect ratio" : "Lock aspect ratio"}
            onClick={() => props.onAspectLockedChange(!props.aspectLocked)}
          >
            {props.aspectLocked ? <Lock size={12} /> : <Unlock size={12} />}
          </button>
        </>
      ) : null}
      <label className="ml-auto flex items-center gap-1">
        <span className="text-subtle">Zoom</span>
        <select
          className="rounded border border-line bg-canvas px-1 py-0.5 text-fg"
          value={String(vp.zoom)}
          onChange={(e) => props.onViewport({ ...vp, zoom: Number.parseFloat(e.target.value) })}
        >
          {ZOOM_LADDER.map((z) => (
            <option key={z} value={z}>{Math.round(z * 100)}%</option>
          ))}
        </select>
      </label>
    </div>
  );
}
