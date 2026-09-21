import { Download, Ellipsis, Moon, Sun, Monitor, Wrench } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { BrowserTabSnapshot } from "../../types.js";
import { IconButton, cn } from "../ui/primitives.js";

export function BrowserMoreMenu(props: {
  tab: BrowserTabSnapshot;
  profileLabel: string;
  onAppearance: (scheme: BrowserTabSnapshot["colorScheme"]) => void;
  onDevTools: () => void;
  onDownloads: () => void;
  onHardReload: () => void;
  onClearCookies: () => void;
  onClearCache: () => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) {
      return;
    }
    const close = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    window.addEventListener("mousedown", close);
    return () => window.removeEventListener("mousedown", close);
  }, [open]);

  const schemes: { id: BrowserTabSnapshot["colorScheme"]; label: string; icon: typeof Sun }[] = [
    { id: "system", label: "System", icon: Monitor },
    { id: "light", label: "Light", icon: Sun },
    { id: "dark", label: "Dark", icon: Moon },
  ];

  return (
    <div className="relative" ref={ref}>
      <IconButton label="More" onClick={() => setOpen((v) => !v)}>
        <Ellipsis size={14} />
      </IconButton>
      {open ? (
        <div className="absolute right-0 top-full z-30 mt-1 min-w-[180px] rounded-md border border-line bg-surface py-1 shadow-lg text-xs">
          <div className="px-2 py-1 text-subtle">Appearance</div>
          {schemes.map((s) => (
            <button
              key={s.id}
              type="button"
              className={cn(
                "flex w-full items-center gap-2 px-2 py-1.5 text-left hover:bg-hover",
                props.tab.colorScheme === s.id && "text-accent-text",
              )}
              onClick={() => {
                props.onAppearance(s.id);
                setOpen(false);
              }}
            >
              <s.icon size={14} />
              {s.label}
            </button>
          ))}
          <hr className="my-1 border-line" />
          <button
            type="button"
            className="flex w-full items-center gap-2 px-2 py-1.5 text-left hover:bg-hover"
            onClick={() => {
              props.onHardReload();
              setOpen(false);
            }}
          >
            Hard reload
          </button>
          <button
            type="button"
            className="flex w-full items-center gap-2 px-2 py-1.5 text-left hover:bg-hover"
            onClick={() => {
              props.onDevTools();
              setOpen(false);
            }}
          >
            <Wrench size={14} />
            DevTools
          </button>
          <button
            type="button"
            className="flex w-full items-center gap-2 px-2 py-1.5 text-left hover:bg-hover"
            onClick={() => {
              props.onDownloads();
              setOpen(false);
            }}
          >
            <Download size={14} />
            Downloads
          </button>
          <hr className="my-1 border-line" />
          <div className="px-2 py-1 text-subtle">Clear data ({props.profileLabel})</div>
          <button
            type="button"
            className="flex w-full items-center gap-2 px-2 py-1.5 text-left hover:bg-hover"
            onClick={() => {
              props.onClearCookies();
              setOpen(false);
            }}
          >
            Clear cookies
          </button>
          <button
            type="button"
            className="flex w-full items-center gap-2 px-2 py-1.5 text-left hover:bg-hover"
            onClick={() => {
              props.onClearCache();
              setOpen(false);
            }}
          >
            Clear cache
          </button>
        </div>
      ) : null}
    </div>
  );
}
