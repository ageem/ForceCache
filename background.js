// ForceCache — background service worker
import {
  HISTORY_KEY, MAX_HISTORY, SETTINGS_KEY, getSettings, getOrigin,
  originsFor, isProtected, selectedTypes, label
} from "./lib/core.js";

const NO_CACHE_HEADERS = [
  { header: "Cache-Control", operation: "set", value: "no-cache, no-store" },
  { header: "Pragma", operation: "set", value: "no-cache" }
];

// ---------- toolbar behaviour ----------

async function applyClickMode() {
  const { clickMode } = await getSettings();
  await chrome.action.setPopup({ popup: clickMode === "instant" ? "" : "popup.html" });
}

chrome.storage.onChanged.addListener((changes) => {
  if (changes[SETTINGS_KEY]) applyClickMode();
});
applyClickMode();

// ---------- helpers ----------

async function logHistory(entry) {
  const stored = await chrome.storage.local.get(HISTORY_KEY);
  const history = [entry, ...(stored[HISTORY_KEY] || [])].slice(0, MAX_HISTORY);
  await chrome.storage.local.set({ [HISTORY_KEY]: history });
}

async function isNoCache(tabId) {
  const rules = await chrome.declarativeNetRequest.getSessionRules();
  return rules.some((r) => r.id === tabId + 1);
}

async function refreshBadge(tabId) {
  try {
    const on = await isNoCache(tabId);
    await chrome.action.setBadgeText({ text: on ? "NC" : "", tabId });
    if (on) await chrome.action.setBadgeBackgroundColor({ color: "#b45309", tabId });
  } catch { /* tab gone */ }
}

async function flashBadge(text, color, tabId) {
  try {
    await chrome.action.setBadgeText({ text, tabId });
    await chrome.action.setBadgeBackgroundColor({ color, tabId });
    setTimeout(() => refreshBadge(tabId), 1400);
  } catch { /* tab gone */ }
}

function waitForTabComplete(tabId, timeoutMs = 8000) {
  return new Promise((resolve) => {
    let done = false;
    const finish = (r) => {
      if (done) return;
      done = true;
      chrome.tabs.onUpdated.removeListener(listener);
      clearTimeout(timer);
      resolve(r);
    };
    const listener = (id, info) => {
      if (id === tabId && info.status === "complete") finish(true);
    };
    const timer = setTimeout(() => finish(false), timeoutMs);
    chrome.tabs.onUpdated.addListener(listener);
  });
}

async function showToast(tabId, message) {
  try {
    await chrome.scripting.executeScript({
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
    ? await chrome.tabs.get(tabId)
    : (await chrome.tabs.query({ active: true, currentWindow: true }))[0];
  if (!tab?.id) return { ok: false, error: "No active tab" };

  const origin = getOrigin(tab.url || "");
  const bypassCache = mode !== "normal";

  if (!origin || mode !== "clear") {
    report("reloading");
    await chrome.tabs.reload(tab.id, { bypassCache });
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
    await chrome.browsingData.remove(
      { origins: originsFor(origin, settings.scope) },
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
    ? (await chrome.tabs.query({ url: `${origin}/*` })).map((t) => t.id)
    : [tab.id];
  await Promise.all(targets.map((id) => chrome.tabs.reload(id, { bypassCache: true })));

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

async function setNoCache(tabId, on) {
  await chrome.declarativeNetRequest.updateSessionRules({
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
  await refreshBadge(tabId);
  if (on) await chrome.tabs.reload(tabId, { bypassCache: true });
}

chrome.tabs.onRemoved.addListener((tabId) => {
  chrome.declarativeNetRequest
    .updateSessionRules({ removeRuleIds: [tabId + 1] })
    .catch(() => {});
});

// ---------- entry points ----------

chrome.runtime.onMessage.addListener((msg, _sender, respond) => {
  if (msg.type === "run") run(msg).then(respond);
  else if (msg.type === "setNoCache") setNoCache(msg.tabId, msg.on).then(() => respond({ ok: true }));
  else return false;
  return true;
});

// The popup opens a port for "run" so it can show live progress
// (clearing → reloading → done) instead of just freezing while it waits.
chrome.runtime.onConnect.addListener((port) => {
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
chrome.action.onClicked.addListener(() => run({ mode: "clear" }));

chrome.commands.onCommand.addListener(async (command) => {
  if (command === "hard-reload") return run({ mode: "clear" });
  if (command === "hard-reload-simple") return run({ mode: "hard" });
});

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({ id: "clear", title: "ForceCache: Empty Cache and Hard Reload", contexts: ["page", "action"] });
    chrome.contextMenus.create({ id: "hard", title: "ForceCache: Hard Reload (no clearing)", contexts: ["page", "action"] });
  });
  applyClickMode();
});

chrome.contextMenus.onClicked.addListener((info) => {
  run({ mode: info.menuItemId });
});
