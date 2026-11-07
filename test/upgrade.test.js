import test from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { emptyData, normalizeData } from "../src/data.js";
import { DESKTOP_7B_ID, LARGE_ID, PHONE_STEP_ID, SMALL_ID, chooseModelId, contextBudget, offeredModels, prefersSmallModel } from "../src/ai.js";
import { evaluateExpression } from "../src/calc.js";
import { checkInDue, deadlineTemplates, gradeNotes, intakeReady, nextYearNotes } from "../src/counsel.js";
import { keyboardInset } from "../src/layout.js";
import { readinessItems } from "../src/readiness.js";
import { speechSendsAudio, toMono16k } from "../src/speech.js";
import { OCR_DISCLOSURE } from "../src/ocr.js";
import { collegeSummary, findColleges, findSchools, referenceUrl } from "../src/reference.js";
import { parseCards, parseQuiz } from "../src/generated.js";
import { pathwayStatus, weakerPracticeFocus } from "../src/counsel.js";
import { applicationSections } from "../src/readiness.js";
import { readFileSync as readText } from "node:fs";

test("profile survives a cleared counselor chat", () => {
  const data = emptyData();
  data.profile.name = "Sam Lee";
  data.profile.grade = "10";
  data.profile.intakeDone = true;
  data.counselorMessages.push({ id: "1", role: "user", content: "hello", at: "2026-11-06T00:00:00.000Z" });
  data.counselorMessages = [];
  const saved = normalizeData(data);
  assert.equal(saved.profile.name, "Sam Lee");
  assert.equal(saved.profile.intakeDone, true);
  assert.equal(saved.counselorMessages.length, 0);
  assert.equal(intakeReady(saved.profile), true);
});

test("phone model choice stays small and blocks a 7B pick", () => {
  assert.equal(prefersSmallModel({ ios: true }), true);
  assert.equal(chooseModelId({ smallDevice: true }), SMALL_ID);
  assert.equal(chooseModelId({ savedId: LARGE_ID, smallDevice: true }), SMALL_ID);
  assert.equal(chooseModelId({ savedId: LARGE_ID, userPick: true, smallDevice: true }), LARGE_ID);
  assert.equal(chooseModelId({ savedId: DESKTOP_7B_ID, userPick: true, smallDevice: true }), SMALL_ID);
  assert.equal(chooseModelId({ savedId: PHONE_STEP_ID, userPick: true, smallDevice: true }), PHONE_STEP_ID);
  assert.equal(chooseModelId({ smallDevice: false }), LARGE_ID);
  assert.equal(chooseModelId({ savedId: DESKTOP_7B_ID, userPick: true, smallDevice: false }), DESKTOP_7B_ID);
  assert.deepEqual(contextBudget(true), { messages: 4, chars: 900, maxTokens: 320 });
  assert.equal(typeof offeredModels, "function");
});

test("calculator accepts arithmetic and rejects code", () => {
  assert.equal(evaluateExpression("(3+4)*2"), 14);
  assert.equal(evaluateExpression("sqrt(81)"), 9);
  assert.equal(evaluateExpression("50%"), 0.5);
  assert.throws(() => evaluateExpression("alert(1)"), /sqrt|read/i);
  assert.throws(() => evaluateExpression("1;2"), /read/i);
});

test("planning copy does not invent a school catalog or a deadline", () => {
  const data = emptyData();
  data.profile.grade = "10";
  data.profile.goalChoice = "medicine";
  const notes = nextYearNotes(data).items.map((item) => item.detail).join(" ");
  assert.match(notes, /will not invent|not in ARAHA|Ask your school/i);
  assert.doesNotMatch(notes, /East Windsor|pre-med guarantee|you are admitted/i);
  const templates = deadlineTemplates();
  assert.ok(templates.every((item) => item.date === "" && item.verified === false && item.source === "template"));
  const grades = gradeNotes([{ name: "Geometry", grade: "D" }]);
  assert.match(grades.notes.join(" "), /Geometry/);
  assert.match(grades.notes.join(" "), /not a judgment/);
  assert.equal(checkInDue([]), true);
  assert.equal(checkInDue([{ at: new Date().toISOString() }]), false);
});

