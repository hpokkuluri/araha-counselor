import { h } from "../dom.js";
import { shell } from "../shell.js";
import { mountCollection } from "../collection.js";
import { DEADLINE_CATS, pushActivity } from "../data.js";
import { session, update } from "../session.js";
import { dueLabel } from "../format.js";
import { deadlineTemplates } from "../counsel.js";
import { uid } from "../data.js";

export function mountDeadlines(root) {
  const view = shell(root, { title: "Deadlines", tab: "plan", back: "/home" });
  view.content.append(
    h("p", { class: "lede" }, "Add dates you have verified. A template is only a reminder to go look up the real date."),
    h("p", { class: "hint" }, "ARAHA does not keep a live calendar and will not invent a deadline."),
    h("section", { class: "card stack" }, [
      h("h2", {}, "Aid steps"),
      h("p", {}, "FAFSA is the federal student-aid form. CSS Profile is an extra form some colleges require. State grants are separate."),
      h("p", { class: "hint" }, "Open dates change every year. Confirm this year's date before you rely on it."),
      h("a", { href: "https://studentaid.gov", target: "_blank", rel: "noreferrer" }, "studentaid.gov"),
      " ",
      h("a", { href: "https://cssprofile.collegeboard.org/", target: "_blank", rel: "noreferrer" }, "CSS Profile"),
    ]),
  );
  const list = mountCollection(view.content, {
    empty: "No deadlines yet.",
    addLabel: "Add a deadline",
    required: "title",
    getItems: () => session.data.deadlines,
    list: (data) => data.deadlines,
    blank: () => ({ title: "", date: "", category: "Test", notes: "", done: false, verified: false, source: "" }),
    onChange: (kind) => { if (kind === "add") update((data) => pushActivity(data, "deadline", "Added a deadline")); },
    footer: (item) => item.date ? h("p", { class: item.done ? "hint" : "due" }, dueLabel(item.date)) : null,
    fields: [
      { key: "title", label: "What", placeholder: "e.g. PSAT" },
      { key: "date", label: "Date", type: "date" },
      { key: "category", label: "Category", type: "select", options: DEADLINE_CATS.map((value) => [value, value]), fallback: "Test" },
      { key: "notes", label: "Notes", type: "textarea", placeholder: "Optional" },
      { key: "source", label: "Source", placeholder: "Where you confirmed it. Leave blank if it is still a template." },
      { key: "verified", label: "I verified this date", type: "checkbox" },
      { key: "done", label: "Mark done", type: "checkbox" },
    ],
  });
  view.content.append(h("button", {
    type: "button",
    class: "btn ghost",
    onClick: () => {
      update((data) => {
        for (const item of deadlineTemplates()) data.deadlines.push({ id: uid(), ...item });
      });
      list.redraw();
    },
  }, "Add checklist templates without dates"));
  return { unmount: view.destroy };
}
