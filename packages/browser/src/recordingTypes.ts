export interface RecordingFrameMeta {
  jpegBase64: string;
  cursor?: { x: number; y: number };
  keyLabel?: string;
}

export interface RecordingCompositorOptions {
  showMouse: boolean;
  showKeys: boolean;
}
