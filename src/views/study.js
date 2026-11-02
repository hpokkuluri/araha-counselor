import { h, field, txt, area, toast } from "../dom.js";
import { shell } from "../shell.js";
import { navigate } from "../nav.js";
import { session, update } from "../session.js";
import { pushActivity, uid } from "../data.js";
import { mountThread } from "../thread.js";
import { tutorSystem } from "../prompts.js";

export function mountStudy(root) {
  const view = shell(root, { title: "Subjects", tab: "study" });
  const name = txt({ placeholder: "e.g. Geometry", "data-testid": "subject-name" });
  const form = h("form", { class: "card editor" }, [
    field("Subject", name, "Any class. You can rename or remove it later."),
    h("button", { class: "btn primary", type: "submit", "data-testid": "subject-add" }, "Add subject"),
  ]);
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const label = name.value.trim();
    if (!label) return;
    const id = uid();
    update((data) => {
      data.subjects.unshift({ id, name: label, notes: "", messages: [], createdAt: new Date().toISOString() });
      pushActivity(data, "subject", `Added ${label}`);
    });
    navigate(`/subject/${id}`);
  });
  const list = session.data.subjects.length
    ? h("div", { class: "stack" }, session.data.subjects.map((subject) => {
      const questions = subject.messages.filter((message) => message.role === "user").length;
      return h("button", { type: "button", class: "card rowlink", onClick: () => navigate(`/subject/${subject.id}`) }, [
        h("b", {}, subject.name || "Untitled subject"),
        h("span", {}, `${questions} tutor ${questions === 1 ? "question" : "questions"}`),
      ]);
    }))
    : h("div", { class: "empty" }, "Add a subject such as Geometry, Biology, or Spanish II. Each one gets notes and a tutor.");
  view.content.append(h("p", { class: "lede" }, "Subject help is here when you want it. Your counselor is still the home page."), form, list);
  return { unmount: view.destroy };
}

export function mountSubject(root, id) {
  const view = shell(root, { title: "Tutor", tab: "study", back: "/study", tabs: false });
  const subject = () => session.data.subjects.find((item) => item.id === id);
  if (!subject()) {
    view.content.append(h("div", { class: "empty" }, "That subject isn't on this device."));
    return { unmount: view.destroy };
  }
  const name = txt({ value: subject().name, "data-testid": "subject-rename" });
  const notes = area({ rows: 5, placeholder: "Formulas, vocab, or questions to come back to.", value: subject().notes, "data-testid": "subject-notes" });
  name.addEventListener("input", () => update((data) => {
    const item = data.subjects.find((row) => row.id === id);
    if (item) item.name = name.value;
  }));
  notes.addEventListener("input", () => update((data) => {
    const item = data.subjects.find((row) => row.id === id);
    if (item) item.notes = notes.value;
  }));
  view.content.append(
    field("Subject", name),
    field("Notes", notes),
    h("button", { type: "button", class: "btn ghost danger-text", onClick: () => {
      update((data) => { data.subjects = data.subjects.filter((item) => item.id !== id); });
      toast("Subject removed.");
      navigate("/study");
    } }, "Remove subject"),
  );
  mountThread(view.content, {
    intro: `Ask for a step-by-step explanation or a practice question in ${subject().name || "this subject"}. Math uses $...$ so it can render.`,
    placeholder: "Ask for a hint or a practice question",
    key: `subject:${id}`,
    messages: () => subject()?.messages || [],
    push: (data, message) => {
      const item = data.subjects.find((row) => row.id === id);
      if (!item) return;
      item.messages.push(message);
      if (item.messages.length > 80) item.messages.splice(0, item.messages.length - 80);
    },
    clear: (data) => {
      const item = data.subjects.find((row) => row.id === id);
      if (item) item.messages = [];
    },
    system: () => tutorSystem(session.data, subject() || { name: "this subject", notes: "" }),
    activity: "tutor",
    activityLabel: `Tutor: ${subject()?.name || "subject"}`,
    maxTokens: 700,
  });
  return { unmount: view.destroy };
}
