/** Draw a cursor ring and optional key label onto raw RGBA JPEG decode buffer. */
export function drawRecordingOverlay(
  width: number,
  height: number,
  data: Uint8Array,
  meta: { cursor?: { x: number; y: number }; keyLabel?: string },
): void {
  if (meta.cursor) {
    drawCircle(data, width, height, meta.cursor.x, meta.cursor.y, 10, [255, 64, 64, 200]);
  }
  if (meta.keyLabel) {
    drawLabel(data, width, height, 16, height - 28, meta.keyLabel);
  }
}

function drawCircle(
  data: Uint8Array,
  w: number,
  h: number,
  cx: number,
  cy: number,
  r: number,
  color: [number, number, number, number],
): void {
  const x0 = Math.max(0, Math.floor(cx - r));
  const x1 = Math.min(w - 1, Math.ceil(cx + r));
  const y0 = Math.max(0, Math.floor(cy - r));
  const y1 = Math.min(h - 1, Math.ceil(cy + r));
  for (let y = y0; y <= y1; y += 1) {
    for (let x = x0; x <= x1; x += 1) {
      const dx = x - cx;
      const dy = y - cy;
      if (dx * dx + dy * dy <= r * r) {
        setPx(data, w, x, y, color);
      }
    }
  }
}

function drawLabel(data: Uint8Array, w: number, h: number, x: number, y: number, text: string): void {
  const label = text.slice(0, 24);
  for (let i = 0; i < label.length; i += 1) {
    const px = x + i * 8;
    if (px + 6 >= w || y + 10 >= h) {
      break;
    }
    fillRect(data, w, px, y, 7, 12, [0, 0, 0, 180]);
    fillRect(data, w, px + 1, y + 1, 5, 10, [255, 255, 255, 220]);
  }
}

function fillRect(data: Uint8Array, w: number, x: number, y: number, rw: number, rh: number, c: [number, number, number, number]): void {
  for (let dy = 0; dy < rh; dy += 1) {
    for (let dx = 0; dx < rw; dx += 1) {
      setPx(data, w, x + dx, y + dy, c);
    }
  }
}

function setPx(data: Uint8Array, w: number, x: number, y: number, c: [number, number, number, number]): void {
  const i = (y * w + x) * 4;
  const a = c[3] / 255;
  data[i] = Math.round(data[i] * (1 - a) + c[0] * a);
  data[i + 1] = Math.round(data[i + 1] * (1 - a) + c[1] * a);
  data[i + 2] = Math.round(data[i + 2] * (1 - a) + c[2] * a);
  data[i + 3] = 255;
}
