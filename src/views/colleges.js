import { h } from "../dom.js";
import { shell } from "../shell.js";
import { mountCollection } from "../collection.js";
import { COLLEGE_STATUS, pushActivity } from "../data.js";
import { session, update } from "../session.js";

export function mountColleges(root) {
  const view = shell(root, { title: "Colleges", tab: "plan", back: "/plan" });
  view.content.append(h("p", { class: "lede" }, "Save colleges and majors you want to understand. The list stays empty until you add one."));
  mountCollection(view.content, {
    empty: "No colleges yet. Add one you are curious about.",
    addLabel: "Add a college",
    addTestId: "college-add",
    required: "name",
    getItems: () => session.data.colleges,
    list: (data) => data.colleges,
    blank: () => ({ name: "", location: "", majors: "", status: "researching", notes: "" }),
    onChange: (kind) => { if (kind === "add") update((data) => pushActivity(data, "college", "Saved a college")); },
    fields: [
      { key: "name", label: "College", placeholder: "e.g. Rutgers University — New Brunswick" },
      { key: "location", label: "Location", placeholder: "e.g. New Brunswick, NJ" },
      { key: "majors", label: "Majors of interest", placeholder: "e.g. mechanical engineering" },
      { key: "status", label: "Status", type: "select", options: COLLEGE_STATUS, fallback: "researching" },
      { key: "notes", label: "Notes", type: "textarea", placeholder: "What you want to remember" },
    ],
  });
  return { unmount: view.destroy };
}
