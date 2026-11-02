import test from "node:test";
import assert from "node:assert/strict";
import { decryptJSON, deriveSecrets, encryptJSON, timingEqual } from "../src/crypto.js";
import { emptyData, exportPayload, normalizeData, parseBackup } from "../src/data.js";
import { buildMailto, emailSubject, essayStatus, parentEmails, progressSummary } from "../src/summary.js";
import { resolveTheme } from "../src/theme.js";
import { dueLabel } from "../src/format.js";
import { buildPdf } from "../src/pdf.js";

test("password round-trip locks the profile", async () => {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const { key, verifier } = await deriveSecrets("correct horse", salt, 1000);
  const cipher = await encryptJSON(key, { hello: "student" });
  const wrong = await deriveSecrets("nope nope nope", salt, 1000);
  assert.equal(timingEqual(verifier, wrong.verifier), false);
  const again = await deriveSecrets("correct horse", salt, 1000);
  assert.equal(timingEqual(verifier, again.verifier), true);
  assert.deepEqual(await decryptJSON(again.key, cipher), { hello: "student" });
});

test("backup keeps known fields and drops surprises", () => {
  const raw = normalizeData({
    profile: { name: "Alex", grade: "10", school: "East Windsor High School", parent1Email: "a@example.com", parent2Email: "b@example.com" },
    colleges: [{ name: "Sample University", majors: "history", status: "nope" }],
    extra: "<script>",
  });
  assert.equal(raw.profile.name, "Alex");
  assert.equal(raw.colleges[0].status, "researching");
  assert.equal(raw.extra, undefined);
  const file = exportPayload("Alex", raw);
  const parsed = parseBackup(JSON.stringify(file));
  assert.equal(parsed.username, "Alex");
  assert.equal(parsed.data.profile.school, "East Windsor High School");
  assert.throws(() => parseBackup("{}"), /Araha Counselor backup/);
});

test("progress letter addresses both parents and keeps the student's note", () => {
  const data = emptyData();
  data.profile.name = "Alex Rivera";
  data.profile.grade = "10";
  data.profile.parent1Email = "one@example.com";
  data.profile.parent2Email = "two@example.com";
  data.subjects.push({ id: "s", name: "Geometry", notes: "", messages: [], createdAt: "" });
  data.essays.push({ id: "e", title: "A bridge", kind: "college", prompt: "", brainstorm: "", outline: "", draft: "I built it.", feedback: "", updatedAt: "" });
  const summary = progressSummary(data, new Date("2026-11-02T12:00:00"));
  assert.match(summary, /STUDENT/);
  assert.match(summary, /FOUR-YEAR PLAN/);
  assert.match(summary, /Geometry/);
  assert.match(summary, /A bridge/);
  assert.match(summary, /not uploaded/i);
  assert.deepEqual(parentEmails(data), ["one@example.com", "two@example.com"]);
  const mail = buildMailto({
    emails: parentEmails(data),
    subject: emailSubject(data),
    message: "Hi, here is my week.",
    summary,
  });
  assert.match(mail.href, /^mailto:one@example.com,two@example.com\?/);
  assert.match(decodeURIComponent(mail.href), /Hi, here is my week/);
  assert.match(mail.href, /subject=/);
  assert.match(essayStatus(data.essays[0]), /Draft started/);
});

test("theme follows the device only in Auto", () => {
  assert.deepEqual(resolveTheme("auto", true), { choice: "auto", theme: "dark" });
  assert.deepEqual(resolveTheme("auto", false), { choice: "auto", theme: "light" });
  assert.equal(resolveTheme("light", true).theme, "light");
  assert.equal(resolveTheme("dark", false).theme, "dark");
  assert.equal(resolveTheme("nope", true).choice, "auto");
});

test("due labels are relative to a fixed day", () => {
  const now = new Date("2026-11-02T15:00:00");
  assert.equal(dueLabel("2026-11-02", now), "Today");
  assert.equal(dueLabel("2026-11-03", now), "Tomorrow");
  assert.equal(dueLabel("2026-11-01", now), "Yesterday");
});

test("pdf is generated on device without a network call", async () => {
  const data = emptyData();
  data.profile.name = "Alex Rivera";
  data.profile.grade = "10";
  data.plan["10"].push({ id: "c", name: "Geometry", level: "Honors", area: "Math", status: "current", credit: "1", notes: "" });
  const { blob, filename } = await buildPdf(data);
  const bytes = new Uint8Array(await blob.arrayBuffer());
  assert.equal(String.fromCharCode(...bytes.slice(0, 4)), "%PDF");
  assert.match(filename, /alex-rivera/);
});
