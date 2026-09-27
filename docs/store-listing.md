# Chrome Web Store listing — draft copy

Fill in the developer dashboard with this. Not committed logic, just
copy — edit freely before submitting.

## Short description (132 char max)

One-click "Empty Cache and Hard Reload" for the current site only — no DevTools required. Built for developers.

## Detailed description

ForceCache does what DevTools' "right-click the reload button → Empty
Cache and Hard Reload" does — without opening DevTools, and scoped to
the site you're on, so your other logins and tabs are untouched.

Built for developers working against CMSes and CDNs that love to serve
stale content (Sitecore, Episerver, WordPress, or anything behind a
cache layer) where you need to know, right now, whether your change
actually shipped.

FEATURES
• One-click menu: Normal Reload, Hard Reload, or Empty Cache and Hard
  Reload — same idea as Chrome's own reload button, minus the extra
  clicks.
• Live progress in the popup — see clearing → reloading → done, not
  just a frozen button.
• Choose exactly what gets cleared: HTTP cache, Cache Storage, service
  workers, localStorage, IndexedDB, or cookies. Always scoped to the
  current site only.
• Disable cache on a single tab, like the DevTools checkbox.
• Reload every open tab on a site at once.
• Protected-sites list — require confirmation before clearing
  production.
• Keyboard shortcuts for both modes.
• 100% local. No analytics, no network requests, nothing ever leaves
  your browser.

Open source: https://github.com/ageem/ForceCache

## Category
Developer Tools

## Language
English

## Screenshots needed (1280x800 or 640x400, PNG/JPEG)
1. Popup open on a real site (docs/ForceCache01.png works — resize/pad if needed)
2. Progress state (clearing/reloading animation)
3. Options page — data-type chips
4. Options page — protected sites / activity log

## Small promo tile (440x280) — optional but recommended
Dark background, icon + wordmark, tagline: "Hard reload. No DevTools."

## Privacy practices tab (required)
- Single purpose: "Clears cache/storage and reloads the current site on
  user action."
- Permission justifications: paste the table from README.md's
  Permissions section, one line each.
- Data usage: select "This item does not collect or use user data" —
  point reviewers to .github/PRIVACY.md if asked.

## Distribution
Public, no payment, no account required to use.
