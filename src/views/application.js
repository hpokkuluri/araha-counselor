import { h, field, txt, area, toast } from "../dom.js";
import { shell } from "../shell.js";
import { session, update } from "../session.js";
import { uid } from "../data.js";
import { readinessItems } from "../readiness.js";
import { captureControls } from "../capture.js";
import { complete, currentModelId, fitModelChoice, loadModel, modelCached } from "../ai.js";
import { interviewSystem } from "../prompts.js";
import { navigate } from "../nav.js";

export function mountApplication(root) {
  const view = shell(root, { title: "My application", tab: "plan", back: "/home" });
  const host = h("div", { class: "stack", "data-testid": "application" });
  view.content.append(host);
  const paint = () => {
    const report = readinessItems(session.data);
    host.replaceChildren(
      h("h1", { class: "display small" }, ["My ", h("em", {}, "application")]),
      h("p", { class: "lede" }, "This preview uses ARAHA's own layout. It is not the Common App and it does not copy that form."),
      h("section", { class: "card stack" }, [
        h("h2", {}, report.label),
        h("ul", { class: "plain" }, report.items.map((item) => h("li", {}, `${item.done ? "Done" : "Open"} · ${item.label}`))),
        h("p", { class: "hint" }, "Readiness means the tasks above are filled in. It is not an admission score and not a probability."),
      ]),
      h("section", { class: "card stack" }, [
        h("h2", {}, "From your profile"),
        h("p", {}, session.data.profile.name.trim() || "Name not added yet."),
        h("p", { class: "hint" }, [
          session.data.profile.school,
          session.data.profile.gpa && `GPA ${session.data.profile.gpa}`,
          session.data.profile.goalChoice,
        ].filter(Boolean).join(" · ") || "Add school, GPA, and a direction on My Profile."),
        h("button", { type: "button", class: "btn ghost", onClick: () => navigate("/profile") }, "Edit My Profile"),
      ]),
      recommendations(paint),
      interview(),
    );
  };
  paint();
  return { unmount: view.destroy };
}

function recommendations(paint) {
  const rows = session.data.recommendations;
  const name = txt({ placeholder: "Teacher or mentor" });
  const role = txt({ placeholder: "Class or how they know you" });
  const form = h("form", { class: "card stack" }, [
    h("h2", {}, "Recommendations"),
    h("p", { class: "hint" }, "Notes for you. ARAHA does not contact anyone."),
    ...rows.map((row, index) => h("p", {}, [
      `${row.name || "Unnamed"} · ${row.role || "role not set"} · ${row.status}`,
      " ",
      h("button", { type: "button", class: "btn ghost", onClick: () => {
        update((data) => { data.recommendations.splice(index, 1); });
        paint();
      } }, "Remove"),
    ])),
    field("Name", name),
    field("Role", role),
    h("button", { class: "btn primary", type: "submit" }, "Add recommendation note"),
  ]);
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    if (!name.value.trim()) return;
    update((data) => {
      data.recommendations.unshift({ id: uid(), name: name.value.trim(), role: role.value.trim(), status: "considering", notes: "" });
    });
    paint();
  });
  return form;
}

function interview() {
  const answer = area({ rows: 5, placeholder: "Answer as yourself. One real example is enough.", "data-testid": "interview-answer" });
  const out = h("div", { class: "card feedback" });
  const button = h("button", { type: "button", class: "btn gold" }, "Practice this answer");
  button.addEventListener("click", () => practice(answer, button, out));
  return h("section", { class: "stack" }, [
    h("h2", { class: "sec-h" }, "Interview practice"),
    answer,
    captureControls(answer),
    button,
    out,
  ]);
}

async function practice(answer, button, out) {
  const text = answer.value.trim();
  if (!text) {
    toast("Write an answer first. The coach will not invent one.");
    return;
  }
  button.disabled = true;
  try {
    const modelId = fitModelChoice(session.data.settings);
    if (currentModelId() !== modelId) {
      if (!await modelCached(modelId)) {
        toast("Download the on-device model first. Your answer stays on this device.");
        navigate("/model");
        return;
      }
      await loadModel(modelId);
    }
    const reply = await complete({
      system: interviewSystem(session.data),
      messages: [{ role: "user", content: text }],
      maxTokens: 400,
      threadKey: "interview",
    });
    out.replaceChildren(h("p", {}, reply || "No notes came back. Try again."));
  } catch (error) {
    toast(error.message || "The practice note didn't finish.");
  } finally {
    button.disabled = false;
  }
}
