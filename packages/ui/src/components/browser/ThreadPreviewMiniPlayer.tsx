import { X } from "lucide-react";
import { useController } from "../../app/context.js";
import { IconButton } from "../ui/primitives.js";

export function ThreadPreviewMiniPlayer(props: { sessionId: string; frameDataUrl: string | null }) {
  const controller = useController();
  return (
    <div className="fixed bottom-24 right-6 z-40 w-80 overflow-hidden rounded-lg border border-line bg-surface shadow-lg">
      <div className="flex h-8 items-center justify-between border-b border-line px-2 text-xs text-muted">
        <span>Browser preview</span>
        <IconButton label="Close mini player" onClick={() => controller.setBrowserMiniPlayer(props.sessionId, false)}>
          <X size={14} />
        </IconButton>
      </div>
      <div className="aspect-video bg-canvas">
        {props.frameDataUrl ? <img src={props.frameDataUrl} alt="" className="size-full object-contain" /> : null}
      </div>
    </div>
  );
}
