import { StrictMode, useState } from "react";
import { createRoot } from "react-dom/client";
import { HeliconApp } from "@helicon/ui";
import { Connect } from "./Connect.js";
import { desktopFrame, titlebarOverlay, bindDesktopZoom } from "./frame.js";
import { bindDesktopLinks } from "./links.js";
import { invoke } from "@tauri-apps/api/core";
import { bindBrowserDesktopShortcuts } from "./browserDesktopShortcuts.js";
import { openBrowserPip } from "./browserDesktop.js";
import { appNotifier } from "./notifier.js";
import { desktopUpdater } from "./updater.js";
import { WebHeliconClient } from "./webClient.js";
import "./theme.css";

bindDesktopZoom();
bindDesktopLinks();
bindBrowserDesktopShortcuts();

const root = document.getElementById("root");
if (!root) {
  throw new Error("Helicon: missing #root element.");
}

/**
 * `#/connect` picks the daemon this page talks to. It is read before the app mounts, because the
 * client reads its address once at module load and every open stream belongs to that address.
 */
function Root() {
  const [connecting, setConnecting] = useState(window.location.hash === "#/connect");
  if (connecting) {
    return (
      <Connect
        onDone={() => {
          setConnecting(false);
          // A reload, not a re-render: the client keeps its address and its stream from load time.
          window.location.replace(window.location.pathname);
        }}
      />
    );
  }
  return (
    <HeliconApp
      client={new WebHeliconClient()}
      openBrowserPip={openBrowserPip}
      openBrowserExternal={async (url) => {
        if ("__TAURI_INTERNALS__" in window) {
          await invoke("plugin:opener|open_url", { url });
        } else {
          window.open(url, "_blank", "noopener,noreferrer");
        }
      }}
      frame={desktopFrame()}
      titlebarOverlay={titlebarOverlay()}
      updater={desktopUpdater()}
      notifier={appNotifier()}
    />
  );
}

createRoot(root).render(
  <StrictMode>
    <Root />
  </StrictMode>,
);
