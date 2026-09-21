import { Button } from "../ui/primitives.js";

export function PreviewUnreachable(props: { code: string; onRetry: () => void }) {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-canvas p-6 text-center">
      <p className="text-lg font-semibold text-fg">This site can&apos;t be reached</p>
      <p className="max-w-sm text-sm text-muted">{props.code}</p>
      <Button onClick={props.onRetry}>Try again</Button>
    </div>
  );
}
