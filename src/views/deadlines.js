import { h } from "../dom.js";
import { shell } from "../shell.js";
import { mountCollection } from "../collection.js";
import { DEADLINE_CATS, pushActivity } from "../data.js";
import { session, update } from "../session.js";
import { dueLabel } from "../format.js";

export function mountDeadlines(root) {
  const view = shell(root, { title: "Deadlines", tab: "plan", back: "/home" });
  view.content.append(
    h("p", { class: "lede" }, "PSAT, SAT, applications, and school events. Upcoming items show on Home. Reminders stay in the app because there is no server to ping you."),
  );
  mountCollection(view.content, {
    empty: "No deadlines yet.",
    addLabel: "Add a deadline",
    required: "title",
    getItems: () => session.data.deadlines,
    list: (data) => data.deadlines,
    blank: () => ({ title: "", date: "", category: "Test", notes: "", done: false }),
    onChange: (kind) => { if (kind === "add") update((data) => pushActivity(data, "deadline", "Added a deadline")); },
    footer: (item) => item.date ? h("p", { class: item.done ? "hint" : "due" }, dueLabel(item.date)) : null,
    fields: [
      { key: "title", label: "What", placeholder: "e.g. PSAT" },
      { key: "date", label: "Date", type: "date" },
      { key: "category", label: "Category", type: "select", options: DEADLINE_CATS.map((value) => [value, value]), fallback: "Test" },
      { key: "notes", label: "Notes", type: "textarea", placeholder: "Optional" },
      { key: "done", label: "Mark done", type: "checkbox" },
    ],
  });
  return { unmount: view.destroy };
}
