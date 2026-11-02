import { ITERATIONS } from "./crypto.js";

export const LEVELS = ["Regular", "Honors", "AP", "IB", "Dual enrollment"];
export const AREAS = ["English", "Math", "Science", "Social studies", "World language", "Arts", "PE", "Elective", "Other"];
export const COURSE_STATUS = [["planned", "Planned"], ["current", "In progress"], ["done", "Completed"]];
export const COLLEGE_STATUS = [
  ["researching", "Researching"],
  ["visiting", "Planning to visit"],
  ["applying", "Applying"],
  ["applied", "Applied"],
  ["decided", "Decided"],
];
export const SCHOLARSHIP_STATUS = [
  ["interested", "Interested"],
  ["drafting", "Drafting"],
  ["submitted", "Submitted"],
  ["awarded", "Awarded"],
  ["closed", "Closed"],
];
export const DEADLINE_CATS = ["Test", "Application", "School event", "Scholarship", "Other"];
export const ESSAY_KINDS = [
  ["school", "School"],
  ["college", "College application"],
  ["scholarship", "Scholarship"],
  ["other", "Other"],
];
export const RECOMMENDED_MODEL = "Qwen2.5-3B-Instruct-q4f16_1-MLC";

const LIMITS = { short: 160, mid: 400, long: 8000, list: 80, messages: 80 };

export function uid() {
  return crypto.randomUUID();
}

export function emptyData() {
  const now = new Date().toISOString();
  return {
    version: 1,
    profile: emptyProfile(),
    plan: { "9": [], "10": [], "11": [], "12": [] },
    colleges: [],
    careers: [],
    scholarships: [],
    deadlines: [],
    essays: [],
    subjects: [],
    counselorMessages: [],
    activity: [],
    shareNote: "",
    parentPin: null,
    settings: { wifiOnly: true, modelId: RECOMMENDED_MODEL },
    createdAt: now,
    updatedAt: now,
  };
}

function emptyProfile() {
  return {
    name: "",
    grade: "",
    school: "",
    gpa: "",
    classes: [],
    tests: [],
    activities: "",
    sports: "",
    awards: "",
    interests: "",
    goals: "",
    parent1Name: "",
    parent1Email: "",
    parent2Name: "",
    parent2Email: "",
  };
}

function str(value, max) {
  return String(value ?? "").slice(0, max);
}

function oneOf(value, allowed, fallback) {
  return allowed.includes(value) ? value : fallback;
}

function list(value, map, max = LIMITS.list) {
  if (!Array.isArray(value)) return [];
  return value.slice(0, max).map(map).filter(Boolean);
}

