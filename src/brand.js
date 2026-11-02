import { h } from "./dom.js";
import { logo } from "./logo.js";

/** Interview Edge row: 56px unboxed mark, ARAHASOFT™ beside it. */
export function companyRow() {
  return h("div", { class: "wl-brand" }, [
    logo(),
    h("div", {}, [h("b", {}, ["ARAHASOFT", h("sup", {}, "™")])]),
  ]);
}

/** Product name under that row. ARAHA is the wordmark; Counselor stays gold italic serif. */
export function brandName(variant = "") {
  return h("span", { class: variant ? `brand-name ${variant}` : "brand-name" }, [
    h("span", { class: "brand-araha" }, "ARAHA"),
    h("span", { class: "brand-counselor" }, "Counselor"),
  ]);
}
