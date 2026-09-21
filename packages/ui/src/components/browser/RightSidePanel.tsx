import { useApp, useController } from "../../app/context.js";
import { FilesPanel } from "../files/FilesPanel.js";
import { BrowserPanel } from "./BrowserPanel.js";
import { cn } from "../ui/primitives.js";

/** Files | Browser tab strip (D3). */
export function RightSidePanel(props: { sessionId: string; cwd: string }) {
  const controller = useController();
  const tab = useApp((s) => s.prefs.rightSideTab);
  return (
    <div className="relative flex h-full min-h-0 shrink-0 flex-col">
      <div className="flex h-8 shrink-0 items-center gap-1 border-b border-line px-2 text-xs">
        {(["files", "browser"] as const).map((t) => (
          <button
            key={t}
            type="button"
            className={cn(
              "rounded px-2 py-1 capitalize",
              tab === t ? "bg-elevated font-medium text-fg" : "text-muted hover:bg-elevated/50",
            )}
            onClick={() => controller.setRightSideTab(t)}
          >
            {t}
          </button>
        ))}
      </div>
      <div className="min-h-0 flex-1">
        {tab === "files" ? <FilesPanel sessionId={props.sessionId} cwd={props.cwd} /> : <BrowserPanel sessionId={props.sessionId} />}
      </div>
    </div>
  );
}
