import test from "node:test";
import assert from "node:assert/strict";
import { decryptJSON, deriveSecrets, encryptJSON, timingEqual } from "../src/crypto.js";
import { emptyData, exportPayload, normalizeData, parseBackup } from "../src/data.js";
import { buildMailto, emailSubject, essayStatus, parentEmails, progressSummary } from "../src/summary.js";
import { resolveTheme } from "../src/theme.js";
import { dueLabel } from "../src/format.js";
import { buildPdf } from "../src/pdf.js";
import { LARGE_ID, SMALL_ID, chooseModelId, complete, currentModelId, installEngineForTest, loadModel, noteInterruptedLoad, prefersSmallModel, resetConversation, stopGeneration } from "../src/ai.js";

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
  assert.throws(() => parseBackup("{}"), /ARAHA Counselor backup/);
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

test("phones and low memory default to the small model", () => {
  assert.equal(prefersSmallModel({ ios: true }), true);
  assert.equal(prefersSmallModel({ android: true }), true);
  assert.equal(prefersSmallModel({ phone: true }), true);
  assert.equal(prefersSmallModel({ deviceMemory: 4 }), true);
  assert.equal(prefersSmallModel({ narrow: true }), true);
  assert.equal(prefersSmallModel({ maxBufferSize: 256 * 1024 * 1024 }), true);
  assert.equal(prefersSmallModel({ maxStorageBufferBindingSize: 512 * 1024 * 1024 }), true);
  assert.equal(prefersSmallModel({}), false);
  assert.equal(chooseModelId({ savedId: LARGE_ID, smallDevice: true }), SMALL_ID);
  assert.equal(chooseModelId({ savedId: LARGE_ID, userPick: true, smallDevice: true }), LARGE_ID);
  assert.equal(chooseModelId({ smallDevice: false }), LARGE_ID);
});

test("a killed model load is marked too big and not retried", () => {
  const store = new Map();
  const mem = {
    getItem: (key) => (store.has(key) ? store.get(key) : null),
    setItem: (key, value) => store.set(key, value),
    removeItem: (key) => store.delete(key),
  };
  mem.setItem("ac-model-load", LARGE_ID);
  const note = noteInterruptedLoad(mem);
  assert.match(note, /smaller model/);
  assert.equal(mem.getItem("ac-model-load"), null);
  const tooBig = JSON.parse(mem.getItem("ac-model-too-big"));
  assert.equal(chooseModelId({ savedId: LARGE_ID, userPick: true, tooBig, smallDevice: false }), SMALL_ID);
});

test("clear and stop keep the shared engine loaded", async () => {
  const calls = [];
  const stub = {
    modelId: "phone-model",
    worker: { terminate() { calls.push("terminate"); } },
    unload: async () => { calls.push("unload"); },
    resetChat: async () => { calls.push("reset"); },
    interruptGenerate: async () => { calls.push("interrupt"); },
    chat: {
      completions: {
        create: async (payload) => {
          calls.push(payload.stream ? "stream" : "once");
          if (!payload.stream) return { choices: [{ message: { content: "ok" } }] };
          return (async function* () {
            yield { choices: [{ delta: { content: "Hi" } }] };
          })();
        },
      },
    },
  };
  installEngineForTest(stub);
  try {
    const again = await loadModel("phone-model");
    assert.equal(again, stub);
    const first = await complete({
      system: "Be brief.",
      threadKey: "counselor",
      messages: [{ role: "user", content: "Hello" }],
    });
    const second = await complete({
      system: "Be brief.",
      threadKey: "counselor",
      messages: [{ role: "user", content: "Thanks" }],
    });
    assert.equal(first, "Hi");
    assert.equal(second, "Hi");
    assert.equal(calls.filter((call) => call === "reset").length, 0);
    await complete({
      system: "Tutor.",
      threadKey: "subject:geometry",
      messages: [{ role: "user", content: "Hint" }],
    });
    assert.equal(calls.filter((call) => call === "reset").length, 1);
    calls.length = 0;
    await stopGeneration();
    assert.deepEqual(calls, ["interrupt"]);
    await resetConversation();
    assert.equal(currentModelId(), "phone-model");
    assert.equal(calls.includes("reset"), true);
    assert.equal(calls.includes("unload"), false);
    assert.equal(calls.includes("terminate"), false);
    assert.equal(await loadModel("phone-model"), stub);
  } finally {
    installEngineForTest(null);
  }
});
