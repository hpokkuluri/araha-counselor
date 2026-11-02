import { setRenderer } from "./nav.js";
import { signedIn } from "./session.js";
import { mountAuth } from "./views/auth.js";
import { mountHome } from "./views/home.js";
import { mountChat } from "./views/chat.js";
import { mountProfile } from "./views/profile.js";
import { mountPlan } from "./views/plan.js";
import { mountColleges } from "./views/colleges.js";
import { mountCareers } from "./views/careers.js";
import { mountScholarships } from "./views/scholarships.js";
import { mountDeadlines } from "./views/deadlines.js";
import { mountEssay, mountEssayList } from "./views/essays.js";
import { mountStudy, mountSubject } from "./views/study.js";
import { mountParent } from "./views/parent.js";
import { mountProgress } from "./views/progress.js";
import { mountSettings } from "./views/settings.js";
import { mountModel } from "./views/model.js";

let current = null;
let seq = 0;
let nextPath = "/home";

function parseHash() {
  const raw = (location.hash || "#/home").replace(/^#/, "");
  const queryAt = raw.indexOf("?");
  const pathPart = queryAt === -1 ? raw : raw.slice(0, queryAt);
  const params = new URLSearchParams(queryAt === -1 ? "" : raw.slice(queryAt + 1));
  const parts = pathPart.split("/").filter(Boolean);
  const path = `/${parts.join("/")}` || "/home";
  const full = `${path}${params.toString() ? `?${params}` : ""}`;
  return { path, parts, params, full };
}

function draw(root) {
  const route = parseHash();
  if (!signedIn()) {
    if (route.path !== "/login") nextPath = route.full;
    return mountAuth(root, { next: nextPath });
  }
  if (route.path === "/login") {
    location.hash = "#/home";
    return { unmount() {} };
  }
  const [head, id] = route.parts;
  const titles = {
    "/home": "Counselor",
    "/chat": "Counselor",
    "/profile": "Profile",
    "/plan": "Four-year plan",
    "/colleges": "Colleges",
    "/careers": "Careers",
    "/scholarships": "Scholarships",
    "/deadlines": "Deadlines",
    "/essays": "Essays",
    "/study": "Subjects",
    "/parent": "Parent view",
    "/progress": "Progress",
    "/settings": "More",
    "/model": "On-device AI",
  };
  document.title = `${titles[route.path] || "Araha Counselor"} · Arahasoft`;
  if (head === "essay" && id) return mountEssay(root, id);
  if (head === "subject" && id) return mountSubject(root, id);
  if (route.path === "/chat") return mountChat(root, route.params.get("draft") || "");
  const pages = {
    "/home": mountHome,
    "/profile": mountProfile,
    "/plan": mountPlan,
    "/colleges": mountColleges,
    "/careers": mountCareers,
    "/scholarships": mountScholarships,
    "/deadlines": mountDeadlines,
    "/essays": mountEssayList,
    "/study": mountStudy,
    "/parent": mountParent,
    "/progress": mountProgress,
    "/settings": mountSettings,
    "/model": mountModel,
  };
  const mount = pages[route.path] || mountHome;
  return mount(root);
}

export function render() {
  const id = ++seq;
  const root = document.getElementById("app");
  current?.unmount?.();
  current = null;
  root.replaceChildren();
  Promise.resolve(draw(root)).then((view) => {
    if (id !== seq) {
      view?.unmount?.();
      return;
    }
    current = view || null;
  }).catch((error) => {
    root.replaceChildren();
    const p = document.createElement("p");
    p.className = "empty";
    p.textContent = error?.message || "This screen couldn't open.";
    root.append(p);
  });
}

setRenderer(render);

export function startRouter() {
  window.addEventListener("hashchange", render);
  if (!location.hash) location.hash = "#/login";
  else render();
}
