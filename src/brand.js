import { h } from "./dom.js";

/** Product name. ARAHA matches the ARAHASOFT wordmark; Counselor stays gold italic serif. */
export function brandName(variant = "") {
  return h("span", { class: variant ? `brand-name ${variant}` : "brand-name" }, [
    h("span", { class: "brand-araha" }, "ARAHA"),
    h("span", { class: "brand-counselor" }, "Counselor"),
  ]);
}
