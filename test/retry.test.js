import test from "node:test";
import assert from "node:assert/strict";
import { FRIENDLY_BUSY, isRetryable, retryDelay, withGeminiRetry } from "../src/cloud.js";

test("retries busy, quota, and network errors", () => {
  assert.equal(isRetryable({ status: 500, message: "This model is currently experiencing high demand" }), true);
  assert.equal(isRetryable({ message: "429 RESOURCE_EXHAUSTED quota" }), true);
  assert.equal(isRetryable(new Error("Error fetching from .../gemini-3.5-flash-lite: 503 overloaded")), true);
  assert.equal(isRetryable(new Error("Failed to fetch")), true);
  assert.equal(isRetryable(new Error("safety blocked this prompt")), false);
  const waits = [0, 1, 2, 3].map((n) => retryDelay(n, new Error("500 high demand")));
  assert.ok(waits[0] >= 1000 && waits[0] <= 1500);
  assert.ok(waits[1] >= 2000 && waits[1] <= 2500);
  assert.ok(waits[2] >= 4000 && waits[2] <= 4500);
  assert.ok(waits[3] >= 8000 && waits[3] <= 8500);
  const quota = retryDelay(0, { message: "429 quota" });
  assert.ok(quota >= 10000 && quota <= 20500);
});

test("withGeminiRetry backs off, then falls back, then uses the friendly error", async () => {
  const seen = [];
  const retries = [];
  let n = 0;
  await assert.rejects(() => withGeminiRetry(async (name) => {
    seen.push(name);
    n += 1;
    const err = new Error(n < 3 ? "500 high demand" : "429 quota");
    throw err;
  }, { onRetry: (info) => retries.push(info), wait: async () => {} }), (err) => err.message === FRIENDLY_BUSY && err.busy === true);
  assert.equal(seen.length, 5);
  assert.equal(seen[0], "gemini-3.5-flash-lite");
  assert.equal(seen[1], "gemini-3.5-flash-lite");
  assert.equal(seen[2], "gemini-3.5-flash");
  assert.equal(seen[3], "gemini-3.8-flash");
  assert.equal(retries.length, 4);
});
