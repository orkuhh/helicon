import type { Page } from "playwright-core";

/** Probe and run in-page editing actions at viewport coordinates (CDP screencast input path). */

export interface BrowserContextMenuProbe {
  canCut: boolean;
  canCopy: boolean;
  canPaste: boolean;
  canSelectAll: boolean;
  linkUrl: string | null;
  imageUrl: string | null;
  misspelledWord: string | null;
  spellSuggestions: string[];
}

export type BrowserContextMenuAction =
  | "cut"
  | "copy"
  | "paste"
  | "selectAll"
  | "copyLink"
  | "copyImage"
  | { type: "replaceSpelling"; suggestion: string };

export async function probeContextMenuAt(page: Page, x: number, y: number): Promise<BrowserContextMenuProbe> {
  return page.evaluate(
    ({ px, py }) => {
      const el = document.elementFromPoint(px, py);
      if (el instanceof HTMLElement) {
        el.focus();
      }
      const range = document.caretRangeFromPoint?.(px, py);
      if (range) {
        const sel = window.getSelection();
        sel?.removeAllRanges();
        sel?.addRange(range);
      }
      const link = el?.closest?.("a[href]");
      const img = el instanceof HTMLImageElement ? el : el?.closest?.("img");
      const linkUrl = link instanceof HTMLAnchorElement ? link.href : null;
      const imageUrl = img instanceof HTMLImageElement ? img.currentSrc || img.src : null;
      const canCut = document.queryCommandEnabled("cut");
      const canCopy = document.queryCommandEnabled("copy");
      const canPaste = document.queryCommandEnabled("paste");
      const canSelectAll = document.queryCommandEnabled("selectAll");
      let misspelledWord: string | null = null;
      const spellSuggestions: string[] = [];
      const editableTarget =
        (el instanceof HTMLElement && el.closest("input,textarea,[contenteditable=true]")) ??
        (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement ? el : null) ??
        (el instanceof HTMLElement && el.isContentEditable ? el : null);
      if (editableTarget instanceof HTMLElement) {
        const sel = window.getSelection();
        const text = sel?.toString() ?? "";
        if (text && /^[\w'-]+$/.test(text)) {
          misspelledWord = text;
        } else if (editableTarget instanceof HTMLInputElement || editableTarget instanceof HTMLTextAreaElement) {
          const value = editableTarget.value;
          const pos = editableTarget.selectionStart ?? 0;
          let start = pos;
          while (start > 0 && /[\w'-]/.test(value[start - 1])) {
            start -= 1;
          }
          let end = pos;
          while (end < value.length && /[\w'-]/.test(value[end])) {
            end += 1;
          }
          const word = value.slice(start, end);
          if (word.length > 1) {
            misspelledWord = word;
          }
        }
        const raw = editableTarget.getAttribute("data-helicon-spell-suggestions");
        if (raw) {
          try {
            const parsed = JSON.parse(raw) as unknown;
            if (Array.isArray(parsed)) {
              for (const s of parsed) {
                if (typeof s === "string") {
                  spellSuggestions.push(s);
                }
              }
            }
          } catch {
            /* ignore */
          }
        }
      }
      return {
        canCut,
        canCopy,
        canPaste,
        canSelectAll,
        linkUrl,
        imageUrl,
        misspelledWord,
        spellSuggestions,
      };
    },
    { px: x, py: y },
  );
}

export async function runContextMenuActionAt(
  page: Page,
  x: number,
  y: number,
  action: BrowserContextMenuAction,
): Promise<void> {
  if (action === "copyLink" || action === "copyImage") {
    const probe = await probeContextMenuAt(page, x, y);
    const text = action === "copyLink" ? probe.linkUrl : probe.imageUrl;
    if (text) {
      await page.evaluate((t) => navigator.clipboard.writeText(t), text);
    }
    return;
  }
  const suggestion = typeof action === "object" && action.type === "replaceSpelling" ? action.suggestion : undefined;
  const kind = typeof action === "string" ? action : "replaceSpelling";
  await page.evaluate(
    async ({ px, py, act, sug }) => {
      const el = document.elementFromPoint(px, py);
      if (el instanceof HTMLElement) {
        el.focus();
      }
      const range = document.caretRangeFromPoint?.(px, py);
      if (range) {
        const sel = window.getSelection();
        sel?.removeAllRanges();
        sel?.addRange(range);
      }
      if (act === "cut") {
        document.execCommand("cut");
        return;
      }
      if (act === "copy") {
        document.execCommand("copy");
        return;
      }
      if (act === "paste") {
        document.execCommand("paste");
        return;
      }
      if (act === "selectAll") {
        document.execCommand("selectAll");
        return;
      }
      if (act === "replaceSpelling" && typeof sug === "string") {
        const sel = window.getSelection();
        if (sel && sel.rangeCount > 0) {
          sel.deleteFromDocument();
          sel.getRangeAt(0).insertNode(document.createTextNode(sug));
          return;
        }
        const el = document.activeElement;
        if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
          const value = el.value;
          const start = el.selectionStart ?? 0;
          const end = el.selectionEnd ?? start;
          el.value = value.slice(0, start) + sug + value.slice(end);
          el.selectionStart = el.selectionEnd = start + sug.length;
          el.dispatchEvent(new Event("input", { bubbles: true }));
        }
      }
    },
    { px: x, py: y, act: kind, sug: suggestion },
  );
}
