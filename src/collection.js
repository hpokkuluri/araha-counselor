import { h, field, txt, area, select } from "./dom.js";
import { uid } from "./data.js";
import { update } from "./session.js";

export function mountCollection(parent, spec) {
  const host = h("div", { class: "stack" });
  parent.append(host);

  const draw = () => {
    const items = spec.getItems();
    host.replaceChildren();
    if (!items.length) host.append(h("div", { class: "empty" }, spec.empty));
    items.forEach((item, index) => host.append(card(item, index)));
    host.append(addForm());
  };

  const card = (item, index) => h("article", { class: "card editor" }, [
    ...spec.fields.map((entry) => control(entry, item[entry.key], (value) => {
      update((data) => {
        const list = spec.list(data);
        if (list[index]) list[index][entry.key] = value;
      });
    }).wrap),
    spec.footer ? spec.footer(item) : null,
    h("button", {
      type: "button",
      class: "btn ghost danger-text",
      onClick: () => {
        update((data) => { spec.list(data).splice(index, 1); });
        spec.onChange?.("remove");
        draw();
      },
    }, "Remove"),
  ]);

  const addForm = () => {
    const inputs = {};
    const form = h("form", { class: "card editor" }, [
      h("h3", {}, spec.addLabel),
      ...spec.fields.filter((entry) => entry.type !== "checkbox").map((entry) => {
        const node = control(entry, entry.fallback ?? "", null, inputs);
        return node.wrap;
      }),
      h("button", { class: "btn primary", type: "submit", "data-testid": spec.addTestId || null }, spec.addLabel),
    ]);
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      const blank = spec.blank();
      let meaningful = false;
      for (const entry of spec.fields) {
        if (entry.type === "checkbox") continue;
        const value = inputs[entry.key]?.value ?? entry.fallback ?? "";
        blank[entry.key] = value;
        if (entry.key === spec.required && String(value).trim()) meaningful = true;
      }
      if (!meaningful) return;
      blank.id = uid();
      update((data) => { spec.list(data).unshift(blank); });
      spec.onChange?.("add");
      draw();
    });
    return form;
  };

  function control(entry, value, onChange, inputs) {
    let node;
    if (entry.type === "select") {
      node = select(entry.options, value || entry.fallback || entry.options[0][0], {
        onChange: onChange ? (event) => onChange(event.target.value) : undefined,
      });
    } else if (entry.type === "textarea") {
      node = area({
        rows: entry.rows || 3,
        placeholder: entry.placeholder || "",
        value: value || "",
        onInput: onChange ? (event) => onChange(event.target.value) : undefined,
      });
    } else if (entry.type === "checkbox") {
      node = h("input", {
        type: "checkbox",
        checked: Boolean(value),
        onChange: onChange ? (event) => onChange(event.target.checked) : undefined,
      });
    } else {
      node = txt({
        type: entry.type || "text",
        placeholder: entry.placeholder || "",
        value: value || "",
        onInput: onChange ? (event) => onChange(event.target.value) : undefined,
      });
    }
    if (inputs) inputs[entry.key] = node;
    const wrap = entry.type === "checkbox"
      ? h("label", { class: "checkline" }, [node, entry.label])
      : field(entry.label, node, entry.hint);
    return { wrap, node };
  }

  draw();
  return { redraw: draw };
}
