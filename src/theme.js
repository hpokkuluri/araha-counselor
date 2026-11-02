import { icon } from "./icons.js";

export const THEME_KEY = "ac-theme";

export function resolveTheme(choice, prefersDark) {
  const safe = choice === "light" || choice === "dark" ? choice : "auto";
  const theme = safe === "dark" || (safe === "auto" && prefersDark) ? "dark" : "light";
  return { choice: safe, theme };
}

export function getChoice() {
  const attr = document.documentElement.getAttribute("data-theme-choice");
  if (attr === "light" || attr === "dark" || attr === "auto") return attr;
  try {
    const saved = localStorage.getItem(THEME_KEY);
    if (saved === "light" || saved === "dark" || saved === "auto") return saved;
  } catch { /* private mode */ }
  return "auto";
}

export function choiceLabel(choice = getChoice()) {
  if (choice === "light") return "Day";
  if (choice === "dark") return "Dark";
  return "Auto";
}

export function applyTheme(choice) {
  const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  const resolved = resolveTheme(choice, prefersDark);
  const root = document.documentElement;
  root.setAttribute("data-theme-choice", resolved.choice);
  root.setAttribute("data-theme", resolved.theme);
  root.style.colorScheme = resolved.theme;
  try { localStorage.setItem(THEME_KEY, resolved.choice); } catch { /* ignore */ }
  window.dispatchEvent(new CustomEvent("ac-theme"));
  return resolved;
}

export function syncThemeColor() {
  const meta = document.querySelector('meta[name="theme-color"]');
  if (!meta) return;
  meta.content = document.documentElement.dataset.theme === "dark" ? "#0E1B3D" : "#F3F5FA";
}

export function watchSystemTheme() {
  const mq = window.matchMedia("(prefers-color-scheme: dark)");
  const onChange = () => {
    if (getChoice() === "auto") applyTheme("auto");
  };
  mq.addEventListener?.("change", onChange);
}

function paintThemeButton(btn) {
  const choice = getChoice();
  btn.replaceChildren(icon(choice === "light" ? "sun" : choice === "dark" ? "moon" : "auto"));
  btn.setAttribute("aria-label", `Theme: ${choiceLabel(choice)}. Change theme.`);
  btn.title = `Theme: ${choiceLabel(choice)}`;
}

let themeListener = false;
export function themeButton() {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "icon-btn";
  btn.dataset.testid = "theme-toggle";
  paintThemeButton(btn);
  btn.addEventListener("click", () => openThemeMenu(btn));
  if (!themeListener) {
    themeListener = true;
    window.addEventListener("ac-theme", () => {
      document.querySelectorAll("[data-testid=theme-toggle]").forEach((node) => paintThemeButton(node));
    });
  }
  return btn;
}

function openThemeMenu(anchor) {
  document.querySelector(".theme-menu")?.remove();
  const menu = document.createElement("div");
  menu.className = "theme-menu";
  menu.setAttribute("role", "menu");
  menu.dataset.testid = "theme-menu";
  const current = getChoice();
  for (const [value, label, hint] of [
    ["auto", "Auto", "Follows this device"],
    ["light", "Day", "Light surfaces"],
    ["dark", "Dark", "Blue glow and gold"],
  ]) {
    const item = document.createElement("button");
    item.type = "button";
    item.className = value === current ? "on" : "";
    item.dataset.testid = `theme-${value}`;
    item.setAttribute("role", "menuitemradio");
    item.setAttribute("aria-checked", value === current ? "true" : "false");
    const name = document.createElement("b");
    name.textContent = label;
    const small = document.createElement("small");
    small.textContent = hint;
    item.append(name, small);
    item.addEventListener("click", () => {
      applyTheme(value);
      menu.remove();
    });
    menu.append(item);
  }
  document.body.append(menu);
  const rect = anchor.getBoundingClientRect();
  menu.style.top = `${Math.round(rect.bottom + 8)}px`;
  menu.style.right = `${Math.max(8, Math.round(window.innerWidth - rect.right))}px`;
  const close = (event) => {
    if (menu.contains(event.target) || event.target === anchor) return;
    menu.remove();
    document.removeEventListener("pointerdown", close, true);
  };
  setTimeout(() => document.addEventListener("pointerdown", close, true), 0);
}
