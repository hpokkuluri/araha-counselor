export const PRACTICE_NOTE = "ARAHA original practice. These are not official SAT, PSAT, ACT, or AP questions.";

export const PRACTICE = [
  {
    id: "alg-1",
    area: "Math",
    prompt: "A notebook costs $4 more than a pen. Together they cost $10. What does the pen cost?",
    choices: ["$2", "$3", "$4", "$6"],
    answer: 1,
    explain: "Let the pen be x. Then x + (x + 4) = 10, so 2x = 6 and x = 3.",
  },
  {
    id: "alg-2",
    area: "Math",
    prompt: "Which value of x makes 3(x - 2) = 15 true?",
    choices: ["3", "5", "7", "9"],
    answer: 2,
    explain: "3(x - 2) = 15 means x - 2 = 5, so x = 7.",
  },
  {
    id: "read-1",
    area: "Reading",
    prompt: "A student wrote: \"The lab failed, which proves I cannot do science.\" What is the fairest reading of that sentence?",
    choices: [
      "One result decides a whole career.",
      "The lab result is data about that attempt, not a verdict on the student.",
      "The student should drop science this year.",
      "The sentence reports an official grade.",
    ],
    answer: 1,
    explain: "One attempt is evidence about that attempt. It does not prove a permanent limit.",
  },
  {
    id: "read-2",
    area: "Reading",
    prompt: "Which sentence states a source instead of a guess?",
    choices: [
      "This college probably accepts everyone with a 3.5.",
      "The college site, checked by the student on a date they wrote down, lists the test as optional.",
      "Most students get a full scholarship.",
      "A high GPA guarantees admission.",
    ],
    answer: 1,
    explain: "A claim tied to a page the student actually checked is a source. The others are guesses.",
  },
  {
    id: "data-1",
    area: "Math",
    prompt: "A quiz is scored 8 out of 10, then 6 out of 10. Which statement uses only those scores?",
    choices: [
      "The student will fail the course.",
      "The second score is lower than the first.",
      "The student cannot learn the topic.",
      "The college will reject the student.",
    ],
    answer: 1,
    explain: "8/10 then 6/10 shows a lower second score. It does not decide a course grade or an admission.",
  },
  {
    id: "plan-1",
    area: "Planning",
    prompt: "A school has not said whether it offers AP Physics. What is the accurate next step?",
    choices: [
      "Assume it is offered next year.",
      "Ask the school, and keep a backup course the student can confirm.",
      "Treat a website from another district as this school's list.",
      "Drop physics goals for good.",
    ],
    answer: 1,
    explain: "Only the student's school can confirm its own list. Until then, the course is a question, not a fact.",
  },
];

export function practiceFor(subjectName = "") {
  const name = String(subjectName || "").toLowerCase();
  const math = /math|algebra|geometry|calc|stat/.test(name);
  const reading = /english|read|history|writing|literature/.test(name);
  const rows = PRACTICE.filter((item) => {
    if (math) return item.area === "Math";
    if (reading) return item.area === "Reading" || item.area === "Planning";
    return true;
  });
  return rows.length ? rows : PRACTICE;
}
