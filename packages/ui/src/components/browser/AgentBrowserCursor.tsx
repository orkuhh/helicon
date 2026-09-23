export function AgentBrowserCursor(props: { x: number; y: number; visible: boolean }) {
  if (!props.visible) {
    return null;
  }
  return (
    <div
      className="pointer-events-none absolute z-20 size-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-accent bg-accent/30 transition-transform duration-150"
      style={{ left: props.x, top: props.y }}
      aria-hidden
    />
  );
}
