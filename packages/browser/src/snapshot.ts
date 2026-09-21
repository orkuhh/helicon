import type { AutomationSnapshot, ConsoleEntry, InteractiveNode, NetworkEntry } from "./types.js";

/** DOM extract aligned with t3code captureAutomationSnapshot (simplified faithful port). */
export const INTERACTIVE_EXTRACT_SCRIPT = `(() => {
  const sel = (el) => {
    if (el.id) return '#' + CSS.escape(el.id);
    const path = [];
    let node = el;
    while (node && node.nodeType === 1 && path.length < 6) {
      let part = node.tagName.toLowerCase();
      const parent = node.parentElement;
      if (parent) {
        const siblings = [...parent.children].filter((c) => c.tagName === node.tagName);
        if (siblings.length > 1) {
          part += ':nth-of-type(' + (siblings.indexOf(node) + 1) + ')';
        }
      }
      path.unshift(part);
      node = parent;
    }
    return path.join(' > ');
  };
  const visible = (el) => {
    const r = el.getBoundingClientRect();
    if (r.width < 2 || r.height < 2) return false;
    const st = getComputedStyle(el);
    return st.visibility !== 'hidden' && st.display !== 'none' && st.opacity !== '0';
  };
  const nodes = [];
  const candidates = document.querySelectorAll(
    'a,button,input,textarea,select,[role],[tabindex]:not([tabindex="-1"])'
  );
  for (const el of candidates) {
    if (!visible(el)) continue;
    const name = (el.getAttribute('aria-label') || el.innerText || el.getAttribute('placeholder') || '').trim().slice(0, 200);
    const role = el.getAttribute('role') || el.tagName.toLowerCase();
    const r = el.getBoundingClientRect();
    nodes.push({ role, name, selector: sel(el), rect: { x: r.x, y: r.y, width: r.width, height: r.height } });
    if (nodes.length >= 200) break;
  }
  const text = (document.body && document.body.innerText) ? document.body.innerText.slice(0, 20000) : '';
  return { interactive: nodes, visibleText: text };
})()`;

export interface SnapshotBuffers {
  console: ConsoleEntry[];
  network: NetworkEntry[];
}

export function buildAutomationSnapshot(
  base: {
    url: string;
    title: string;
    loading: boolean;
    pngBase64: string;
    axTree: unknown;
    extract: { interactive: InteractiveNode[]; visibleText: string };
  },
  buffers: SnapshotBuffers,
): AutomationSnapshot {
  return {
    url: base.url,
    title: base.title,
    loading: base.loading,
    visibleText: base.extract.visibleText,
    interactive: base.extract.interactive,
    axTree: base.axTree,
    console: buffers.console.slice(-200),
    network: buffers.network.slice(-200),
    pngBase64: base.pngBase64,
  };
}
