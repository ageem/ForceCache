// ForceCache — background service worker (Chrome/Edge/Brave/Arc/Opera)
// or background script (Firefox) — see lib/browser.js for the split.
import {
  HISTORY_KEY, MAX_HISTORY, SETTINGS_KEY, getSettings, getOrigin,
  originsFor, isProtected, selectedTypes, label
} from "./lib/core.js";
import { ext, isFirefox, browsingDataFilter, supportsSessionRules } from "./lib/browser.js";

const NO_CACHE_HEADERS = [
  { header: "Cache-Control", operation: "set", value: "no-cache, no-store" },
  { header: "Pragma", operation: "set", value: "no-cache" }
];

// ---------- toolbar behaviour ----------

async function applyClickMode() {
  const { clickMode } = await getSettings();
  await ext.action.setPopup({ popup: clickMode === "instant" ? "" : "popup.html" });
}

ext.storage.onChanged.addListener((changes) => {
  if (changes[SETTINGS_KEY]) applyClickMode();
});
applyClickMode();

// ---------- helpers ----------

async function logHistory(entry) {
  const stored = await ext.storage.local.get(HISTORY_KEY);
  const history = [entry, ...(stored[HISTORY_KEY] || [])].slice(0, MAX_HISTORY);
  await ext.storage.local.set({ [HISTORY_KEY]: history });
}

async function isNoCache(tabId) {
  if (supportsSessionRules()) {
    const rules = await ext.declarativeNetRequest.getSessionRules();
    return rules.some((r) => r.id === tabId + 1);
  }
  return noCacheTabsFallback.has(tabId);
}

async function refreshBadge(tabId) {
  try {
    const on = await isNoCache(tabId);
    await ext.action.setBadgeText({ text: on ? "NC" : "", tabId });
    if (on) await ext.action.setBadgeBackgroundColor({ color: "#b45309", tabId });
  } catch { /* tab gone */ }
}

async function flashBadge(text, color, tabId) {
  try {
    await ext.action.setBadgeText({ text, tabId });
    await ext.action.setBadgeBackgroundColor({ color, tabId });
    setTimeout(() => refreshBadge(tabId), 1400);
  } catch { /* tab gone */ }
}

function waitForTabComplete(tabId, timeoutMs = 8000) {
  return new Promise((resolve) => {
    let done = false;
    const finish = (r) => {
      if (done) return;
      done = true;
      ext.tabs.onUpdated.removeListener(listener);
      clearTimeout(timer);
      resolve(r);
    };
    const listener = (id, info) => {
      if (id === tabId && info.status === "complete") finish(true);
    };
    const timer = setTimeout(() => finish(false), timeoutMs);
    ext.tabs.onUpdated.addListener(listener);
  });
}

async function showToast(tabId, message) {
  try {
    await ext.scripting.executeScript({
      target: { tabId },
      args: [message],
      func: (msg) => {
        document.querySelectorAll(".__forcecache_toast").forEach((e) => e.remove());
        const el = document.createElement("div");
        el.className = "__forcecache_toast";
        el.textContent = msg;
        Object.assign(el.style, {
          position: "fixed", bottom: "20px", right: "20px", zIndex: 2147483647,
          background: "#1a1a1d", color: "#f2f2f3", border: "1px solid #34343a",
          borderLeft: "4px solid #ff5a3c", borderRadius: "10px", padding: "10px 14px",
          font: "13px/1.3 -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
          boxShadow: "0 8px 24px rgba(0,0,0,.35)", opacity: "0",
          transform: "translateY(8px)", pointerEvents: "none",
          transition: "opacity 160ms ease, transform 160ms ease"
        });
        document.documentElement.appendChild(el);
        requestAnimationFrame(() => {
          el.style.opacity = "1";
          el.style.transform = "translateY(0)";
        });
        setTimeout(() => {
          el.style.opacity = "0";
          setTimeout(() => el.remove(), 220);
        }, 2000);
      }
    });
  } catch { /* restricted page */ }
}

// ---------- core action ----------

// mode: "normal" | "hard" | "clear"
// `report(stage)` is called as work progresses so a connected popup can
// show live progress instead of just sitting there grayed out.
// Returns { ok, blocked?, error?, cleared? }
async function run({ mode = "clear", tabId, force = false }, report = () => {}) {
  const settings = await getSettings();
  const tab = tabId
    ? await ext.tabs.get(tabId)
    : (await ext.tabs.query({ active: true, currentWindow: true }))[0];
  if (!tab?.id) return { ok: false, error: "No active tab" };

  const origin = getOrigin(tab.url || "");
  const bypassCache = mode !== "normal";

  if (!origin || mode !== "clear") {
    report("reloading");
    await ext.tabs.reload(tab.id, { bypassCache });
    await waitForTabComplete(tab.id);
    report("done");
    return { ok: true, cleared: [] };
  }

  if (!force && isProtected(origin, settings.protectedHosts)) {
    await flashBadge("🔒", "#6b7280", tab.id);
    return { ok: false, blocked: true, origin };
  }

  const types = selectedTypes(settings.clear);
  const entry = { origin, mode: "clear", types, ts: Date.now() };

  report("clearing");
  try {
    const dataTypes = Object.fromEntries(types.map((k) => [k, true]));
    await ext.browsingData.remove(
      browsingDataFilter(originsFor(origin, settings.scope)),
      dataTypes
    );
  } catch (e) {
    console.error("ForceCache: browsingData.remove failed", e);
    await flashBadge("!", "#d1242f", tab.id);
    await logHistory({ ...entry, ok: false });
    report("error");
    return { ok: false, error: String(e.message || e) };
  }

  report("reloading");
  const targets = settings.allTabs
    ? (await ext.tabs.query({ url: `${origin}/*` })).map((t) => t.id)
    : [tab.id];
  await Promise.all(targets.map((id) => ext.tabs.reload(id, { bypassCache: true })));

  await flashBadge("✓", "#1a7f37", tab.id);
  await logHistory({ ...entry, ok: true });

  const completed = await waitForTabComplete(tab.id);
  report("done");
  if (settings.toast && completed) {
    const what = types.map((k) => label(k).toLowerCase()).join(", ");
    await showToast(tab.id, `ForceCache — cleared ${what || "nothing"}, reloaded`);
  }
  return { ok: true, cleared: types };
}

