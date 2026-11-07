import { h } from "../dom.js";
import { shell } from "../shell.js";
import { mountCollection } from "../collection.js";
import { COLLEGE_BANDS, COLLEGE_STATUS, pushActivity, uid } from "../data.js";
import { MAJOR_SUGGESTIONS, LIST_NOTE } from "../lists.js";
import { session, update } from "../session.js";
import { COLLEGE_FILE, collegeSummary, findColleges, loadReference } from "../reference.js";
import { toast } from "../dom.js";

export function mountColleges(root) {
  const view = shell(root, { title: "Colleges", tab: "plan", back: "/plan" });
  view.content.append(
    h("p", { class: "lede" }, "Save colleges you want to understand. Reach, target, and likely are your labels, not a calculated chance."),
    h("p", { class: "hint" }, "ARAHA does not download college sites and does not refresh them in the background. Type what you read, where you read it, and the date you checked. Saved notes can go out of date."),
    h("p", { class: "hint" }, LIST_NOTE),
    h("datalist", { id: "major-suggestions" }, MAJOR_SUGGESTIONS.map((value) => h("option", { value }))),
    scorecardLookup(),
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

function scorecardLookup() {
  const query = h("input", { class: "txt", placeholder: "Type a college name", "data-testid": "scorecard-query" });
  const results = h("div", { class: "stack" });
  const note = h("p", { class: "hint" }, "Lookup uses the College Scorecard file packaged with this app. It does not open the college site, and your profile is not included in the request. Reload only fetches that same packaged file.");
  const form = h("form", { class: "card stack" }, [
    h("h2", {}, "Scorecard snapshot"),
    note,
    query,
    h("div", { class: "composer-tools" }, [
      h("button", { class: "btn primary", type: "submit" }, "Look up"),
      h("button", { type: "button", class: "btn ghost", onClick: () => search(true) }, "Reload packaged file"),
    ]),
    results,
  ]);
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    search(false);
  });
  async function search(refresh) {
    results.replaceChildren(h("p", { class: "hint" }, refresh ? "Reloading the packaged file…" : "Searching the packaged file…"));
    try {
      const payload = await loadReference(COLLEGE_FILE, { refresh });
      const hits = findColleges(payload, query.value);
      if (!hits.length) {
        results.replaceChildren(h("p", {}, "No matching institution in this Scorecard file. Add the college yourself and type only what you verified."));
        return;
      }
      results.replaceChildren(...hits.map((row) => {
        const lines = collegeSummary(row, payload);
        return h("article", { class: "card stack" }, [
          ...lines.map((line) => h("p", {}, line)),
          h("button", { type: "button", class: "btn gold", onClick: () => {
            update((data) => {
              data.colleges.unshift({
                id: uid(),
                name: row.name,
                location: [row.city, row.state].filter(Boolean).join(", "),
                majors: "",
                status: "researching",
                band: "unsure",
                requirements: lines.slice(1).join("\n"),
                testPolicy: "",
                deadline: "",
                source: `College Scorecard institution file ${payload.file || ""}, updated ${payload.scorecardUpdated}`,
                lastChecked: payload.scorecardUpdated || "",
                notes: "Copied from the packaged Scorecard snapshot. Not a live check and not an admission chance.",
              });
              pushActivity(data, "college", "Added a Scorecard snapshot");
            });
            toast("Added from the packaged snapshot. Deadlines are still blank.");
          } }, "Add these published facts"),
        ]);
      }));
    } catch (error) {
      results.replaceChildren(h("p", {}, error.message || "The snapshot did not load."));
    }
  }
  return form;
}
