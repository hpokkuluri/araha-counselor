import "katex/dist/katex.min.css";
import "./styles.css";
import { startRouter } from "./router.js";
import { flush, restoreSession, signedIn } from "./session.js";
import { syncThemeColor, watchSystemTheme } from "./theme.js";
import { noteInterruptedLoad } from "./ai.js";
import { toast } from "./dom.js";

const splash = document.getElementById("splash");
const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
let closed = false;

function closeSplash() {
  if (closed) return;
  closed = true;
  splash?.classList.add("out");
  window.setTimeout(() => {
    splash?.remove();
    document.body.classList.remove("splashing");
    document.body.classList.add("app-ready");
    syncThemeColor();
  }, reduced ? 0 : 560);
}

document.querySelector("[data-testid=skip-splash]")?.addEventListener("click", closeSplash);
window.setTimeout(closeSplash, reduced ? 280 : 3300);

watchSystemTheme();
const interrupted = noteInterruptedLoad();
restoreSession().finally(() => {
  startRouter();
  if (interrupted) toast(interrupted);
});

document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "hidden" && signedIn()) flush();
});

if (import.meta.env.PROD) {
  import("virtual:pwa-register").then(({ registerSW }) => {
    registerSW({ immediate: true });
  }).catch(() => {});
}
