import { h } from "./dom.js";

let registration = null;
let refreshing = false;
const listeners = new Set();

export function versionLine() {
  const version = typeof __APP_VERSION__ === "string" ? __APP_VERSION__ : "1.0.0";
  const built = typeof __BUILD_TIME__ === "string" ? __BUILD_TIME__ : "";
  if (!built) return `Version ${version}`;
  const when = new Date(built).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
  return `Version ${version} · ${when}`;
}

function emit(ready) {
  listeners.forEach((fn) => fn(ready));
}

export function onUpdateReady(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function mountUpdateBanner() {
  const bar = h("div", { class: "update-banner", hidden: true, role: "status" }, [
    h("span", {}, "A new version is ready"),
    h("button", { type: "button", class: "btn gold update-refresh", onClick: () => applyUpdate() }, "Refresh"),
    h("button", {
      type: "button",
      class: "update-x",
      ariaLabel: "Dismiss",
      onClick: () => { bar.hidden = true; },
    }, "×"),
  ]);
  document.body.append(bar);
  onUpdateReady((ready) => { bar.hidden = !ready; });
}

function markReady(reg) {
  registration = reg || registration;
  if (registration?.waiting) emit(true);
}

export async function initUpdates() {
  if (!("serviceWorker" in navigator)) return;
  try {
    const { registerSW } = await import("virtual:pwa-register");
    registerSW({
      immediate: true,
      onNeedRefresh() { emit(true); },
      onRegisteredSW(_url, reg) { markReady(reg); },
    });
  } catch { /* dev server has no service worker */ }
  try { registration = await navigator.serviceWorker.getRegistration() || registration; } catch { /* ignore */ }
  markReady(registration);
}

export function applyUpdate() {
  const waiting = registration?.waiting;
  if (!waiting) return;
  if (!refreshing) {
    refreshing = true;
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      window.location.reload();
    });
  }
  waiting.postMessage({ type: "SKIP_WAITING" });
}

export async function checkForUpdates() {
  const line = versionLine();
  if (!("serviceWorker" in navigator)) {
    return { latest: true, message: `You're on the latest version. ${line}` };
  }
  registration = await navigator.serviceWorker.getRegistration() || registration;
  if (!registration) {
    return { latest: true, message: `You're on the latest version. ${line}` };
  }
  if (registration.waiting) {
    applyUpdate();
    return { updating: true, message: "Refreshing to the new version…" };
  }
  const updated = await waitForInstall(registration);
  if (updated) {
    applyUpdate();
    return { updating: true, message: "Refreshing to the new version…" };
  }
  return { latest: true, message: `You're on the latest version. ${line}` };
}

function waitForInstall(reg) {
  return new Promise((resolve) => {
    let settled = false;
    const finish = (value) => {
      if (settled) return;
      settled = true;
      resolve(value);
    };
    const watch = (worker) => {
      if (!worker) return;
      worker.addEventListener("statechange", () => {
        if (worker.state === "installed" && navigator.serviceWorker.controller) finish(true);
      });
    };
    reg.addEventListener("updatefound", () => watch(reg.installing));
    reg.update().then(() => {
      if (reg.waiting) finish(true);
    }).catch(() => finish(false));
    setTimeout(() => finish(Boolean(reg.waiting)), 2500);
  });
}