test("application readiness is task completeness", () => {
  const data = emptyData();
  data.profile.name = "Sam";
  const report = readinessItems(data);
  assert.match(report.label, /not an admission chance/);
  assert.equal(report.items.find((item) => item.id === "name").done, true);
  assert.equal(report.items.find((item) => item.id === "college").done, false);
});

test("keyboard inset and speech stay local", () => {
  assert.equal(keyboardInset(800, 800, 0), 0);
  assert.equal(keyboardInset(800, 500, 0), 300);
  assert.equal(keyboardInset(800, 790, 0), 0);
  assert.equal(speechSendsAudio(), false);
  assert.match(OCR_DISCLOSURE, /not uploaded/);
  const css = readFileSync(new URL("../src/styles.css", import.meta.url), "utf8");
  assert.match(css, /\.composer[\s\S]*bottom:\s*var\(--kb/);
  assert.match(css, /--safe-b/);
});

test("packaged references and v2 helpers use real files, not guesses", () => {
  const colleges = JSON.parse(readText(new URL("../public/data/colleges.json", import.meta.url), "utf8"));
  const schools = JSON.parse(readText(new URL("../public/data/schools.json", import.meta.url), "utf8"));
  const harvard = findColleges(colleges, "Harvard University")[0];
  assert.equal(harvard.name, "Harvard University");
  assert.ok(harvard.admitRate > 0 && harvard.admitRate < 1);
  assert.match(collegeSummary(harvard, colleges).join(" "), /not your chance/);
  const chelsea = findSchools(schools, { zip: "35043" }).rows.find((row) => row.name === "Chelsea High School");
  assert.equal(chelsea.state, "AL");
  assert.equal(referenceUrl("/araha-counselor/", "colleges.json"), "/araha-counselor/data/colleges.json");
  const path = pathwayStatus(emptyData());
  path.profile = undefined;
  const med = pathwayStatus({ profile: { goalChoice: "medicine", classes: [] }, plan: { 9: [], 10: [], 11: [], 12: [] }, offerings: [] });
  assert.ok(med.steps.every((step) => step.status === "ask"));
  assert.match(med.note, /not your school's catalog|not a list of courses/i);
  const quizzes = parseQuiz("Q: Two plus two?\nA: 3\nB: 4\nC: 5\nD: 6\nAnswer: B\nWhy: 2+2=4\n");
  assert.equal(quizzes[0].answer, 1);
  assert.equal(parseCards("Front: cell\nBack: basic unit\n").length, 1);
  const audio = toMono16k({ sampleRate: 8000, getChannelData: () => new Float32Array([0, 1]) });
  assert.equal(audio.length, 4);
  assert.equal(weakerPracticeFocus([{ name: "SAT", sections: "math 500 reading 650" }]).focus, "Math");
  const brief = applicationSections(emptyData());
  assert.equal(brief.evidence.length, 0);
  const pkg = JSON.parse(readText(new URL("../package.json", import.meta.url), "utf8"));
  assert.equal(pkg.version, "2.0.0");
});

test("source does not call cloud speech or a chat API", () => {
  const files = [];
  const walk = (dir) => {
    for (const name of readdirSync(dir)) {
      const path = join(dir, name);
      if (statSync(path).isDirectory()) walk(path);
      else if (name.endsWith(".js")) files.push(path);
    }
  };
  walk(new URL("../src", import.meta.url).pathname);
  const source = files.map((file) => readFileSync(file, "utf8")).join("\n");
  assert.equal(/webkitSpeechRecognition|SpeechRecognition\(/.test(source), false);
  assert.equal(/api\.openai\.com|generativelanguage|speech\.googleapis/.test(source), false);
});
