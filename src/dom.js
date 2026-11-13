const PROP = new Set([
  "value", "checked", "disabled", "readOnly", "htmlFor", "tabIndex",
  "selected", "indeterminate", "colSpan", "rowSpan",
]);

export function h(tag, props, children) {
  const el = document.createElement(tag);
  append(el, children);
  if (props) apply(el, props);
  return el;
}

function append(el, children) {
  const nodes = [];
  const walk = (c) => {
    if (c == null || c === false) return;
    if (Array.isArray(c)) c.forEach(walk);
    else nodes.push(c);
  };
  walk(children);
  for (const n of nodes) el.append(n instanceof Node ? n : document.createTextNode(String(n)));
}

function apply(el, props) {
  for (const [k, v] of Object.entries(props)) {
    if (v == null || v === false) continue;
    if (k === "class") el.className = v;
    else if (k === "style" && typeof v === "object") Object.assign(el.style, v);
    else if (k.startsWith("on") && typeof v === "function") el.addEventListener(k.slice(2).toLowerCase(), v);
    else if (k === "dataset" && typeof v === "object") Object.assign(el.dataset, v);
    else if (PROP.has(k)) el[k] = v;
    else el.setAttribute(k === "ariaLabel" ? "aria-label" : k, v === true ? "" : String(v));
  }
}

export function clear(el) {
  el.replaceChildren();
}

export function field(label, control, hint) {
  const wrap = h("label", { class: "field" }, [
    h("span", { class: "lbl" }, label),
    control,
    hint ? h("small", { class: "hint" }, hint) : null,
  ]);
  const type = control?.type || "";
  const textLike = control?.tagName === "TEXTAREA" || (control?.tagName === "INPUT" && (type === "text" || type === "email" || type === "search" || type === ""));
  if (textLike && type !== "password") {
    import("./capture.js").then(({ captureControls }) => wrap.append(captureControls(control))).catch(() => {});
  }
  return wrap;
}

export function txt(props) {
  return h("input", { class: "txt", ...props });
}

export function area(props) {
  return h("textarea", { class: "txt", rows: props.rows || 4, ...props });
}

export function select(pairs, value, props = {}) {
  const el = h("select", { class: "txt", ...props }, pairs.map(([val, label]) => (
    h("option", { value: val }, label)
  )));
  el.value = value ?? "";
  return el;
}

let toastTimer = 0;
export function toast(message) {
  const el = document.getElementById("toast");
  if (!el) return;
  el.textContent = message;
  el.classList.add("on");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove("on"), 2600);
}

export function confirmBox({ title, message, confirmText = "Confirm", danger = false }) {
  return new Promise((resolve) => {
    const ok = h("button", { type: "button", class: danger ? "btn danger" : "btn primary" }, confirmText);
    const cancel = h("button", { type: "button", class: "btn ghost" }, "Cancel");
    const root = h("div", { class: "modal", role: "dialog", "aria-modal": "true" }, [
      h("div", { class: "modal-card" }, [
        h("h2", {}, title),
        h("p", {}, message),
        h("div", { class: "btn-row" }, [cancel, ok]),
      ]),
    ]);
    const close = (value) => { root.remove(); resolve(value); };
    cancel.addEventListener("click", () => close(false));
    ok.addEventListener("click", () => close(true));
    root.addEventListener("click", (e) => { if (e.target === root) close(false); });
    document.body.append(root);
    cancel.focus();
  });
}

export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

export async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const area = document.createElement("textarea");
    area.value = text;
    area.setAttribute("readonly", "");
    area.style.position = "fixed";
    area.style.left = "-9999px";
    document.body.append(area);
    area.select();
    const ok = document.execCommand("copy");
    area.remove();
    return ok;
  }
}
