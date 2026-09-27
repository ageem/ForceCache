// Shared settings, storage helpers and origin utilities (used by the
// service worker, popup and options page).

import { ext } from "./browser.js";

export const SETTINGS_KEY = "forcecache_settings";
export const HISTORY_KEY = "forcecache_history";
export const MAX_HISTORY = 25;

export const DATA_TYPES = [
  { key: "cache", label: "HTTP cache", hint: "Images, JS, CSS, HTML" },
  { key: "cacheStorage", label: "Cache Storage", hint: "Service-worker caches" },
  { key: "serviceWorkers", label: "Service workers", hint: "Unregisters them" },
  { key: "localStorage", label: "Local storage", hint: "Flags, cached tokens" },
  { key: "indexedDB", label: "IndexedDB", hint: "App databases" },
  { key: "cookies", label: "Cookies", hint: "Logs you out of this site", danger: true }
];

export const DEFAULT_SETTINGS = {
  clickMode: "popup", // "popup" | "instant"
  clear: {
    cache: true,
    cacheStorage: true,
    serviceWorkers: true,
    localStorage: false,
    indexedDB: false,
    cookies: false
  },
  scope: "origin", // "origin" | "site" (adds www/apex variants)
  allTabs: false, // reload every open tab on the site
  toast: true,
  protectedHosts: [] // hosts that need a confirmation before clearing
};

export async function getSettings() {
  const stored = await ext.storage.local.get(SETTINGS_KEY);
  const s = stored[SETTINGS_KEY] || {};
  return {
    ...DEFAULT_SETTINGS,
    ...s,
    clear: { ...DEFAULT_SETTINGS.clear, ...(s.clear || {}) }
  };
}

export async function saveSettings(patch) {
  const current = await getSettings();
  const next = {
    ...current,
    ...patch,
    clear: { ...current.clear, ...(patch.clear || {}) }
  };
  await ext.storage.local.set({ [SETTINGS_KEY]: next });
  return next;
}

export function getOrigin(url) {
  try {
    const u = new URL(url);
    return u.protocol === "http:" || u.protocol === "https:" ? u.origin : null;
  } catch {
    return null;
  }
}

// Exact origins browsingData should target for the chosen scope.
export function originsFor(origin, scope) {
  if (scope !== "site") return [origin];
  const u = new URL(origin);
  const apex = u.hostname.replace(/^www\./, "");
  const hosts = new Set([u.hostname, apex, `www.${apex}`]);
  const port = u.port ? `:${u.port}` : "";
  const out = new Set();
  for (const h of hosts) {
    out.add(`http://${h}${port}`);
    out.add(`https://${h}${port}`);
  }
  return [...out];
}

export function isProtected(origin, hosts) {
  const host = new URL(origin).hostname;
  return (hosts || []).some((raw) => {
    const h = raw.trim().toLowerCase().replace(/^\*\./, "");
    return h && (host === h || host.endsWith(`.${h}`));
  });
}

export function selectedTypes(clear) {
  return DATA_TYPES.map((t) => t.key).filter((k) => clear[k]);
}

export function label(key) {
  return DATA_TYPES.find((t) => t.key === key)?.label ?? key;
}

export function timeAgo(ts) {
  const mins = Math.floor(Math.max(0, Date.now() - ts) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  return hrs < 24 ? `${hrs}h ago` : `${Math.floor(hrs / 24)}d ago`;
}
