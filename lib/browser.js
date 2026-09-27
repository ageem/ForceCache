// Cross-browser compatibility shim. Firefox exposes the promise-based
// `browser` global; Chrome/Edge/Brave/etc. expose `chrome` (also
// promise-based for the APIs this extension uses). Everywhere else in
// the codebase imports `ext` from here instead of touching the global
// `chrome`/`browser` directly, so the browser split lives in one file.

export const ext = globalThis.browser ?? globalThis.chrome;

// Firefox's browsingData.remove() has no `origins` filter — it scopes by
// `hostnames` instead. Chromium-based browsers support `origins`, which
// is stricter (protocol + host + port), so we prefer it there.
export const isFirefox = typeof globalThis.browser !== "undefined";

export function browsingDataFilter(origins) {
  if (!isFirefox) return { origins };
  return { hostnames: [...new Set(origins.map((o) => new URL(o).hostname))] };
}

// Firefox didn't gain declarativeNetRequest session-rule support until
// v128 (mid-2024). Feature-detect rather than version-sniff.
export function supportsSessionRules() {
  return !!ext.declarativeNetRequest?.updateSessionRules;
}
