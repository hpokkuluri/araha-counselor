import { h } from "./dom.js";
import { icon } from "./icons.js";
import { logo } from "./logo.js";
import { navigate } from "./nav.js";
import { themeButton } from "./theme.js";

const TABS = [
  ["home", "/home", "Home", "home"],
  ["plan", "/plan", "Plan", "plan"],
  ["essays", "/essays", "Essays", "essay"],
  ["study", "/study", "Study", "book"],
  ["more", "/settings", "More", "more"],
];

export function shell(root, { title, tab, back, tabs = true, brand = false }) {
  const content = h("div", { class: "wrap" });
  const main = h("main", { class: "main", id: "main" }, content);
  const bar = h("header", { class: "bar" }, [
    back ? h("button", {
      type: "button",
      class: "back",
      onClick: () => navigate(back),
      ariaLabel: "Back",
    }, [icon("back"), "Back"]) : null,
    brand ? h("div", { class: "brand-lockup" }, [
      h("span", { class: "brand-mark" }, logo()),
      h("div", {}, [
        h("b", { class: "product-name" }, ["ARAHA ", h("em", {}, "Counselor")]),
        h("small", {}, "Arahasoft"),
      ]),
    ]) : h("h1", { class: "bar-title" }, title || ""),
    themeButton(),
  ]);
  const tabbar = tabs ? h("nav", { class: "tabbar", ariaLabel: "Primary" }, TABS.map(([id, href, label, glyph]) => (
    h("button", {
      type: "button",
      class: tab === id ? "on" : "",
      "data-testid": `tab-${id}`,
      ariaLabel: label,
      "aria-current": tab === id ? "page" : null,
      onClick: () => navigate(href),
    }, [icon(glyph), h("span", {}, label)])
  ))) : null;
  const offline = h("div", { class: "offline", hidden: navigator.onLine }, "You're offline. Saved pages and your data still work on this device.");
  const node = h("div", { class: tabs ? "shell" : "shell no-tabs" }, [offline, bar, main, tabbar]);
  root.append(node);
  const onNet = () => { offline.hidden = navigator.onLine; };
  window.addEventListener("online", onNet);
  window.addEventListener("offline", onNet);
  return {
    content,
    destroy() {
      window.removeEventListener("online", onNet);
      window.removeEventListener("offline", onNet);
    },
  };
}
