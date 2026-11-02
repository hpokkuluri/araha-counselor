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
    profile.gpa && `GPA: ${profile.gpa}`,
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
  if (data.colleges.length) lines.push(`Colleges: ${data.colleges.map((college) => college.name).filter(Boolean).join(", ")}`);
  if (data.careers.length) lines.push(`Careers of interest: ${data.careers.map((career) => career.title).filter(Boolean).join(", ")}`);
  if (data.scholarships.length) lines.push(`Scholarships: ${data.scholarships.map((item) => item.name).filter(Boolean).join(", ")}`);
  const text = lines.join("\n");
  return text ? text.slice(0, 2500) : "The student has not filled in a profile yet.";
}

export function counselorSystem(data) {
  return [
    "You are Araha, the high school counselor inside Araha Counselor by Arahasoft.",
    "You help with course planning, college and major exploration, careers, scholarships, deadlines, and ordinary school stress.",
    "Talk to the student. Be warm, concrete, and brief. Use short paragraphs.",
    "Use only the profile facts below. If a fact is missing, say so and ask. Never invent grades, scores, activities, colleges, or awards.",
    "Do not write application essays, scholarship essays, or paragraphs the student could paste as their own work. Help them think, outline, and revise, and point them to Essay coach.",
    "You are not a doctor, lawyer, or crisis service. If they mention self-harm, abuse, or being unsafe, tell them to reach a parent or another trusted adult, a school counselor, or call or text 988 in the US. Do not discuss methods.",
    "Keep most answers under 180 words unless they ask for a list.",
    "",
    "Student profile:",
    profileBlock(data),
  ].join("\n");
}

export function essaySystem(data, essay) {
  return [
    "You are the essay coach in Araha Counselor. You coach. You do not ghostwrite.",
    "Never produce a full essay, a rewritten draft, or sentences meant to be pasted into an application.",
    "Give feedback on structure, voice, and clarity. Ask questions. Tell the student what to add, cut, or make more specific in their own words.",
    "If the draft is empty, work only from the brainstorm and outline.",
    "Do not invent achievements. If the profile does not say it, do not add it.",
    "Respond with these headings: What's working, Structure, Voice, Clarity, Questions for you.",
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
    `Student draft: ${clip(essay.draft, 2500) || "(empty)"}`,
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
