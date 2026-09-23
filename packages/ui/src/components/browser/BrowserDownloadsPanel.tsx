import { useEffect, useState } from "react";
import { useController } from "../../app/context.js";
import { Button } from "../ui/primitives.js";

export function BrowserDownloadsPanel(props: { open: boolean; onClose: () => void }) {
  const controller = useController();
  const [items, setItems] = useState<{ id: string; suggestedFilename: string; url: string; path: string }[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!props.open) {
      return;
    }
    setLoading(true);
    void controller.client
      .listBrowserDownloads()
      .then((downloads) => setItems(downloads))
      .finally(() => setLoading(false));
  }, [props.open, controller]);

  if (!props.open) {
    return null;
  }

  return (
    <div className="absolute inset-x-2 bottom-2 z-20 max-h-48 overflow-auto rounded-md border border-line bg-surface p-2 text-xs shadow-lg">
      <div className="mb-2 flex items-center justify-between">
        <span className="font-medium text-fg">Downloads</span>
        <Button size="sm" variant="ghost" onClick={props.onClose}>Close</Button>
      </div>
      {loading ? <p className="text-muted">Loading…</p> : null}
      {!loading && items.length === 0 ? <p className="text-muted">No downloads yet.</p> : null}
      <ul className="space-y-1">
        {items.map((d) => (
          <li key={d.id} className="truncate text-muted" title={d.path}>
            <span className="text-fg">{d.suggestedFilename}</span>
            <span className="text-subtle"> — {d.url}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
