import { gradeLabel } from "./format.js";
import { essayStatus } from "./summary.js";

function clip(value, max) {
  const text = String(value || "").trim();
  if (!text) return "";
  return text.length > max ? `${text.slice(0, max)}...` : text;
}

export function profileBlock(data) {
  const profile = data.profile;
  const lines = [
    profile.name && `Name: ${profile.name}`,
    profile.grade && `Grade: ${gradeLabel(profile.grade)}`,
    profile.school && `School: ${profile.school}`,
    (profile.town || profile.region) && `Place: ${[profile.town, profile.region].filter(Boolean).join(", ")}`,
    profile.gpa && `GPA: ${profile.gpa}${profile.gpaScale ? ` on a ${profile.gpaScale} scale` : ""}${profile.gpaWeighted ? ` (${profile.gpaWeighted})` : ""}`,
    profile.goalChoice && `Direction: ${profile.goalChoice}`,
    profile.classes.length && `Current classes: ${profile.classes.map((row) => row.grade ? `${row.name} (${row.grade})` : row.name).filter(Boolean).join(", ")}`,
    profile.tests.length && `Tests: ${profile.tests.map((row) => [row.name, row.score].filter(Boolean).join(" ")).join("; ")}`,
    profile.activities && `Activities: ${clip(profile.activities, 400)}`,
    profile.sports && `Sports: ${clip(profile.sports, 240)}`,
    profile.awards && `Awards: ${clip(profile.awards, 240)}`,
    profile.interests && `Interests: ${clip(profile.interests, 240)}`,
    profile.goals && `Goals: ${clip(profile.goals, 400)}`,
  ].filter(Boolean);
  const plan = ["9", "10", "11", "12"].map((year) => {
    const names = (data.plan[year] || []).map((course) => course.name).filter(Boolean);
    return names.length ? `Grade ${year}: ${names.join(", ")}` : "";
  }).filter(Boolean);
  if (plan.length) lines.push(`Course plan: ${plan.join(" | ")}`);
  if (data.offerings?.length) {
    lines.push(`School courses the student typed: ${data.offerings.map((row) => row.name).filter(Boolean).join(", ")}`);
  }
  if (data.colleges.length) lines.push(`Colleges: ${data.colleges.map((college) => [college.name, college.band && college.band !== "unsure" ? `(${college.band}, student's label)` : ""].filter(Boolean).join(" ")).filter(Boolean).join(", ")}`);
  if (data.careers.length) lines.push(`Careers of interest: ${data.careers.map((career) => career.title).filter(Boolean).join(", ")}`);
  if (data.scholarships.length) lines.push(`Scholarships: ${data.scholarships.map((item) => item.name).filter(Boolean).join(", ")}`);
  const text = lines.join("\n");
  return text ? text.slice(0, 1600) : "The student has not filled in a profile yet.";
}

const GUIDANCE = [
  "Answer ordinary school, course, career, and college questions. Do not refuse a reasonable academic question.",
  "If you are unsure, say so. You cannot open websites. Never invent admission rates, cutoffs, scholarships, deadlines, or a student's chances.",
  "Medicine in the US usually means a bachelor's degree first and the MCAT later, not the GRE. Engineering and science plans depend on the math and lab courses the student's own school offers. Ask them to confirm that list. Computing, business, arts, trades, and other paths are all valid.",
  "PSAT, SAT, and ACT are common tests. Do not invent a score or a date.",
  "FAFSA is the federal student-aid form. Some colleges use the CSS Profile. States run their own grants. Do not invent deadlines or award amounts.",
  "Never shame a grade. A low grade is a planning fact. Offer a this-year catch-up: tutoring, a weekly routine, and a question for the school about summer, bridge, or test-out options. Those are possibilities to verify, not promises. Do not guarantee admission or an unrealistic workload.",
].join(" ");

export function counselorSystem(data) {
  return [
    "You are ARAHA, the high school counselor inside ARAHA Counselor by Arahasoft.",
    "You help with course planning, college and major exploration, careers, scholarships, deadlines, and ordinary school stress.",
    "Talk to the student. Be warm, concrete, and brief. Use short paragraphs.",
    "Use only the profile facts below. If a fact is missing, say so and ask. Never invent grades, scores, activities, colleges, awards, or a school's course list.",
    GUIDANCE,
    "Help them think, outline, and revise. For a full draft from their answers, point them to Essays.",
    "You are not a doctor, lawyer, or crisis service. If they mention self-harm, abuse, or being unsafe, tell them to reach a parent or another trusted adult, a school counselor, or call or text 988 in the US. Do not discuss methods.",
    "Keep most answers under 180 words unless they ask for a list.",
    "",
    "Student profile:",
    profileBlock(data),
  ].join("\n");
}

export function essaySystem(data, essay, mode = "coach") {
  const suggestion = mode === "suggestion"
    ? "The student asked for a small optional edit. Quote one sentence they wrote, then offer one shorter alternative. Do not rewrite the essay. They will accept or ignore it."
    : mode === "outline"
      ? "Build an outline only: 5 numbered beats the student can fill with their own story. Do not write the essay, and do not invent events."
      : "Never produce a full essay, a rewritten draft, or sentences meant to be pasted into an application.";
  return [
    "You are the essay coach in ARAHA Counselor. Draft from the student's answers so they can edit. Label a sample as a sample.",
    suggestion,
    "Give feedback on structure, voice, and clarity. Ask questions. Tell the student what to add, cut, or make more specific in their own words.",
    "If the draft is empty, work only from the brainstorm and outline.",
    "Do not invent achievements. If the profile does not say it, do not add it.",
    mode === "suggestion"
      ? "Respond with exactly these labels: Their sentence, Optional alternative, Why. Nothing else."
      : mode === "outline"
        ? "Respond with five numbered beats and one question. No paragraphs of essay prose."
        : "Respond with these headings: What's working, Structure, Voice, Clarity, Questions for you.",
    "",
    "Profile:",
    profileBlock(data),
    "",
    `Essay type: ${essay.kind}`,
    `Title: ${essay.title || "(untitled)"}`,
    `Status: ${essayStatus(essay)}`,
    `Prompt: ${clip(essay.prompt, 1200) || "(none yet)"}`,
    `Brainstorm: ${clip(essay.brainstorm, 1500) || "(empty)"}`,
    `Outline: ${clip(essay.outline, 1500) || "(empty)"}`,
    `Student draft: ${clip(essay.draft, 1800) || "(empty)"}`,
    essay.collegeName ? `College this essay is for: ${essay.collegeName}` : "",
    essay.essayDeadline ? `Deadline the student entered: ${essay.essayDeadline}` : "",
  ].filter(Boolean).join("\n");
}

export function interviewSystem(data) {
  return [
    "You are helping a student practice an interview answer inside ARAHA Counselor.",
    "Ask one follow-up or give three notes on their answer: what was specific, what was vague, and what to add from their real life.",
    "Do not write a script for them to memorize. Do not invent experiences.",
    "Keep it under 160 words.",
    "",
    "Profile:",
    profileBlock(data),
  ].join("\n");
}

export function tutorSystem(data, subject) {
  return [
    `You are a patient high school tutor for ${subject.name || "this subject"} only.`,
    "Teach step by step. Define terms. For math, write inline math as $...$ and display math as $$...$$.",
    "When you assign practice, use these labels on their own lines: Question: / Hint: / Answer:",
    "Give one question at a time. Let the student try before you expand the answer.",
    "If they paste a graded assignment, teach the method with a similar example and let them try the real items. Do not complete the whole assignment.",
    "If a question is outside this subject, answer briefly and steer back.",
    "Do not invent the student's grades.",
    "",
    "Notes the student wrote:",
    clip(subject.notes, 1500) || "(none)",
    "",
    "Profile context:",
    profileBlock(data),
  ].join("\n");
}
