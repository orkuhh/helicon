const LOCALHOST_RE = /^(localhost|127\.0\.0\.1|\[::1\])(:\d+)?(\/.*)?$/i;

/** Normalize user-typed URLs the same way t3code does: http(s) only for navigation. */
export function normalizePreviewUrl(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) {
    return null;
  }
  if (trimmed === "about:blank") {
    return trimmed;
  }
  if (/^https?:\/\//i.test(trimmed)) {
    try {
      const u = new URL(trimmed);
      if (u.protocol !== "http:" && u.protocol !== "https:") {
        return null;
      }
      return u.toString();
    } catch {
      return null;
    }
  }
  if (LOCALHOST_RE.test(trimmed) || /^[^:]+:\d+/.test(trimmed)) {
    const withHost = trimmed.includes("://") ? trimmed : `http://${trimmed}`;
    try {
      return new URL(withHost).toString();
    } catch {
      return null;
    }
  }
  if (/^[a-z0-9.-]+\.[a-z]{2,}/i.test(trimmed)) {
    try {
      return new URL(`https://${trimmed}`).toString();
    } catch {
      return null;
    }
  }
  return null;
}

export function stripCredentials(url: string): string {
  try {
    const u = new URL(url);
    u.username = "";
    u.password = "";
    return u.toString();
  } catch {
    return url;
  }
}

export function collapseLoopbackHost(url: string): string {
  try {
    const u = new URL(url);
    if (u.hostname === "127.0.0.1" || u.hostname === "[::1]") {
      u.hostname = "local";
    }
    return stripCredentials(u.toString());
  } catch {
    return url;
  }
}

export function isAllowedNavigationUrl(url: string): boolean {
  if (url === "about:blank") {
    return true;
  }
  try {
    const u = new URL(url);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}
