import { h, field, txt, area, toast } from "../dom.js";
import { shell } from "../shell.js";
import { navigate } from "../nav.js";
import { session, update } from "../session.js";
import { pushActivity, uid } from "../data.js";
import { mountThread } from "../thread.js";
import { tutorSystem } from "../prompts.js";
import { evaluateExpression } from "../calc.js";
import { PRACTICE_NOTE, practiceFor } from "../practice.js";

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
      data.subjects.unshift({ id, name: label, notes: "", messages: [], cards: [], createdAt: new Date().toISOString() });
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
  view.content.append(studyTools(id, subject));
  return { unmount: view.destroy };
}

function studyTools(id, subject) {
  const calcIn = txt({ placeholder: "e.g. (3+4)*2 or sqrt(81)", "data-testid": "calc-input" });
  const calcOut = h("p", { class: "hint", "data-testid": "calc-output" }, "Checks arithmetic only. It does not grade a word problem.");
  const calc = h("form", { class: "card stack" }, [
    h("h2", {}, "Calculator check"),
    field("Expression", calcIn),
    h("button", { class: "btn primary", type: "submit" }, "Check"),
    calcOut,
  ]);
  calc.addEventListener("submit", (event) => {
    event.preventDefault();
    try {
      const value = evaluateExpression(calcIn.value);
      calcOut.textContent = `= ${Number(value.toFixed(6))}`;
    } catch (error) {
      calcOut.textContent = error.message;
    }
  });

  const front = txt({ placeholder: "Front" });
  const back = txt({ placeholder: "Back" });
  const cards = h("div", { class: "stack" });
  const drawCards = () => {
    const rows = subject()?.cards || [];
    cards.replaceChildren(...rows.map((card, index) => {
      let show = false;
      const body = h("p", {}, card.front);
      const button = h("button", { type: "button", class: "btn ghost", onClick: () => {
        show = !show;
        body.textContent = show ? card.back : card.front;
      } }, "Flip");
      return h("div", { class: "card" }, [
        body,
        button,
        h("button", { type: "button", class: "btn ghost", onClick: () => {
          update((data) => {
            const item = data.subjects.find((row) => row.id === id);
            item?.cards.splice(index, 1);
          });
          drawCards();
        } }, "Remove"),
      ]);
    }));
  };
  drawCards();
  const cardForm = h("form", { class: "stack" }, [
    h("h2", {}, "Flashcards"),
    cards,
    field("Front", front),
    field("Back", back),
    h("button", { class: "btn primary", type: "submit" }, "Save card"),
  ]);
  cardForm.addEventListener("submit", (event) => {
    event.preventDefault();
    if (!front.value.trim() || !back.value.trim()) return;
    update((data) => {
      const item = data.subjects.find((row) => row.id === id);
      if (!item) return;
      if (!item.cards) item.cards = [];
      item.cards.unshift({ id: uid(), front: front.value.trim(), back: back.value.trim() });
    });
    front.value = "";
    back.value = "";
    drawCards();
  });

  const quizHost = h("div", { class: "stack" });
  const questions = practiceFor(subject()?.name || "");
  let index = 0;
  let correct = 0;
  const ask = () => {
    const question = questions[index];
    if (!question) {
      quizHost.replaceChildren(h("p", {}, `You finished this set: ${correct} of ${questions.length}. ${PRACTICE_NOTE}`));
      return;
    }
    quizHost.replaceChildren(
      h("p", { class: "hint" }, PRACTICE_NOTE),
      h("p", {}, question.prompt),
      ...question.choices.map((choice, choiceIndex) => h("button", {
        type: "button",
        class: "btn ghost",
        onClick: () => {
          const ok = choiceIndex === question.answer;
          if (ok) correct += 1;
          toast(ok ? "That matches." : question.explain);
          index += 1;
          ask();
        },
      }, choice)),
    );
  };
  ask();

  return h("div", { class: "stack" }, [
    calc,
    h("section", { class: "card stack" }, [cardForm]),
    h("section", { class: "card stack" }, [h("h2", {}, "Practice"), quizHost]),
  ]);
}
