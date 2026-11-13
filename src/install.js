import { h } from "./dom.js";

export function mountInstallHint() {
  const ios = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  const standalone = window.navigator.standalone === true || window.matchMedia("(display-mode: standalone)").matches;
  if (!ios || standalone) return;
  try { if (localStorage.getItem("ac-a2hs") === "hide") return; } catch { /* show the hint */ }
  const bar = h("div", { class: "update-banner", role: "status" }, [
    h("span", {}, "Add ARAHA to your Home Screen from the Share menu, then Add to Home Screen."),
    h("button", {
      type: "button",
      class: "update-x",
      ariaLabel: "Dismiss",
      onClick: () => {
        bar.remove();
        try { localStorage.setItem("ac-a2hs", "hide"); } catch { /* ignore */ }
      },
    }, "×"),
  ]);
  document.body.append(bar);
}
