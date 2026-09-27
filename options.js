import { DATA_TYPES, HISTORY_KEY, getSettings, saveSettings, timeAgo, label } from "./lib/core.js";

const $ = (id) => document.getElementById(id);

async function renderHistory() {
  const { [HISTORY_KEY]: history = [] } = await chrome.storage.local.get(HISTORY_KEY);
  const list = $("historyList");
  list.replaceChildren();
  if (!history.length) {
    const li = document.createElement("li");
    li.className = "muted";
    li.textContent = "Nothing yet — trigger a reload to see it here.";
    list.append(li);
    return;
  }
  for (const h of history) {
    const li = document.createElement("li");
    if (h.ok === false) li.className = "failed";
    const origin = document.createElement("span");
    origin.className = "origin";
    origin.textContent = h.origin;
    const meta = document.createElement("span");
    meta.className = "meta";
    const what = (h.types || []).map((k) => label(k)).join(", ") || "cache";
    meta.textContent = `${h.ok === false ? "failed · " : ""}${what} · ${timeAgo(h.ts)}`;
    li.append(origin, meta);
    list.append(li);
  }
}

async function init() {
  $("ver").textContent = `v${chrome.runtime.getManifest().version}`;
  const s = await getSettings();

  for (const t of DATA_TYPES) {
    const el = document.createElement("label");
    el.className = "chip" + (t.danger ? " danger" : "");
    el.innerHTML = "<input type=\"checkbox\" /><span><b></b><small></small></span>";
    el.querySelector("b").textContent = t.label;
    el.querySelector("small").textContent = t.hint;
    const input = el.querySelector("input");
    input.checked = s.clear[t.key];
    input.onchange = () => saveSettings({ clear: { [t.key]: input.checked } });
    $("chips").append(el);
  }

  const bind = (id, get, set) => {
    const el = $(id);
    el.checked = get(s);
    el.onchange = () => saveSettings(set(el.checked));
  };
  bind("popupMode", (x) => x.clickMode === "popup", (v) => ({ clickMode: v ? "popup" : "instant" }));
  bind("scope", (x) => x.scope === "site", (v) => ({ scope: v ? "site" : "origin" }));
  bind("allTabs", (x) => x.allTabs, (v) => ({ allTabs: v }));
  bind("toast", (x) => x.toast, (v) => ({ toast: v }));

  const box = $("protected");
  box.value = s.protectedHosts.join("\n");
  box.onchange = () =>
    saveSettings({ protectedHosts: box.value.split("\n").map((l) => l.trim()).filter(Boolean) });

  renderHistory();
}

$("clearHistory").onclick = async () => {
  await chrome.storage.local.set({ [HISTORY_KEY]: [] });
  renderHistory();
};
$("editShortcuts").onclick = () => chrome.tabs.create({ url: "chrome://extensions/shortcuts" });
init();
