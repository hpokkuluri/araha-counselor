const CHECKS = {
  "": [
    "Add your grade, school, and the direction you are curious about.",
    "Write down the classes you are in now and the grades you actually have.",
  ],
  "9": [
    "Learn how your school counts credits and which courses open the door to later classes.",
    "Try one activity you can stick with. Depth matters more than a long list.",
    "Ask what math you will be ready for next year.",
  ],
  "10": [
    "Check that next year's math and science follow this year's courses.",
    "A practice PSAT or PreACT, if your school offers one, is a baseline — not a verdict.",
    "Start noting activities with what you did, not just the club name.",
  ],
  "11": [
    "Ask teachers, in person, whether they could write a recommendation later.",
    "Visit or compare a few colleges using their own pages, and write down the date you checked.",
    "Sketch essay ideas from real experiences. The draft stays in your words.",
    "Look up the federal student-aid form and your state's grant. Dates change; enter the ones you verify.",
  ],
  "12": [
    "Keep a list of each application's essays and the dates you confirmed.",
    "Finish recommendations and score sends only after you check each college's own instructions.",
    "File aid forms using the dates on the official sites, not a guessed calendar.",
  ],
};

const GOAL_QUESTIONS = {
  medicine: "Medicine in the US usually means a bachelor's degree first and the MCAT later, not the GRE. Ask your school which biology, chemistry, and physics courses it actually offers.",
  engineering: "Engineering paths lean on math and lab science. Ask which of those your school offers next year, and what the prerequisite is.",
  computing: "Computing paths vary. Ask whether your school offers a computer science course, and keep math moving.",
  business: "Business interest still benefits from math and writing. Ask which economics or math course is actually on the school's list.",
  law: "Law school is after college. For now, prioritize writing, history, and a strong grade record. Do not treat a high-school course list as a law-school plan.",
  arts: "Arts paths want samples of your work over time. Keep making the work, and ask which arts courses the school offers.",
  education: "Future teachers need a solid record in the subject they might teach. Ask which advanced course in that subject the school offers.",
  science: "Science paths depend on the lab sequence your school teaches. Ask for that sequence instead of assuming a course exists.",
  trades: "Trades and technical paths may use dual enrollment or a career center. Ask your counselor which of those your district actually runs.",
  other: "Describe the direction in your own words, then ask the school which courses match it.",
  undecided: "Undecided is a real answer. Use this year to sample a course and an activity, and write down what you liked.",
};

export function gradeChecklist(grade) {
  return CHECKS[grade] || CHECKS[""];
}

export function goalQuestion(goalChoice) {
  return GOAL_QUESTIONS[goalChoice] || "";
}

export function quickAsks(grade, goalChoice) {
  const asks = [];
  if (goalChoice === "medicine") asks.push("What should I understand about a medicine path and the MCAT?");
  if (goalChoice === "engineering") asks.push("What should I ask my school about math and science for engineering?");
  if (!grade || grade === "9" || grade === "10") asks.push("What should I pay attention to this year?");
  if (grade === "11" || grade === "12") asks.push("How do I compare two colleges without guessing my chances?");
  asks.push("How do I turn a low grade into a plan for this year?");
  asks.push("What belongs in a recommendation request?");
  return asks.slice(0, 3);
}

export function nextYearNotes(data) {
  const profile = data?.profile || {};
  const grade = profile.grade;
  const next = { "9": "10", "10": "11", "11": "12" }[grade] || "";
  const offerings = (data?.offerings || []).map((row) => row.name).filter(Boolean);
  const current = (profile.classes || []).map((row) => row.name).filter(Boolean);
  const items = [];
  if (!grade) {
    items.push({ title: "Add your grade", detail: "Next-year ideas stay generic until My Profile has a grade." });
  } else if (!next) {
    items.push({ title: "You are in 12th grade", detail: "The plan below is for applications and finish-strong habits, not a 13th-grade schedule." });
  } else {
    items.push({
      title: `Ideas to ask about for ${next}th grade`,
      detail: current.length
        ? `You listed ${current.join(", ")} for this year. Next year's courses should follow those, using the prerequisite rules your school publishes.`
        : "Add this year's classes first so a next-year idea has something real to follow.",
    });
  }
  const goal = goalQuestion(profile.goalChoice);
  if (goal) items.push({ title: "From the direction you chose", detail: goal });
  if (profile.goals?.trim()) {
    items.push({ title: "In your words", detail: profile.goals.trim() });
  }
  if (offerings.length) {
    items.push({ title: "Courses you entered from your school", detail: offerings.join(", ") });
  } else {
    items.push({
      title: "Your school's list is not in ARAHA",
      detail: "ARAHA will not invent the courses your school teaches. Add them under School courses after you read the catalog or ask a counselor.",
    });
  }
  return { items };
}

const LETTERS = { "A+": 12, A: 11, "A-": 10, "B+": 9, B: 8, "B-": 7, "C+": 6, C: 5, "C-": 4, "D+": 3, D: 2, "D-": 1, F: 0 };

export function letterValue(grade) {
  const key = String(grade || "").trim().toUpperCase().replace(/\s/g, "");
  return Object.prototype.hasOwnProperty.call(LETTERS, key) ? LETTERS[key] : null;
}

export function gradeNotes(classes) {
  const parsed = (classes || [])
    .filter((row) => row?.name?.trim() && letterValue(row.grade) != null)
    .map((row) => ({ name: row.name.trim(), grade: String(row.grade).trim().toUpperCase(), value: letterValue(row.grade) }));
  if (!parsed.length) {
    return { notes: ["No letter grades are entered yet. A trend appears only after you type real class grades."], low: [] };
  }
  const low = parsed.filter((row) => row.value <= LETTERS.C);
  const notes = parsed.map((row) => `${row.name}: ${row.grade}`);
  if (low.length) {
    notes.push(`${low.map((row) => row.name).join(", ")} ${low.length === 1 ? "is" : "are"} at a C or below in what you entered. That is a fact to plan around, not a judgment. Use this year for tutoring, a weekly review habit, and a question to the school about summer, bridge, or test-out options. Those are possibilities to verify, not a promise.`);
  } else {
    notes.push("The letter grades you entered are above a C. Keep the habits that produced them, and still ask the school what next year's prerequisite is.");
  }
  return { notes, low };
}

export function checkInDue(checkins, now = new Date()) {
  const latest = (checkins || []).map((row) => Date.parse(row.at)).filter((value) => !Number.isNaN(value)).sort((a, b) => b - a)[0];
  if (!latest) return true;
  return now.getTime() - latest >= 7 * 24 * 60 * 60 * 1000;
}

export function deadlineTemplates() {
  return [
    ["Confirm the tests you actually plan to take", "Test"],
    ["Ask two teachers about recommendations", "School event"],
    ["Write the essays yourself and track each prompt", "Application"],
    ["Check the federal student-aid form and your state grant on their own sites", "Other"],
    ["Write down each college's deadline after you read it", "Application"],
  ].map(([title, category]) => ({
    title,
    date: "",
    category,
    notes: "Template. Add the real date after you verify it. This is not a published deadline.",
    done: false,
    verified: false,
    source: "template",
  }));
}

export function intakeReady(profile) {
  return Boolean(profile?.intakeDone && String(profile.name || "").trim() && profile.grade);
}
