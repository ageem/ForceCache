import { DATA_TYPES, getSettings, saveSettings, getOrigin } from "./lib/core.js";
import { ext } from "./lib/browser.js";

const $ = (id) => document.getElementById(id);
const isMac = navigator.platform.toLowerCase().includes("mac");
if (!isMac) {
  $("clearKey").textContent = "Ctrl+Shift+E";
  document.querySelector('[data-mode="normal"] kbd').textContent = "Ctrl+R";
  document.querySelector('[data-mode="hard"] kbd').textContent = "Ctrl+Shift+R";
}

let tab;

function status(text, cls = "") {
  const el = $("status");
  el.className = cls;
  el.textContent = text;
}

const STAGE_LABEL = {
  clearing: "Clearing site data…",
  reloading: "Reloading…",
  done: "Done — reload complete",
  error: "Something went wrong"
};

function setStage(stage) {
  const box = $("progress");
  box.hidden = false;
  box.className = `progress ${stage}`;
  $("progressLabel").textContent = STAGE_LABEL[stage] || stage;
  const order = ["clearing", "reloading", "done"];
  const idx = order.indexOf(stage);
  $("progressSteps").querySelectorAll("span").forEach((el) => {
    const i = order.indexOf(el.dataset.step);
    el.classList.toggle("active", i === idx);
    el.classList.toggle("reached", i > -1 && i < idx || stage === "done");
  });
}

function run(mode, force = false) {
  $("actions").hidden = true;
  status("");
  setStage(mode === "clear" ? "clearing" : "reloading");

  const port = ext.runtime.connect({ name: "run" });
  port.onMessage.addListener((msg) => {
    if (msg.stage === "result") {
      port.disconnect();
      if (msg.blocked) {
        $("progress").hidden = true;
        $("actions").hidden = false;
        const el = $("status");
        el.className = "err";
        el.textContent = "Protected site. ";
        const b = document.createElement("button");
        b.textContent = "Clear anyway";
        b.onclick = () => run(mode, true);
        el.append(b);
      } else if (msg.ok) {
        setStage("done");
        setTimeout(() => window.close(), 700);
      } else {
        setStage("error");
        status(msg.error || "Something went wrong", "err");
        setTimeout(() => {
          $("progress").hidden = true;
          $("actions").hidden = false;
        }, 1600);
      }
      return;
    }
    setStage(msg.stage);
  });
  port.postMessage({ type: "run", mode, tabId: tab.id, force });
}

async function init() {
  [tab] = await ext.tabs.query({ active: true, currentWindow: true });
  const origin = getOrigin(tab?.url || "");
  $("site").textContent = origin ? new URL(origin).host : "Not an http(s) page — hard reload only";
  if (!origin) document.querySelector('[data-mode="clear"]').disabled = true;

  const s = await getSettings();
  const chips = $("chips");
  for (const t of DATA_TYPES) {
    const label = document.createElement("label");
    label.className = "chip" + (t.danger ? " danger" : "");
    label.title = t.hint;
    label.innerHTML = '<input type="checkbox" /><span></span>';
    label.querySelector("span").textContent = t.label;
    const input = label.querySelector("input");
    input.checked = s.clear[t.key];
    input.onchange = () => saveSettings({ clear: { [t.key]: input.checked } });
    chips.append(label);
  }

  $("allTabs").checked = s.allTabs;
  $("allTabs").onchange = (e) => saveSettings({ allTabs: e.target.checked });
  $("scope").checked = s.scope === "site";
  $("scope").onchange = (e) => saveSettings({ scope: e.target.checked ? "site" : "origin" });

  const { on: noCacheOn } = await ext.runtime.sendMessage({ type: "getNoCache", tabId: tab.id });
  $("noCache").checked = noCacheOn;
  $("noCache").disabled = !origin;
  $("noCache").onchange = async (e) => {
    await ext.runtime.sendMessage({ type: "setNoCache", tabId: tab.id, on: e.target.checked });
    status(e.target.checked ? "Cache disabled for this tab" : "Cache re-enabled", "ok");
  };
}

document.querySelectorAll(".actions button").forEach((b) => (b.onclick = () => run(b.dataset.mode)));
$("openOptions").onclick = () => ext.runtime.openOptionsPage();
init();
