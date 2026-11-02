import { h, field, txt, area, select, toast } from "../dom.js";
import { shell } from "../shell.js";
import { navigate } from "../nav.js";
import { session, update } from "../session.js";
import { ESSAY_KINDS, pushActivity, uid } from "../data.js";
import { statusLabel } from "../format.js";
import { essayStatus } from "../summary.js";
import { essaySystem } from "../prompts.js";
import { renderRich } from "../rich.js";
import { complete, currentModelId, loadModel, modelCached } from "../ai.js";

export function mountEssayList(root) {
  const view = shell(root, { title: "Essays", tab: "essays" });
  const title = txt({ placeholder: "e.g. a story about building something", "data-testid": "essay-title" });
  const kind = select(ESSAY_KINDS, "college");
  const form = h("form", { class: "card editor" }, [
    h("p", { class: "hint" }, "The coach helps you brainstorm, outline, and revise. It will not write the essay for you."),
    field("Title", title),
    field("Kind", kind),
    h("button", { class: "btn primary", type: "submit" }, "Start an essay"),
  ]);
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const id = uid();
    update((data) => {
      data.essays.unshift({
        id, title: title.value.trim(), kind: kind.value, prompt: "", brainstorm: "", outline: "", draft: "", feedback: "", updatedAt: new Date().toISOString(),
      });
      pushActivity(data, "essay", "Started an essay");
    });
    navigate(`/essay/${id}`);
  });
  const list = session.data.essays.length
    ? h("div", { class: "stack" }, session.data.essays.map((essay) => (
      h("button", { type: "button", class: "card rowlink", onClick: () => navigate(`/essay/${essay.id}`) }, [
        h("b", {}, essay.title || "Untitled essay"),
        h("span", {}, `${statusLabel(ESSAY_KINDS, essay.kind)} · ${essayStatus(essay)}`),
      ])
    )))
    : h("div", { class: "empty" }, "No essays yet. Start with a title when you have a prompt.");
  view.content.append(form, list);
  return { unmount: view.destroy };
}

export function mountEssay(root, id) {
  const essay = session.data.essays.find((item) => item.id === id);
  const view = shell(root, { title: "Essay coach", tab: "essays", back: "/essays" });
  if (!essay) {
    view.content.append(h("div", { class: "empty" }, "That essay isn't on this device."));
    return { unmount: view.destroy };
  }
  const title = txt({ value: essay.title, "data-testid": "essay-edit-title" });
  const kind = select(ESSAY_KINDS, essay.kind);
  const prompt = area({ rows: 3, placeholder: "Paste the prompt from the application or teacher.", value: essay.prompt });
  const brainstorm = area({
    rows: 5,
    placeholder: "What happened, in one scene?\nWhat did you do?\nWhat changed for you?\nWhy would a reader care?",
    value: essay.brainstorm,
    "data-testid": "essay-brainstorm",
  });
  const outline = area({
    rows: 5,
    placeholder: "1. Hook, a specific moment\n2. What was at stake\n3. What you did\n4. What you learned\n5. Why it matters for this application",
    value: essay.outline,
  });
  const draft = area({
    rows: 10,
    placeholder: "Write this in your own words. The coach will not write the essay for you.",
    value: essay.draft,
    "data-testid": "essay-draft",
  });
  const count = h("p", { class: "hint" });
  const feedback = h("div", { class: "card feedback", "data-testid": "essay-feedback" });
  const showFeedback = () => {
    feedback.replaceChildren(h("h3", {}, "Coach notes"));
    if (!session.data.essays.find((item) => item.id === id)?.feedback) {
      feedback.append(h("p", { class: "hint" }, "Feedback shows up here. It is coaching, not a replacement draft."));
      return;
    }
    const body = h("div", { class: "rich" });
    body.append(renderRich(session.data.essays.find((item) => item.id === id).feedback));
    feedback.append(
      h("p", { class: "hint" }, "Use this as coaching. Keep your own words in the draft."),
      body,
    );
  };
  const write = () => {
    update((data) => {
      const item = data.essays.find((row) => row.id === id);
      if (!item) return;
      item.title = title.value;
      item.kind = kind.value;
      item.prompt = prompt.value;
      item.brainstorm = brainstorm.value;
      item.outline = outline.value;
      item.draft = draft.value;
      item.updatedAt = new Date().toISOString();
    });
    const n = (draft.value.trim().match(/\S+/g) || []).length;
    count.textContent = n ? `${n} ${n === 1 ? "word" : "words"} in your draft` : "Draft is empty";
  };
  [title, prompt, brainstorm, outline, draft].forEach((node) => node.addEventListener("input", write));
  kind.addEventListener("change", write);
  write();
  showFeedback();

  const coach = h("button", { type: "button", class: "btn gold wide", "data-testid": "essay-coach" }, "Get coach feedback");
  coach.addEventListener("click", () => runCoach(id, coach, showFeedback));

  view.content.append(
    h("p", { class: "lede" }, "ARAHA coaches structure, voice, and clarity. It will not ghostwrite."),
    field("Title", title),
    field("Kind", kind),
    field("Prompt", prompt),
    field("Brainstorm", brainstorm),
    field("Outline", outline),
    field("Your draft", draft),
    count,
    coach,
    feedback,
    h("button", { type: "button", class: "btn ghost danger-text", onClick: () => {
      update((data) => { data.essays = data.essays.filter((item) => item.id !== id); });
      navigate("/essays");
    } }, "Delete essay"),
  );
  return { unmount: view.destroy };
}

async function runCoach(id, button, showFeedback) {
  const essay = session.data.essays.find((item) => item.id === id);
  if (!essay) return;
  button.disabled = true;
  const previous = button.textContent;
  button.textContent = "Coaching on this device…";
  try {
    const modelId = session.data.settings.modelId;
    if (currentModelId() !== modelId) {
      if (!await modelCached(modelId)) {
        toast("Download the on-device model first. You can keep drafting without it.");
        navigate("/model");
        return;
      }
      await loadModel(modelId);
    }
    const reply = await completeSafe(session.data, essay);
    update((data) => {
      const item = data.essays.find((row) => row.id === id);
      if (!item) return;
      item.feedback = reply;
      pushActivity(data, "essay", "Asked the essay coach");
    });
    showFeedback();
  } catch (error) {
    toast(error.message || "The coach couldn't answer.");
  } finally {
    button.disabled = false;
    button.textContent = previous;
  }
}

async function completeSafe(data, essay) {
  const { complete } = await import("../ai.js");
  return complete({
    system: essaySystem(data, essay),
    messages: [{ role: "user", content: "Review what I have. Coach me. Do not write my essay." }],
    maxTokens: 800,
  });
}
