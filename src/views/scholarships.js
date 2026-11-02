import { h } from "../dom.js";
import { shell } from "../shell.js";
import { mountCollection } from "../collection.js";
import { SCHOLARSHIP_STATUS, pushActivity } from "../data.js";
import { session, update } from "../session.js";

export function mountScholarships(root) {
  const view = shell(root, { title: "Scholarships", tab: "plan", back: "/plan" });
  view.content.append(h("p", { class: "lede" }, "Track scholarships you might apply for. Deadlines also show up on Home."));
  mountCollection(view.content, {
    empty: "No scholarships yet. Add a name, amount, and deadline when you find one.",
    addLabel: "Add a scholarship",
    required: "name",
    getItems: () => session.data.scholarships,
    list: (data) => data.scholarships,
    blank: () => ({ name: "", amount: "", deadline: "", status: "interested", notes: "" }),
    onChange: (kind) => { if (kind === "add") update((data) => pushActivity(data, "scholarship", "Added a scholarship")); },
    fields: [
      { key: "name", label: "Name", placeholder: "e.g. local STEM scholarship" },
      { key: "amount", label: "Amount", placeholder: "e.g. 1000" },
      { key: "deadline", label: "Deadline", type: "date" },
      { key: "status", label: "Status", type: "select", options: SCHOLARSHIP_STATUS, fallback: "interested" },
      { key: "notes", label: "Notes", type: "textarea", placeholder: "Requirements or a reminder" },
    ],
  });
  return { unmount: view.destroy };
}
