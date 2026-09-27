# ForceCache

**Empty Cache and Hard Reload, one click, no DevTools.**
Scoped to the current site only, so clearing it never logs you out of
anything else — your CMS admin, your email, your other tabs.

<p align="center">
  <img src="docs/ForceCache01.png" width="360" alt="ForceCache popup — reload menu" />
  <img src="docs/ForceCache02.png" width="360" alt="ForceCache popup — clearing progress" />
</p>

Built for developers who live in Sitecore, Episerver, WordPress, or any
stack where the browser cache lies to you about whether your change
actually shipped.

## Why

Chrome's own "Empty Cache and Hard Reload" is buried behind a
right-click on the reload button, which only shows up once DevTools is
open. That's three steps and a context switch every time you want to
confirm a deploy. ForceCache puts it one click away, with more control
than Chrome's version gives you.

## Features

- **One-click menu** — Normal Reload, Hard Reload, or Empty Cache and
  Hard Reload, same mental model as Chrome's own reload button.
- **Live progress** — the popup shows exactly what's happening
  (clearing → reloading → done), not just a frozen button.
- **Pick what gets cleared** — HTTP cache, Cache Storage, service
  workers, localStorage, IndexedDB, or cookies. Always scoped to the
  current site, never the whole browser.
- **Disable cache on a tab** — same idea as the DevTools checkbox,
  automatically turned off when the tab closes.
- **Reload every open tab on a site** at once, optionally including
  `www` and apex hostname variants.
- **Protected sites list** — require a confirmation before clearing,
  so you don't accidentally nuke production.
- **Keyboard shortcuts** — `⌘⇧E` / `Ctrl+Shift+E` for empty cache +
  hard reload, `⌘⇧U` / `Ctrl+Shift+U` for a plain hard reload.
- **On-page toast + activity log**, light/dark theme, zero build step.

## Install

**Chrome / Edge / Brave / Arc / Opera / Vivaldi (from source):**
1. Clone or download this repo
2. Open `chrome://extensions` (or that browser's equivalent)
3. Enable **Developer mode** (top right)
4. Click **Load unpacked** → select the `ForceCache` folder

**Firefox (from source):**
1. Run `npm run build:firefox` (or use `manifest.firefox.json` directly)
2. Open `about:debugging#/runtime/this-firefox`
3. **Load Temporary Add-on** → pick `manifest.firefox.json` (or the
   zipped `dist/forcecache-firefox.zip`)

**Chrome Web Store / Firefox Add-ons / Edge Add-ons:** submissions are
in progress — this section will be updated with links once each is live.

## One codebase, every browser

Chrome, Edge, Brave, Arc, Opera and Vivaldi all run the same Chromium
extension platform, so they share `manifest.json` as-is. Firefox needs
its own manifest (`manifest.firefox.json`) because its background model
and `browsingData` API differ slightly — see [`lib/browser.js`](lib/browser.js)
for the small compatibility layer that papers over it. Everything else
(`background.js`, `lib/core.js`, the popup and options UI) is shared,
unmodified, across every browser.

```bash
npm run build           # builds dist/forcecache-chrome.zip + dist/forcecache-firefox.zip
npm run build:chrome    # just Chrome/Chromium
npm run build:firefox   # just Firefox
```

## Permissions, and why

| Permission | Used for |
|---|---|
| `browsingData` | Clearing cache/storage/cookies, scoped to the origin you trigger it on |
| `activeTab` / `<all_urls>` | Knowing the current tab's origin and reloading it |
| `scripting` | Injecting the small on-page confirmation toast |
| `declarativeNetRequest` | The "disable cache on this tab" toggle |
| `contextMenus` | The right-click page/icon menu |
| `storage` | Saving your settings and activity log, locally only |

See [`.github/PRIVACY.md`](.github/PRIVACY.md) — no data ever leaves
your browser.

## Structure

No bundler, no dependencies — the `npm run build` scripts just zip files.

```
manifest.json          Chromium manifest
manifest.firefox.json  Firefox manifest (background.scripts, gecko id, extra perms)
background.js          Background logic — clearing, reload, badges, menus
lib/core.js            Shared settings/helpers (ES module)
lib/browser.js         Chrome/Firefox API compatibility shim
popup.html/css/js      Toolbar dropdown
options.html/css/js    Settings page
styles.css             Shared design tokens (light/dark)
scripts/build.js        Packages dist/forcecache-<browser>.zip
```

## Contributing

Issues and PRs welcome — this is a free tool built to be genuinely
useful, not a product.

## License

[MIT](LICENSE)
