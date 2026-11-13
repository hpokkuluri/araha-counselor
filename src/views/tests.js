import { h, toast } from "../dom.js";
import { shell } from "../shell.js";
import { session, update, usesCloud } from "../session.js";
import { AP_EXAMS, EXAMS, SEED_QUESTIONS, scoreAttempt } from "../exams.js";
import { geminiText } from "../cloud.js";
import { parseQuiz } from "../generated.js";
import { uid } from "../data.js";

export function mountTests(root) {
  const view = shell(root, { title: "Test prep", tab: "tests" });
  const host = h("div", { class: "stack", "data-testid": "test-prep" });
  view.content.append(
    h("p", { class: "lede" }, "Full-length practice is generated on demand in the official timing. These are original questions, not a College Board or ACT form."),
    h("p", { class: "hint" }, "Official free practice lives in College Board Bluebook and on ACT's site. Use those when you want the real items."),
    host,
  );
  const paint = () => {
    const attempts = session.data.testAttempts || [];
    host.replaceChildren(
      ...Object.entries(EXAMS).map(([id, exam]) => examCard(id, exam, paint)),
      h("h2", { class: "sec-h" }, "AP by subject"),
      h("p", { class: "hint" }, "Section counts follow the long-standing College Board structures for these courses. Confirm the bulletin for the year you test."),
      ...Object.entries(AP_EXAMS).map(([id, exam]) => examCard(`ap-${id}`, exam, paint)),
      h("h2", { class: "sec-h" }, "Progress"),
      attempts.length ? h("ul", { class: "plain" }, attempts.slice(0, 8).map((item) => h("li", {}, `${item.exam}: ${item.correct}/${item.total}${item.weak?.length ? ` · weak: ${item.weak.join(", ")}` : ""}`))) : h("p", { class: "empty" }, "No scored attempts yet."),
    );
  };
  paint();
  return { unmount: view.destroy };
}

function examCard(id, exam, paint) {
  return h("article", { class: "card stack" }, [
    h("h2", {}, exam.name),
    h("ul", { class: "plain" }, exam.sections.map((section) => h("li", {}, `${section.name}: ${section.questions} questions, ${section.minutes} min${section.adaptive ? " · adaptive" : ""}${section.optional ? " · optional" : ""}`))),
    exam.official ? h("a", { href: exam.official, target: "_blank", rel: "noreferrer" }, exam.officialLabel || "Official practice") : null,
    h("button", { type: "button", class: "btn gold", onClick: () => startExam(id, exam, paint) }, "Start a full practice"),
  ]);
}

async function startExam(id, exam, paint) {
  if (!usesCloud()) {
    toast("Sign in with email so Gemini can build the test. A short starter set is not a full exam.");
    return;
  }
  const answers = [];
  const all = [];
  for (let index = 0; index < exam.sections.length; index += 1) {
    const section = exam.sections[index];
    if (section.optional && !window.confirm(`Include ${section.name}? Cancel skips this optional section.`)) continue;
    const previous = index > 0 ? scoreAttempt(all, answers) : null;
    const harder = previous && previous.total && previous.correct / previous.total >= 0.7;
    toast(`Building ${section.name}…`);
    const questions = await loadSection(exam, section, harder);
    const result = await runModule(section, questions);
    all.push(...questions);
    answers.push(...result);
  }
  const scored = scoreAttempt(all, answers);
  update((data) => {
    data.testAttempts.unshift({ id: uid(), exam: exam.name, at: new Date().toISOString(), correct: scored.correct, total: scored.total, weak: scored.weak });
    for (const topic of scored.weak) {
      if (!data.studyPlan.includes(topic)) data.studyPlan.unshift(topic);
    }
    data.studyPlan.splice(40);
  });
  toast(`${scored.correct} of ${scored.total}. Weak topics were added to your study plan.`);
  paint();
}

async function loadSection(exam, section, harder) {
  const batches = [];
  let left = section.questions;
  while (left > 0) {
    const count = Math.min(5, left);
    const raw = await geminiText({
      system: `Write ${count} original ${section.kind} questions in the style of ${exam.name}. ${harder ? "Make this second module harder." : "Make this module a fair opening set."} Do not copy official items. Use exactly:\nQ: question\nA: choice\nB: choice\nC: choice\nD: choice\nAnswer: B\nWhy: explanation\n---`,
      messages: [{ role: "user", content: `Section: ${section.name}. Topic label to repeat in Why is fine. No hints inside the question.` }],
      data: session.data,
    });
    const parsed = parseQuiz(raw).map((item) => ({ ...item, topic: section.kind }));
    if (!parsed.length) break;
    batches.push(...parsed);
    left -= parsed.length;
  }
  if (!batches.length) {
    return SEED_QUESTIONS.filter((item) => item.kind === section.kind).slice(0, 2).map((item) => ({ ...item, topic: section.kind }));
  }
  return batches.slice(0, section.questions);
}

function runModule(section, questions) {
  return new Promise((resolve) => {
    const root = document.getElementById("main");
    const answers = [];
    let index = 0;
    let seconds = section.minutes * 60;
    const host = h("div", { class: "stack" });
    const timer = h("p", { class: "due", "data-testid": "exam-timer" }, formatTime(seconds));
    const tick = window.setInterval(() => {
      seconds -= 1;
      timer.textContent = formatTime(Math.max(0, seconds));
      if (seconds <= 0) {
        window.clearInterval(tick);
        finish();
      }
    }, 1000);
    const finish = () => {
      window.clearInterval(tick);
      host.remove();
      resolve(answers);
    };
    const draw = () => {
      const question = questions[index];
      if (!question) return finish();
      host.replaceChildren(
        h("p", { class: "hint" }, `${section.name} · ${index + 1} of ${questions.length}. You cannot return to an earlier module.`),
        timer,
        h("p", {}, question.prompt),
        ...question.choices.map((choice, choiceIndex) => h("button", {
          type: "button",
          class: "btn ghost",
          onClick: () => {
            answers[index] = choiceIndex;
            index += 1;
            draw();
          },
        }, choice)),
      );
    };
    root.querySelector(".wrap")?.append(host);
    draw();
  });
}

function formatTime(seconds) {
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  return `${minutes}:${String(rest).padStart(2, "0")}`;
}
