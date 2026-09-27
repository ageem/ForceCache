# Privacy Policy — ForceCache

ForceCache does not collect, store, or transmit any data, anywhere, ever.

- **No analytics, no telemetry, no network requests.** The extension never
  talks to a server — there isn't one.
- **All settings and activity history** (the last 25 reloads) are stored
  locally via `chrome.storage.local`, on your machine only, and are never
  synced or uploaded.
- **`browsingData` / `<all_urls>` permissions** are used only to clear
  cache, storage and cookies for the *site you explicitly trigger it on* —
  scoped to that origin — and to reload that tab. ForceCache never reads
  page content, browsing history, or data from other sites.
- Uninstalling the extension removes all locally stored settings and history.

Questions or concerns: open an issue at
https://github.com/ageem/ForceCache/issues
