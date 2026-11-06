import { h } from "../dom.js";
import { shell } from "../shell.js";
import { mountCollection } from "../collection.js";
import { COLLEGE_BANDS, COLLEGE_STATUS, pushActivity } from "../data.js";
import { MAJOR_SUGGESTIONS, LIST_NOTE } from "../lists.js";
import { session, update } from "../session.js";

export function mountColleges(root) {
  const view = shell(root, { title: "Colleges", tab: "plan", back: "/plan" });
  view.content.append(
    h("p", { class: "lede" }, "Save colleges you want to understand. Reach, target, and likely are your labels, not a calculated chance."),
    h("p", { class: "hint" }, "ARAHA does not download college sites and does not refresh them in the background. Type what you read, where you read it, and the date you checked. Saved notes can go out of date."),
    h("p", { class: "hint" }, LIST_NOTE),
    h("datalist", { id: "major-suggestions" }, MAJOR_SUGGESTIONS.map((value) => h("option", { value }))),
  );
  mountCollection(view.content, {
    empty: "No colleges yet. Add one you are curious about.",
    addLabel: "Add a college",
    addTestId: "college-add",
    required: "name",
    getItems: () => session.data.colleges,
    list: (data) => data.colleges,
    blank: () => ({ name: "", location: "", majors: "", status: "researching", band: "unsure", requirements: "", testPolicy: "", deadline: "", source: "", lastChecked: "", notes: "" }),
    onChange: (kind) => { if (kind === "add") update((data) => pushActivity(data, "college", "Saved a college")); },
    fields: [
      { key: "name", label: "College", placeholder: "e.g. Rutgers University — New Brunswick" },
      { key: "location", label: "Location", placeholder: "e.g. New Brunswick, NJ" },
      { key: "majors", label: "Majors of interest", placeholder: "e.g. mechanical engineering", list: "major-suggestions" },
      { key: "band", label: "Your label", type: "select", options: COLLEGE_BANDS, fallback: "unsure", hint: "Your estimate only. ARAHA does not compute a probability." },
      { key: "status", label: "Status", type: "select", options: COLLEGE_STATUS, fallback: "researching" },
      { key: "requirements", label: "Requirements you read", type: "textarea", placeholder: "Paste only what the college page actually says" },
      { key: "testPolicy", label: "Test policy you read", placeholder: "e.g. optional, as of the date below" },
      { key: "deadline", label: "Deadline you verified", type: "date" },
      { key: "source", label: "Source", placeholder: "Page or person you checked" },
      { key: "lastChecked", label: "Date you checked", type: "date" },
      { key: "notes", label: "Notes", type: "textarea", placeholder: "What you want to remember" },
    ],
  });
  return { unmount: view.destroy };
}
