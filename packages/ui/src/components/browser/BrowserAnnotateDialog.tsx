import { useState } from "react";
import { Button } from "../ui/primitives.js";

export function BrowserAnnotateDialog(props: {
  open: boolean;
  selectorLabel: string;
  onCancel: () => void;
  onSubmit: (comment: string) => void;
}) {
  const [comment, setComment] = useState("");
  if (!props.open) {
    return null;
  }
  return (
    <div className="absolute inset-x-4 bottom-4 z-30 rounded-lg border border-line bg-surface p-3 shadow-xl">
      <p className="mb-2 text-xs text-muted">
        Annotate <span className="font-mono text-fg">{props.selectorLabel}</span> — your note attaches to the composer with a crop.
      </p>
      <textarea
        className="mb-2 w-full min-h-[72px] rounded border border-line bg-canvas px-2 py-1 text-sm text-fg"
        placeholder="What should change here?"
        value={comment}
        onChange={(e) => setComment(e.target.value)}
      />
      <div className="flex justify-end gap-2">
        <Button size="sm" variant="ghost" onClick={props.onCancel}>Cancel</Button>
        <Button
          size="sm"
          onClick={() => {
            props.onSubmit(comment);
            setComment("");
          }}
        >
          Attach to composer
        </Button>
      </div>
    </div>
  );
}
