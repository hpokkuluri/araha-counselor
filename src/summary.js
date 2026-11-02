import { COLLEGE_STATUS, COURSE_STATUS, ESSAY_KINDS, SCHOLARSHIP_STATUS } from "./data.js";
import { allUpcoming, gradeLabel, prettyDate, statusLabel } from "./format.js";

function clip(value, max) {
  const text = String(value || "").trim().replace(/\s+/g, " ");
  if (!text) return "";
  if (text.length <= max) return text;
  return `${text.slice(0, max - 3).trimEnd()}...`;
}

function words(value) {
  return (String(value || "").trim().match(/\S+/g) || []).length;
}

export function essayStatus(essay) {
  const count = words(essay.draft);
  if (count) {
    const notes = essay.feedback?.trim() ? ", coach notes saved" : "";
    return `Draft started (${count} ${count === 1 ? "word" : "words"})${notes}`;
  }
  if (essay.outline?.trim()) return "Outline started";
  if (essay.brainstorm?.trim()) return "Brainstorm started";
  if (essay.prompt?.trim()) return "Prompt added";
  return "Not started";
}

export function parentEmails(data) {
  return [data.profile.parent1Email, data.profile.parent2Email]
    .map((value) => String(value || "").trim())
    .filter((value) => value.includes("@") && !value.includes(" "));
}

export function emailSubject(data) {
  const name = data.profile.name.trim();
  return name ? `Araha Counselor progress — ${name}` : "Araha Counselor progress";
}

function linesOf(items, render, empty) {
  if (!items.length) return [`- ${empty}`];
  return items.map(render);
}

export function progressSummary(data, now = new Date()) {
  const profile = data.profile;
  const when = now.toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" });
  const parents = [profile.parent1Name, profile.parent2Name].map((n) => n.trim()).filter(Boolean);
  const tutorQuestions = data.subjects.reduce((sum, subject) => (
    sum + subject.messages.filter((message) => message.role === "user").length
  ), 0);
  const myChats = data.counselorMessages.filter((message) => message.role === "user").length;
  const upcoming = allUpcoming(data).slice(0, 8);
  const out = [];

  out.push("ARAHA COUNSELOR");
  out.push("Progress summary");
  out.push(`Generated on this device, ${when}.`);
  if (parents.length) out.push(`Prepared for ${parents.join(" and ")}.`);
  out.push("");
  out.push("STUDENT");
  out.push(`Name: ${profile.name.trim() || "Not added yet"}`);
  out.push(`Grade: ${gradeLabel(profile.grade) || "Not added yet"}`);
  out.push(`School: ${profile.school.trim() || "Not added yet"}`);
  out.push(`GPA: ${profile.gpa.trim() || "Not added yet"}`);
  out.push("");
  out.push("CURRENT CLASSES");
  out.push(...linesOf(
    profile.classes.filter((row) => row.name.trim()),
    (row) => `- ${row.name}${row.grade.trim() ? ` — ${row.grade.trim()}` : ""}`,
    "None added yet",
  ));
  out.push("");
  out.push("TESTS");
  out.push(...linesOf(
    profile.tests.filter((row) => row.name.trim() || row.score.trim()),
    (row) => `- ${[row.name, row.score, row.date && prettyDate(row.date)].filter(Boolean).join(" — ")}`,
    "None added yet",
  ));
  for (const [label, value] of [
    ["ACTIVITIES", profile.activities],
    ["SPORTS", profile.sports],
    ["AWARDS", profile.awards],
    ["INTERESTS", profile.interests],
    ["GOALS", profile.goals],
  ]) {
    out.push("");
    out.push(label);
    out.push(clip(value, 500) || "Not added yet");
  }
  out.push("");
  out.push("STUDY ACTIVITY");
  out.push(`- Counselor messages from the student: ${myChats}`);
  out.push(`- Tutor questions asked: ${tutorQuestions}`);
  out.push(`- Active subjects: ${data.subjects.length}`);
  out.push("");
  out.push("SUBJECTS");
  out.push(...linesOf(data.subjects, (subject) => {
    const questions = subject.messages.filter((message) => message.role === "user").length;
    const notes = clip(subject.notes, 180);
    return `- ${subject.name || "Untitled"} — ${questions} tutor ${questions === 1 ? "question" : "questions"}${notes ? ` — ${notes}` : ""}`;
  }, "None added yet"));
  out.push("");
  out.push("FOUR-YEAR PLAN");
  for (const year of ["9", "10", "11", "12"]) {
    const courses = data.plan[year] || [];
    out.push(`${gradeLabel(year)}:`);
    if (!courses.length) {
      out.push("- No courses yet");
      continue;
    }
    for (const course of courses) {
      out.push(`- ${course.name || "Untitled course"} (${course.level}, ${course.area}) — ${statusLabel(COURSE_STATUS, course.status)}`);
    }
  }
  out.push("");
  out.push("COMING UP");
  out.push(...linesOf(upcoming, (item) => (
    `- ${prettyDate(item.date)} — ${item.title} [${item.category}]`
  ), "Nothing scheduled"));
  out.push("");
  out.push("COLLEGES");
  out.push(...linesOf(data.colleges, (college) => {
    const bits = [college.name || "Untitled", college.location, statusLabel(COLLEGE_STATUS, college.status)].filter(Boolean);
    const majors = college.majors.trim() ? ` — majors: ${clip(college.majors, 120)}` : "";
    return `- ${bits.join(" — ")}${majors}`;
  }, "None saved yet"));
  out.push("");
  out.push("SCHOLARSHIPS");
  out.push(...linesOf(data.scholarships, (item) => {
    const bits = [item.name || "Untitled", item.amount && `amount ${item.amount}`, item.deadline && `due ${prettyDate(item.deadline)}`, statusLabel(SCHOLARSHIP_STATUS, item.status)];
    return `- ${bits.filter(Boolean).join(" — ")}`;
  }, "None tracked yet"));
  out.push("");
  out.push("ESSAYS");
  out.push(...linesOf(data.essays, (essay) => (
    `- ${essay.title || "Untitled"} — ${statusLabel(ESSAY_KINDS, essay.kind)} — ${essayStatus(essay)}`
  ), "None started yet"));
  out.push("");
  out.push("This summary was created in Araha Counselor on the student's device.");
  out.push("It was not uploaded to Arahasoft.");
  return out.join("\n");
}

export function letterBody(message, summary) {
  const note = String(message || "").trim();
  return note ? `${note}\n\n${summary}` : summary;
}

export function buildMailto({ emails, subject, message, summary }) {
  const body = letterBody(message, summary);
  const href = `mailto:${emails.join(",")}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  return { href, body, tooLong: href.length > 1900 };
}
