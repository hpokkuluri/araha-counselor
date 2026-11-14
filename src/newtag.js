import { h } from "./dom.js";

const KEY = "araha-seen-features";
const EXPIRES = {
  "college-plan": "2026-11-28",
  "app-preview": "2026-11-28",
  "practice-mode": "2026-11-28",
  calculator: "2026-11-28",
  "adult-mode": "2026-11-28",
};

function seen() {
  try { return new Set(JSON.parse(localStorage.getItem(KEY) || "[]")); } catch { return new Set(); }
}

export function isNew(id) {
  const until = EXPIRES[id];
  if (!until || Date.now() > new Date(`${until}T23:59:59`).getTime()) return false;
  return !seen().has(id);
}

export function newTag(id) {
  return isNew(id) ? h("span", { class: "new-tag", "data-new": id }, "New") : null;
}

export function markSeen(id) {
  const set = seen();
  if (set.has(id)) return;
  set.add(id);
  try { localStorage.setItem(KEY, JSON.stringify([...set])); } catch { /* private mode */ }
  document.querySelectorAll(`[data-new="${id}"]`).forEach((el) => el.remove());
}
