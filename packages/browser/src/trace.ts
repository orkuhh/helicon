export interface BrowserTraceEvent {
  at: number;
  name: string;
  detail?: Record<string, unknown>;
}

/** Forwards browser engine events to server observability sink. */
export class BrowserTraceCollector {
  private readonly buffer: BrowserTraceEvent[] = [];

  constructor(private readonly sink?: (event: BrowserTraceEvent) => void) {}

  record(name: string, detail?: Record<string, unknown>): void {
    const event: BrowserTraceEvent = { at: Date.now(), name, detail };
    this.buffer.push(event);
    if (this.buffer.length > 500) {
      this.buffer.shift();
    }
    this.sink?.(event);
  }

  snapshot(): BrowserTraceEvent[] {
    return [...this.buffer];
  }
}
