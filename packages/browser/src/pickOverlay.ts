/** In-page pick mode: click an element, then call `window.heliconPickComplete(payload)`. */
export const HELICON_PICK_INIT_SCRIPT = `
(() => {
  if (window.__heliconPickListener) return;
  window.__heliconPickListener = true;
  document.addEventListener(
    "click",
    async (event) => {
      if (!window.__heliconPick) return;
      event.preventDefault();
      event.stopPropagation();
      const target = event.target;
      if (!(target instanceof Element)) return;
      const rect = target.getBoundingClientRect();
      const payload = {
        tag: target.tagName.toLowerCase(),
        selector: target.id ? "#" + CSS.escape(target.id) : target.tagName.toLowerCase(),
        text: (target.textContent || "").trim().slice(0, 200),
        rect: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
        comment: "",
      };
      if (typeof window.heliconPickComplete === "function") {
        await window.heliconPickComplete(payload);
      }
      window.__heliconPick = false;
      document.body.style.cursor = "";
    },
    true,
  );
})();
`;
