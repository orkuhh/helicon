"use client";

import { ArrowRight, MagnifyingGlass } from "@phosphor-icons/react";
import { Command } from "cmdk";
import { useRouter } from "next/navigation";
import { Dialog } from "radix-ui";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ICONS } from "./icons";
import { buttonClass, cn } from "../ui";
import { trackEvent } from "@/lib/client-analytics";
import { searchDocs, type SearchDoc } from "@/lib/seo/search-core";
import { useVisitorOs } from "@/lib/use-visitor-os";

/*
 * The ⌘K palette for the site. Adapted from the product's own CommandPalette (cmdk inside a
 * dialog, same row height, group headings and selection colour), so searching helicon.sh feels
 * like searching inside Helicon. Ranking is ours, not cmdk's: `shouldFilter` is off and every
 * keystroke goes through the same scorer the /search page uses.
 */

const GROUP =
  "[&_[cmdk-group-heading]]:px-2.5 [&_[cmdk-group-heading]]:pt-2.5 [&_[cmdk-group-heading]]:pb-1 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-subtle";
const ITEM =
  "flex min-h-11 cursor-default items-center gap-3 rounded-lg px-2.5 py-2 text-sm text-fg outline-none select-none data-[selected=true]:bg-hover";

/** Shown before anything is typed: the pages most searches end up on anyway. */
const START = ["/muse-code-gui", "/muse-code-desktop-app", "/install", "/compare", "/features", "/guides"];

let indexPromise: Promise<SearchDoc[]> | null = null;
function loadIndex() {
  // One fetch per page load, shared by every open of the palette.
  indexPromise ??= fetch("/search-index.json")
    .then((r) => (r.ok ? r.json() : []))
    .catch(() => {
      indexPromise = null;
      return [];
    });
  return indexPromise;
}

function isTyping(target: EventTarget | null) {
  const el = target as HTMLElement | null;
  if (!el) return false;
  return el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName);
}

function Row({ doc, onSelect }: { doc: SearchDoc; onSelect: (url: string) => void }) {
  const Glyph = ICONS[doc.icon];
  return (
    <Command.Item value={doc.url} onSelect={() => onSelect(doc.url)} className={ITEM}>
      <span aria-hidden="true" className="flex size-7 shrink-0 items-center justify-center rounded-md bg-tint text-accent-text [&_svg]:size-4">
        <Glyph />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate">{doc.title}</span>
        <span className="block truncate text-xs text-subtle">{doc.description}</span>
      </span>
      <span className="shrink-0 text-xs text-subtle">{doc.section}</span>
    </Command.Item>
  );
}

export function SiteSearch({ className }: { className?: string }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [index, setIndex] = useState<SearchDoc[]>([]);
  const router = useRouter();
  const os = useVisitorOs();

  const openPalette = useCallback((source: string) => {
    setOpen(true);
    trackEvent("site_search_open", { source });
  }, []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      // The live product demos on the home page are their own little app; leave their keys alone.
      if ((event.target as HTMLElement | null)?.closest?.(".helicon-app")) return;
      const mod = event.metaKey || event.ctrlKey;
      if (mod && !event.shiftKey && !event.altKey && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setOpen((value) => !value);
      } else if (event.key === "/" && !mod && !isTyping(event.target)) {
        event.preventDefault();
        openPalette("slash");
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [openPalette]);

  useEffect(() => {
    if (!open) return;
    let alive = true;
    loadIndex().then((docs) => alive && setIndex(docs));
    return () => {
      alive = false;
    };
  }, [open]);

  const results = useMemo(() => (query.trim() ? searchDocs(index, query, 8) : []), [index, query]);
  const start = useMemo(
    () => START.map((url) => index.find((doc) => doc.url === url)).filter((doc): doc is SearchDoc => Boolean(doc)),
    [index],
  );

  const go = (url: string) => {
    trackEvent("site_search_select", { query, url });
    setOpen(false);
    setQuery("");
    router.push(url);
  };

  const trimmed = query.trim();

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setQuery("");
      }}
    >
      <Dialog.Trigger asChild>
        <button
          type="button"
          onClick={() => trackEvent("site_search_open", { source: "button" })}
          aria-label="Search the site"
          className={cn(buttonClass("ghost", "sm", "gap-2 px-2.5 text-muted max-xl:size-9 max-xl:px-0"), className)}
        >
          <MagnifyingGlass weight="bold" aria-hidden="true" />
          <span className="max-xl:sr-only">Search</span>
          {os ? (
            <kbd className="ml-1 hidden rounded-md bg-sunken px-1.5 py-0.5 font-mono text-[11px] text-subtle shadow-[inset_0_0_0_1px_var(--border)] xl:inline">
              {os === "macos" ? "⌘K" : "Ctrl K"}
            </kbd>
          ) : null}
        </button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="overlay-fade fixed inset-0 z-[300] bg-[oklch(0.1_0.01_255/0.45)]" />
        <Dialog.Content
          aria-describedby={undefined}
          className="modal-pop fixed top-[12%] left-1/2 z-[310] w-[min(620px,calc(100%-16px))] -translate-x-1/2 overflow-hidden rounded-2xl bg-raised text-fg shadow-pop outline-none"
        >
          <Dialog.Title className="sr-only">Search helicon.sh</Dialog.Title>
          <Command loop shouldFilter={false} label="Search helicon.sh">
            <div className="flex items-center gap-2.5 border-b border-line px-4">
              <MagnifyingGlass aria-hidden="true" className="size-4 shrink-0 text-subtle" />
              <Command.Input
                value={query}
                onValueChange={setQuery}
                placeholder="Search install guides, comparisons, features…"
                className="h-12 min-w-0 flex-1 bg-transparent text-base text-fg outline-none placeholder:text-subtle"
              />
              <kbd className="shrink-0 rounded-md bg-sunken px-1.5 py-0.5 font-mono text-[11px] text-subtle shadow-[inset_0_0_0_1px_var(--border)]">
                Esc
              </kbd>
            </div>
            <Command.List className="max-h-[min(460px,62vh)] overflow-y-auto p-1.5">
              {trimmed && index.length && !results.length ? (
                <p className="px-3 pt-6 pb-2 text-center text-sm text-muted">Nothing matches that on its own.</p>
              ) : null}

              {!trimmed ? (
                <Command.Group heading="Start here" className={GROUP}>
                  {start.map((doc) => (
                    <Row key={doc.url} doc={doc} onSelect={go} />
                  ))}
                </Command.Group>
              ) : (
                <Command.Group heading="Pages" className={GROUP}>
                  {results.map((doc) => (
                    <Row key={doc.url} doc={doc} onSelect={go} />
                  ))}
                </Command.Group>
              )}

              {trimmed ? (
                <Command.Group className={GROUP}>
                  <Command.Item
                    value={`__all:${trimmed}`}
                    onSelect={() => go(`/search?q=${encodeURIComponent(trimmed)}`)}
                    className={ITEM}
                  >
                    <span aria-hidden="true" className="flex size-7 shrink-0 items-center justify-center text-subtle">
                      <ArrowRight className="size-4" />
                    </span>
                    <span className="min-w-0 flex-1 truncate">
                      See every result for <span className="font-medium">“{trimmed}”</span>
                    </span>
                  </Command.Item>
                </Command.Group>
              ) : null}
            </Command.List>
          </Command>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