// ---------- disable cache for a tab ----------
//
// Preferred path: declarativeNetRequest session rules (Chromium always,
// Firefox 128+). Fallback for older Firefox: blocking webRequest, which
// MV3 Firefox still permits with the "webRequestBlocking" permission —
// Chromium MV3 dropped it, which is exactly why the DNR path exists.

const noCacheTabsFallback = new Set();

function webRequestNoCacheListener(details) {
  if (!noCacheTabsFallback.has(details.tabId)) return {};
  const headers = (details.requestHeaders || []).filter(
    (h) => !/^(cache-control|pragma)$/i.test(h.name)
  );
  headers.push({ name: "Cache-Control", value: "no-cache, no-store" });
  headers.push({ name: "Pragma", value: "no-cache" });
  return { requestHeaders: headers };
}

function ensureWebRequestFallback() {
  if (!isFirefox || supportsSessionRules() || !ext.webRequest) return;
  if (ensureWebRequestFallback.installed) return;
  ensureWebRequestFallback.installed = true;
  ext.webRequest.onBeforeSendHeaders.addListener(
    webRequestNoCacheListener,
    { urls: ["<all_urls>"] },
    ["blocking", "requestHeaders"]
  );
}

async function setNoCache(tabId, on) {
  if (supportsSessionRules()) {
    await ext.declarativeNetRequest.updateSessionRules({
      removeRuleIds: [tabId + 1],
      addRules: on
        ? [{
            id: tabId + 1,
            priority: 1,
            action: { type: "modifyHeaders", requestHeaders: NO_CACHE_HEADERS },
            condition: {
              tabIds: [tabId],
              resourceTypes: [
                "main_frame", "sub_frame", "stylesheet", "script", "image",
                "font", "xmlhttprequest", "media", "other"
              ]
            }
          }]
        : []
    });
  } else {
    ensureWebRequestFallback();
    if (on) noCacheTabsFallback.add(tabId);
    else noCacheTabsFallback.delete(tabId);
  }
  await refreshBadge(tabId);
  if (on) await ext.tabs.reload(tabId, { bypassCache: true });
}

ext.tabs.onRemoved.addListener((tabId) => {
  noCacheTabsFallback.delete(tabId);
  if (supportsSessionRules()) {
    ext.declarativeNetRequest
      .updateSessionRules({ removeRuleIds: [tabId + 1] })
      .catch(() => {});
  }
});

// ---------- entry points ----------

ext.runtime.onMessage.addListener((msg, _sender, respond) => {
  if (msg.type === "run") run(msg).then(respond);
  else if (msg.type === "setNoCache") setNoCache(msg.tabId, msg.on).then(() => respond({ ok: true }));
  else if (msg.type === "getNoCache") isNoCache(msg.tabId).then((on) => respond({ on }));
  else return false;
  return true;
});

// The popup opens a port for "run" so it can show live progress
// (clearing → reloading → done) instead of just freezing while it waits.
ext.runtime.onConnect.addListener((port) => {
  if (port.name !== "run") return;
  port.onMessage.addListener((msg) => {
    run(msg, (stage) => {
      try { port.postMessage({ stage }); } catch { /* popup closed */ }
    }).then((result) => {
      try { port.postMessage({ ...result, stage: "result" }); } catch { /* popup closed */ }
    });
  });
});

// Only fires in "instant" mode (no popup set).
ext.action.onClicked.addListener(() => run({ mode: "clear" }));

ext.commands.onCommand.addListener(async (command) => {
  if (command === "hard-reload") return run({ mode: "clear" });
  if (command === "hard-reload-simple") return run({ mode: "hard" });
});

ext.runtime.onInstalled.addListener(() => {
  ext.contextMenus.removeAll(() => {
    ext.contextMenus.create({ id: "clear", title: "ForceCache: Empty Cache and Hard Reload", contexts: ["page", "action"] });
    ext.contextMenus.create({ id: "hard", title: "ForceCache: Hard Reload (no clearing)", contexts: ["page", "action"] });
  });
  applyClickMode();
});

ext.contextMenus.onClicked.addListener((info) => {
  run({ mode: info.menuItemId });
});
