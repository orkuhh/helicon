import { invoke } from "@tauri-apps/api/core";

export function isDesktopShell(): boolean {
  return "__TAURI_INTERNALS__" in window;
}

export async function openBrowserPip(pipUrl: string): Promise<void> {
  if (!isDesktopShell()) {
    window.open(pipUrl, "_blank", "noopener,noreferrer,width=480,height=300");
    return;
  }
  await invoke("browser_pip_open", { pipUrl });
}

export async function closeBrowserPip(): Promise<void> {
  if (!isDesktopShell()) {
    return;
  }
  await invoke("browser_pip_close").catch(() => undefined);
}

/** Full-screen capture as base64 PNG (desktop only). */
export async function captureOsSnapshot(): Promise<string | null> {
  if (!isDesktopShell()) {
    return null;
  }
  try {
    return await invoke<string>("snap_shot_capture");
  } catch {
    return null;
  }
}
