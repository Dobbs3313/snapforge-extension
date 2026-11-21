import { BillingManager } from "./lib/billing.js";
import { BILLING_CONFIG } from "./lib/billing-config.js";

const billing = new BillingManager(BILLING_CONFIG);
let toastTimer = null;

function showToast(msg) {
  const el = document.getElementById("toast");
  el.textContent = msg;
  el.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove("show"), 2500);
}

function switchTab(name) {
  document.querySelectorAll(".tab-btn").forEach(b => b.classList.toggle("active", b.dataset.tab === name));
  document.querySelectorAll(".panel").forEach(p => p.classList.toggle("active", p.id === `panel-${name}`));
}

function injectRegionSelector() {
  if (document.getElementById("sf-region-overlay")) return;
  const ov = document.createElement("div");
  ov.id = "sf-region-overlay";
  ov.style.cssText = "position:fixed;inset:0;z-index:2147483647;cursor:crosshair;background:rgba(15,23,42,0.35);";
  const box = document.createElement("div");
  box.style.cssText = "position:fixed;border:2px solid #fb923c;background:rgba(251,146,60,0.14);display:none;";
  const tip = document.createElement("div");
  tip.textContent = "Drag to select region · Press Esc to cancel";
  tip.style.cssText = "position:fixed;top:16px;left:50%;transform:translateX(-50%);background:#0f172a;color:#f8fafc;padding:7px 14px;border-radius:8px;font:600 13px system-ui;border:1px solid #fb923c;";
  ov.append(box, tip);
  document.documentElement.appendChild(ov);

  let sx = 0, sy = 0, dragging = false;
  const cleanup = () => { ov.remove(); document.removeEventListener("keydown", onKey); };
  const onKey = (e) => { if (e.key === "Escape") cleanup(); };
  document.addEventListener("keydown", onKey);

  ov.addEventListener("mousedown", (e) => {
    dragging = true;
    sx = e.clientX; sy = e.clientY;
    box.style.display = "block";
    box.style.left = `${sx}px`; box.style.top = `${sy}px`;
    box.style.width = "0px"; box.style.height = "0px";
  });
  ov.addEventListener("mousemove", (e) => {
    if (!dragging) return;
    const x = Math.min(sx, e.clientX), y = Math.min(sy, e.clientY);
    const w = Math.abs(e.clientX - sx), h = Math.abs(e.clientY - sy);
    box.style.left = `${x}px`; box.style.top = `${y}px`;
    box.style.width = `${w}px`; box.style.height = `${h}px`;
  });
  ov.addEventListener("mouseup", (e) => {
    if (!dragging) return;
    dragging = false;
    const dpr = window.devicePixelRatio || 1;
    const rect = {
      x: Math.round(Math.min(sx, e.clientX) * dpr),
      y: Math.round(Math.min(sy, e.clientY) * dpr),
      w: Math.round(Math.abs(e.clientX - sx) * dpr),
      h: Math.round(Math.abs(e.clientY - sy) * dpr)
    };
    cleanup();
    if (rect.w > 10 && rect.h > 10) {
      setTimeout(() => chrome.runtime.sendMessage({ type: "SNAPFORGE_REGION_SELECTED", rect }), 80);
    }
  });
}

async function captureFullPage(tab) {
  const [{ result: metrics }] = await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: () => ({
      scrollHeight: Math.min(document.documentElement.scrollHeight, 12000),
      innerHeight: window.innerHeight,
      innerWidth: window.innerWidth,
      dpr: window.devicePixelRatio || 1,
      origY: window.scrollY
    })
  });
  const slices = [];
  for (let y = 0; y < metrics.scrollHeight; y += metrics.innerHeight) {
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: (posY) => window.scrollTo(0, posY),
      args: [y]
    });
    await new Promise(r => setTimeout(r, 260));
    const resp = await chrome.runtime.sendMessage({ type: "SNAPFORGE_CAPTURE_SLICE", windowId: tab.windowId });
    if (resp?.ok) slices.push({ y, dataUrl: resp.dataUrl });
  }
  await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: (origY) => window.scrollTo(0, origY),
    args: [metrics.origY]
  });

  await chrome.storage.local.set({
    sf_latest_capture: {
      slices,
      metrics,
      title: tab.title || "Full Page Capture",
      url: tab.url || "",
      at: Date.now()
    }
  });
  await chrome.tabs.create({ url: chrome.runtime.getURL("editor.html") });
}

async function init() {
  await billing.init();
  const syncTier = () => {
    const pill = document.getElementById("tierPill");
    pill.textContent = billing.isPro() ? "PRO" : "FREE";
    pill.classList.toggle("pro", billing.isPro());
  };
  syncTier();

  document.querySelectorAll(".tab-btn").forEach(b => b.addEventListener("click", () => switchTab(b.dataset.tab)));
  document.getElementById("tierPill").addEventListener("click", () => switchTab("pro"));
  billing.mountProPanel(document.getElementById("panel-pro"), { onToast: showToast, onTierChange: syncTier });

  document.getElementById("captureVisibleBtn").addEventListener("click", async () => {
    const res = await chrome.runtime.sendMessage({ type: "SNAPFORGE_CAPTURE_VISIBLE" });
    if (!res?.ok) showToast(res?.error || "Cannot capture this page.");
    else window.close();
  });

  document.getElementById("captureRegionBtn").addEventListener("click", async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id || !/^https?:/.test(tab.url || "")) {
      return showToast("Region select works on HTTP/HTTPS pages.");
    }
    await chrome.scripting.executeScript({ target: { tabId: tab.id }, func: injectRegionSelector });
    window.close();
  });

  document.getElementById("captureFullBtn").addEventListener("click", async () => {
    if (!billing.isPro()) {
      showToast("Full-page scrolling stitch requires SnapForge Pro.");
      return switchTab("pro");
    }
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id || !/^https?:/.test(tab.url || "")) return showToast("Open an HTTP/HTTPS page first.");
    showToast("Stitching full page...");
    await captureFullPage(tab);
    window.close();
  });

  document.getElementById("openLastBtn").addEventListener("click", () => {
    chrome.tabs.create({ url: chrome.runtime.getURL("editor.html") });
  });

  document.getElementById("startRecordBtn").addEventListener("click", () => {
    if (!billing.isPro()) {
      showToast("WebM video recorder requires SnapForge Pro.");
      return switchTab("pro");
    }
    const audio = document.getElementById("recordAudioToggle").checked ? "1" : "0";
    chrome.tabs.create({ url: chrome.runtime.getURL(`editor.html?mode=record&audio=${audio}`) });
  });
}

init();