export function normalizeData(raw) {
  const base = emptyData();
  const d = raw && typeof raw === "object" ? raw : {};
  const profile = d.profile && typeof d.profile === "object" ? d.profile : {};
  const plan = d.plan && typeof d.plan === "object" ? d.plan : {};
  const settings = d.settings && typeof d.settings === "object" ? d.settings : {};
  const pin = d.parentPin && typeof d.parentPin === "object" ? d.parentPin : null;
  return {
    version: 1,
    profile: {
      name: str(profile.name, LIMITS.short),
      grade: oneOf(String(profile.grade || ""), ["9", "10", "11", "12"], ""),
      school: str(profile.school, LIMITS.short),
      gpa: str(profile.gpa, 40),
      classes: list(profile.classes, (row) => row && ({
        id: str(row.id, 80) || uid(),
        name: str(row.name, LIMITS.short),
        grade: str(row.grade, 20),
      })),
      tests: list(profile.tests, (row) => row && ({
        id: str(row.id, 80) || uid(),
        name: str(row.name, LIMITS.short),
        score: str(row.score, 40),
        date: str(row.date, 20),
      })),
      activities: str(profile.activities, LIMITS.long),
      sports: str(profile.sports, LIMITS.long),
      awards: str(profile.awards, LIMITS.long),
      interests: str(profile.interests, LIMITS.long),
      goals: str(profile.goals, LIMITS.long),
      parent1Name: str(profile.parent1Name, LIMITS.short),
      parent1Email: str(profile.parent1Email, LIMITS.short),
      parent2Name: str(profile.parent2Name, LIMITS.short),
      parent2Email: str(profile.parent2Email, LIMITS.short),
    },
    plan: {
      "9": list(plan["9"], course),
      "10": list(plan["10"], course),
      "11": list(plan["11"], course),
      "12": list(plan["12"], course),
    },
    colleges: list(d.colleges, (row) => row && ({
      id: str(row.id, 80) || uid(),
      name: str(row.name, LIMITS.short),
      location: str(row.location, LIMITS.short),
      majors: str(row.majors, LIMITS.mid),
      status: oneOf(row.status, COLLEGE_STATUS.map(([id]) => id), "researching"),
      notes: str(row.notes, LIMITS.long),
    })),
    careers: list(d.careers, (row) => row && ({
      id: str(row.id, 80) || uid(),
      title: str(row.title, LIMITS.short),
      fit: str(row.fit, LIMITS.long),
      notes: str(row.notes, LIMITS.long),
    })),
    scholarships: list(d.scholarships, (row) => row && ({
      id: str(row.id, 80) || uid(),
      name: str(row.name, LIMITS.short),
      amount: str(row.amount, 40),
      deadline: str(row.deadline, 20),
      status: oneOf(row.status, SCHOLARSHIP_STATUS.map(([id]) => id), "interested"),
      notes: str(row.notes, LIMITS.long),
    })),
    deadlines: list(d.deadlines, (row) => row && ({
      id: str(row.id, 80) || uid(),
      title: str(row.title, LIMITS.short),
      date: str(row.date, 20),
      category: oneOf(row.category, DEADLINE_CATS, "Other"),
      notes: str(row.notes, LIMITS.long),
      done: Boolean(row.done),
    })),
    essays: list(d.essays, (row) => row && ({
      id: str(row.id, 80) || uid(),
      title: str(row.title, LIMITS.short),
      kind: oneOf(row.kind, ESSAY_KINDS.map(([id]) => id), "college"),
      prompt: str(row.prompt, LIMITS.long),
      brainstorm: str(row.brainstorm, LIMITS.long),
      outline: str(row.outline, LIMITS.long),
      draft: str(row.draft, 20000),
      feedback: str(row.feedback, 20000),
      updatedAt: str(row.updatedAt, 40),
    })),
    subjects: list(d.subjects, (row) => row && ({
      id: str(row.id, 80) || uid(),
      name: str(row.name, LIMITS.short),
      notes: str(row.notes, LIMITS.long),
      messages: list(row.messages, message, LIMITS.messages),
      createdAt: str(row.createdAt, 40),
    })),
    counselorMessages: list(d.counselorMessages, message, LIMITS.messages),
    activity: list(d.activity, (row) => row && row.kind && ({
      id: str(row.id, 80) || uid(),
      at: str(row.at, 40),
      kind: str(row.kind, 40),
      label: str(row.label, 200),
    }), 300),
    shareNote: str(d.shareNote, 2000),
    parentPin: pin && pin.salt && pin.verifier ? {
      salt: str(pin.salt, 80),
      verifier: str(pin.verifier, 80),
      iterations: Number(pin.iterations) || 80000,
    } : null,
    settings: {
      wifiOnly: settings.wifiOnly !== false,
      modelId: str(settings.modelId, 120) || RECOMMENDED_MODEL,
    },
    createdAt: str(d.createdAt, 40) || base.createdAt,
    updatedAt: str(d.updatedAt, 40) || base.updatedAt,
  };
}

function course(row) {
  if (!row || typeof row !== "object") return null;
  return {
    id: str(row.id, 80) || uid(),
    name: str(row.name, LIMITS.short),
    level: oneOf(row.level, LEVELS, "Regular"),
    area: oneOf(row.area, AREAS, "Other"),
    status: oneOf(row.status, COURSE_STATUS.map(([id]) => id), "planned"),
    credit: str(row.credit, 10),
    notes: str(row.notes, LIMITS.mid),
  };
}

function message(row) {
  if (!row || (row.role !== "user" && row.role !== "assistant")) return null;
  return {
    id: str(row.id, 80) || uid(),
    role: row.role,
    content: str(row.content, LIMITS.long),
    at: str(row.at, 40),
  };
}

export function pushActivity(data, kind, label) {
  data.activity.unshift({ id: uid(), at: new Date().toISOString(), kind, label: String(label || "").slice(0, 200) });
  if (data.activity.length > 300) data.activity.length = 300;
}

export function exportPayload(username, data) {
  return {
    app: "araha-counselor",
    format: 1,
    exportedAt: new Date().toISOString(),
    username: String(username || ""),
    kdf: "not-included",
    note: "Readable backup. Keep this file private. It is not encrypted.",
    data: normalizeData(data),
  };
}

export function parseBackup(text) {
  let value;
  try { value = JSON.parse(text); } catch { throw new Error("That file isn't valid JSON."); }
  if (!value || value.app !== "araha-counselor" || value.format !== 1 || !value.data) {
    throw new Error("That file isn't an ARAHA Counselor backup.");
  }
  return { username: String(value.username || "").trim(), data: normalizeData(value.data) };
}

export { ITERATIONS };
