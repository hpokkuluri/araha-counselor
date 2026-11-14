import { h, toast } from "../dom.js";
import { newTag, markSeen } from "../newtag.js";
import { shell } from "../shell.js";
import { session, update, usesCloud } from "../session.js";
import { AP_EXAMS, EXAMS, SEED_QUESTIONS, scoreAttempt } from "../exams.js";
import { geminiText } from "../cloud.js";
import { parseQuiz } from "../generated.js";
import { uid } from "../data.js";
import { openCalculator } from "../examcalc.js";

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
    h("button", { type: "button", class: "btn gold", onClick: () => startExam(id, exam, paint) }, ["Start a full practice", newTag("practice-mode")]),
  ]);
}

async function startExam(id, exam, paint) {
  if (!usesCloud()) {
    toast("Sign in with email so Gemini can build the test. A short starter set is not a full exam.");
    return;
  }
  const answers = [];
  const all = [];
  const stage = examOverlay();
  const opts = await stage.setup(exam);
  if (!opts) return;
  try {
    for (let index = 0; index < exam.sections.length; index += 1) {
      const section = exam.sections[index];
      if (section.optional && !window.confirm(`Include ${section.name}? Cancel skips this optional section.`)) continue;
      const previous = index > 0 ? scoreAttempt(all, answers) : null;
      const harder = previous && previous.total && previous.correct / previous.total >= 0.7;
      stage.loading(`Building ${section.name}`, 0, section.questions);
      const questions = await loadSection(exam, section, harder, (done) => stage.loading(`Building ${section.name}`, done, section.questions));
      if (stage.cancelled) throw new Error("cancelled");
      const result = await runModule(section, questions, stage, opts);
      all.push(...questions);
      answers.push(...result);
    }
  } catch (error) {
    stage.close();
    if (error?.message !== "cancelled") toast(`Could not build the test: ${String(error?.message || error).slice(0, 120)}. Please try again.`);
    return;
  }
  const scored = scoreAttempt(all, answers);
  await stage.review(all, answers, scored);
  stage.close();
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

function examOverlay() {
  const panel = h("div", { class: "wrap stack", style: "max-width:640px;margin:0 auto;padding:16px" });
  const layer = h("div", { "data-testid": "exam-overlay", style: "position:fixed;inset:0;z-index:50;overflow-y:auto;background:var(--bg, #0d1a33);padding-top:env(safe-area-inset-top)" }, panel);
  document.body.append(layer);
  const api = {
    cancelled: false,
    panel,
    loading(label, done, total) {
      panel.replaceChildren(
        h("h2", {}, `${label}…`),
        h("p", { class: "hint" }, `${done} of ${total} questions ready. This usually takes under a minute.`),
        h("button", { type: "button", class: "btn ghost", onClick: () => { api.cancelled = true; api.close(); } }, "Cancel"),
      );
    },
    close() { layer.remove(); },
    setup(examDef) {
      const hasMath = examDef.sections.some((sec) => /math|science/i.test(sec.kind || sec.name));
      return new Promise((resolve) => {
        const practice = h("input", { type: "checkbox", "data-testid": "toggle-practice" });
        const calc = h("input", { type: "checkbox", "data-testid": "toggle-calc", checked: hasMath });
        const row = (box, title, sub) => h("label", { class: "card", style: "display:flex;gap:12px;align-items:flex-start;padding:12px;cursor:pointer" }, [box, h("span", {}, [h("strong", {}, title), h("br"), h("span", { class: "hint" }, sub)])]);
        practice.addEventListener("change", () => markSeen("practice-mode"));
        calc.addEventListener("change", () => markSeen("calculator"));
        practice.style.cssText = calc.style.cssText = "width:22px;height:22px;flex:none;margin-top:2px";
        panel.replaceChildren(h("div", { class: "stack" }, [
          h("h2", {}, `${examDef.name} setup`),
          row(practice, ["Show answers after each question", newTag("practice-mode")], "Practice mode: see right or wrong and a short explanation after every question. Leave off for a real-test run."),
          hasMath ? row(calc, ["Calculator", newTag("calculator")], "Adds a scientific and graphing calculator button on math sections.") : null,
          h("p", { class: "hint" }, "Academic honesty: use ARAHA only for practice, never during a real exam or graded work."),
          h("button", { type: "button", class: "btn gold", "data-testid": "exam-begin", onClick: () => resolve({ practice: practice.checked, calculator: hasMath && calc.checked }) }, "Begin test"),
          h("button", { type: "button", class: "btn ghost", onClick: () => { api.close(); resolve(null); } }, "Cancel"),
        ]));
      });
    },
    review(questions, answers, scored) {
      return new Promise((resolve) => {
        const letters = "ABCD";
        panel.replaceChildren(h("div", { class: "stack", "data-testid": "exam-review" }, [
          h("h2", {}, `Score: ${scored.correct} of ${scored.total}`),
          h("p", { class: "hint" }, scored.weak.length ? `Weak topics added to your study plan: ${scored.weak.join(", ")}` : "Great work. No weak topics this time."),
          ...questions.map((q, i) => {
            const picked = answers[i];
            const ok = picked === q.answer;
            return h("article", { class: "card stack", style: `border-left:4px solid ${ok ? "#2fbf71" : "#e5484d"}` }, [
              h("p", { class: "hint" }, `Question ${i + 1} · ${ok ? "Correct" : picked == null ? "Not answered" : "Incorrect"}`),
              h("p", { style: "white-space:pre-wrap" }, q.prompt),
              picked != null && !ok ? h("p", {}, `Your answer: ${letters[picked]}. ${q.choices[picked]}`) : null,
              h("p", {}, h("strong", {}, `Correct answer: ${letters[q.answer]}. ${q.choices[q.answer]}`)),
              q.explain ? h("p", { class: "hint" }, `Why: ${q.explain}`) : null,
            ]);
          }),
          h("button", { type: "button", class: "btn gold", onClick: () => resolve() }, "Done"),
        ]));
        layer.scrollTop = 0;
      });
    },
  };
  return api;
}

async function batchWithRetry(fn, tries = 3) {
  let last;
  for (let attempt = 0; attempt < tries; attempt += 1) {
    try { return await fn(); } catch (error) { last = error; await new Promise((r) => setTimeout(r, 1500 * (attempt + 1))); }
  }
  throw last;
}

async function loadSection(exam, section, harder, onProgress) {
  const counts = [];
  for (let left = section.questions; left > 0; left -= 5) counts.push(Math.min(5, left));
  const batches = [];
  let done = 0;
  const one = async (count) => {
    const raw = await batchWithRetry(() => geminiText({
      system: `Write ${count} original ${section.kind} questions in the style of ${exam.name}. ${harder ? "Make this second module harder." : "Make this module a fair opening set."} Do not copy official items. Use exactly:\nQ: question\nA: choice\nB: choice\nC: choice\nD: choice\nAnswer: B\nWhy: one or two short sentences explaining why the correct answer is right\n---`,
      messages: [{ role: "user", content: `Section: ${section.name}. Topic label to repeat in Why is fine. No hints inside the question.` }],
      data: session.data,
    }));
    const parsed = parseQuiz(raw).slice(0, count).map((item) => ({ ...item, topic: section.kind }));
    batches.push(...parsed);
    done += parsed.length;
    onProgress?.(Math.min(done, section.questions));
  };
  const queue = [...counts];
  const workers = Array.from({ length: 3 }, async () => { while (queue.length) await one(queue.shift()); });
  await Promise.all(workers);
  if (!batches.length) {
    return SEED_QUESTIONS.filter((item) => item.kind === section.kind).slice(0, 2).map((item) => ({ ...item, topic: section.kind }));
  }
  return batches.slice(0, section.questions);
}

function runModule(section, questions, stage, opts = {}) {
  return new Promise((resolve) => {
    const root = document.getElementById("main");
    const answers = [];
    let index = 0;
    let seconds = section.minutes * 60;
    const host = h("div", { class: "stack", style: "position:relative;padding-top:8px" });
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
        opts.calculator && /math|science/i.test(section.kind || section.name) ? h("button", { type: "button", "data-testid": "open-calc", "aria-label": "Open calculator", title: "Calculator", onClick: openCalculator, style: "position:absolute;top:12px;right:12px;width:44px;height:44px;border-radius:12px;font-size:22px;line-height:1;border:1px solid rgba(255,255,255,.25);background:rgba(255,255,255,.08);color:inherit" }, "🧮") : null,
        h("p", { style: "white-space:pre-wrap" }, question.prompt),
        ...question.choices.map((choice, choiceIndex) => h("button", {
          type: "button",
          class: "btn ghost",
          onClick: () => {
            answers[index] = choiceIndex;
            if (opts.practice) return feedback(choiceIndex);
            index += 1;
            draw();
          },
        }, `${"ABCD"[choiceIndex]}. ${choice}`)),
      );
    };
    const feedback = (picked) => {
      const question = questions[index];
      const ok = picked === question.answer;
      host.replaceChildren(
        h("p", { class: "hint" }, `${section.name} · ${index + 1} of ${questions.length}`),
        timer,
        h("p", { style: "white-space:pre-wrap" }, question.prompt),
        h("p", { "data-testid": "practice-feedback", style: `font-weight:700;color:${ok ? "#2fbf71" : "#e5484d"}` }, ok ? "Correct!" : `Not quite. You picked ${"ABCD"[picked]}.`),
        h("p", {}, h("strong", {}, `Correct answer: ${"ABCD"[question.answer]}. ${question.choices[question.answer]}`)),
        question.explain ? h("p", { class: "hint" }, `Why: ${question.explain}`) : null,
        h("button", { type: "button", class: "btn gold", onClick: () => { index += 1; draw(); } }, index + 1 < questions.length ? "Next question" : "Finish section"),
      );
    };
    if (stage) { stage.panel.replaceChildren(host); stage.panel.scrollIntoView?.(); } else root.querySelector(".wrap")?.append(host);
    draw();
  });
}

function formatTime(seconds) {
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  return `${minutes}:${String(rest).padStart(2, "0")}`;
}
