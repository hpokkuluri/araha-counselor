export const EXAMS = {
  "psat-nmsqt": {
    name: "PSAT/NMSQT",
    official: "https://bluebook.collegeboard.org/",
    officialLabel: "College Board Bluebook",
    sections: [
      { id: "rw1", name: "Reading and Writing, module 1", questions: 27, minutes: 32, kind: "Reading and Writing" },
      { id: "rw2", name: "Reading and Writing, module 2", questions: 27, minutes: 32, kind: "Reading and Writing", adaptive: true },
      { id: "m1", name: "Math, module 1", questions: 22, minutes: 35, kind: "Math" },
      { id: "m2", name: "Math, module 2", questions: 22, minutes: 35, kind: "Math", adaptive: true },
    ],
  },
  "psat-10": {
    name: "PSAT 10",
    official: "https://bluebook.collegeboard.org/",
    officialLabel: "College Board Bluebook",
    sections: [
      { id: "rw1", name: "Reading and Writing, module 1", questions: 27, minutes: 32, kind: "Reading and Writing" },
      { id: "rw2", name: "Reading and Writing, module 2", questions: 27, minutes: 32, kind: "Reading and Writing", adaptive: true },
      { id: "m1", name: "Math, module 1", questions: 22, minutes: 35, kind: "Math" },
      { id: "m2", name: "Math, module 2", questions: 22, minutes: 35, kind: "Math", adaptive: true },
    ],
  },
  sat: {
    name: "SAT",
    official: "https://bluebook.collegeboard.org/",
    officialLabel: "College Board Bluebook",
    sections: [
      { id: "rw1", name: "Reading and Writing, module 1", questions: 27, minutes: 32, kind: "Reading and Writing" },
      { id: "rw2", name: "Reading and Writing, module 2", questions: 27, minutes: 32, kind: "Reading and Writing", adaptive: true },
      { id: "m1", name: "Math, module 1", questions: 22, minutes: 35, kind: "Math" },
      { id: "m2", name: "Math, module 2", questions: 22, minutes: 35, kind: "Math", adaptive: true },
    ],
  },
  act: {
    name: "ACT (2025 enhanced)",
    official: "https://www.act.org/content/act/en/products-and-services/the-act/test-preparation.html",
    officialLabel: "ACT practice",
    sections: [
      { id: "english", name: "English", questions: 50, minutes: 35, kind: "English" },
      { id: "math", name: "Math", questions: 45, minutes: 50, kind: "Math" },
      { id: "reading", name: "Reading", questions: 36, minutes: 40, kind: "Reading" },
      { id: "science", name: "Science (optional)", questions: 40, minutes: 40, kind: "Science", optional: true },
    ],
  },
};

export const AP_EXAMS = {
  biology: { name: "AP Biology", sections: [{ id: "mc", name: "Multiple choice", questions: 60, minutes: 90, kind: "Biology" }, { id: "frq", name: "Free response", questions: 6, minutes: 90, kind: "Biology", free: true }] },
  calculus: { name: "AP Calculus AB", sections: [{ id: "mc", name: "Multiple choice", questions: 45, minutes: 105, kind: "Calculus" }, { id: "frq", name: "Free response", questions: 6, minutes: 90, kind: "Calculus", free: true }] },
  english: { name: "AP English Language", sections: [{ id: "mc", name: "Multiple choice", questions: 45, minutes: 60, kind: "English" }, { id: "frq", name: "Free response", questions: 3, minutes: 135, kind: "English", free: true }] },
};

export function sectionTotals(exam) {
  return (exam?.sections || []).reduce((sum, section) => sum + section.questions, 0);
}

export function scoreAttempt(questions, answers) {
  let correct = 0;
  const weak = [];
  questions.forEach((question, index) => {
    const picked = answers[index];
    if (picked === question.answer) correct += 1;
    else if (question.topic) weak.push(question.topic);
  });
  return { correct, total: questions.length, weak: [...new Set(weak)] };
}

export const SEED_QUESTIONS = [
  { kind: "Reading and Writing", topic: "evidence", prompt: "A student claims a club taught her to lead. Which detail best supports that claim?", choices: ["The club met on Tuesdays.", "She assigned roles and checked that each person finished.", "The school has many clubs.", "Her friend also joined."], answer: 1, explain: "The second sentence shows an action, not just membership." },
  { kind: "Math", topic: "linear equations", prompt: "If 3x - 6 = 15, what is x?", choices: ["3", "5", "7", "9"], answer: 2, explain: "Add 6 to get 3x = 21, then divide by 3." },
  { kind: "English", topic: "punctuation", prompt: "Which sentence is punctuated so the meaning is clear?", choices: ["After school I studied, and then I worked.", "After school I studied and, then I worked.", "After, school I studied and then I worked.", "After school, I studied and then, I worked at."], answer: 0, explain: "The comma before and joins two complete clauses." },
  { kind: "Science", topic: "controls", prompt: "A plant experiment changes only the amount of light. What is the role of the unchanged plant?", choices: ["The hypothesis", "The control", "The average", "The conclusion"], answer: 1, explain: "The unchanged plant is the control used for comparison." },
];
