import { h, field, txt, toast } from "../dom.js";
import { markSeen } from "../newtag.js";
import { shell } from "../shell.js";
import { session, update, usesCloud } from "../session.js";
import { pushActivity, uid } from "../data.js";
import { geminiText } from "../cloud.js";
import { navigate } from "../nav.js";
import { TONE } from "../prompts.js";

export const PLAN_VERSION = 2;

const HINT = "Suggestions are estimates from public information like acceptance rates and typical scores. They are not guarantees, and you can always aim higher.";

export function parsePlanJSON(raw) {
  const text = String(raw || "").replace(/```(?:json)?/gi, "").trim();
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end <= start) return null;
  try {
    const obj = JSON.parse(text.slice(start, end + 1));
    return obj && typeof obj === "object" ? obj : null;
  } catch {
    return null;
  }
}

const arr = (value) => (Array.isArray(value) ? value : []);
const s = (value) => (value == null ? "" : String(value));

export function readiness(data, inputs = {}) {
  const p = data.profile;
  const graded = p.classes.filter((c) => c.name?.trim() && c.grade?.trim());
  const areas = {
    academics: Boolean(p.gpa?.trim() || graded.length),
    tests: Boolean(p.tests.some((t) => t.score?.trim()) || data.testAttempts.length),
    interests: Boolean(p.interests?.trim() || p.goals?.trim() || p.goalChoice || inputs.major),
    activities: Boolean(p.activities?.trim() || p.sports?.trim() || p.awards?.trim()),
  };
  const count = Object.values(areas).filter(Boolean).length;
  const missing = [];
  if (!p.grade) missing.push("your grade");
  if (!areas.academics) missing.push("your GPA or class grades");
  if (!areas.tests) missing.push("a test score (PSAT, SAT, ACT) or a practice test in Test prep");
  if (!areas.interests) missing.push("your interests or intended major");
  if (!areas.activities) missing.push("your activities, sports, or awards");
  const ready = (areas.academics || areas.tests) && count >= 2;
  return { ready, areas, count, missing };
}

function facts(data, inputs) {
  const p = data.profile;
  const unknown = (v) => (v && String(v).trim() ? String(v).trim() : "unknown");
  return {
    grade: unknown(p.grade),
    school: unknown(p.school),
    location: unknown([p.town, p.region].filter(Boolean).join(", ")),
    gpa: p.gpa ? `${p.gpa}${p.gpaScale ? ` on ${p.gpaScale} scale` : ""}${p.gpaWeighted ? ` (${p.gpaWeighted})` : ""}` : "unknown",
    classes: p.classes.filter((c) => c.name?.trim()).map((c) => [c.name, c.level !== "Regular" ? c.level : "", c.grade ? `grade ${c.grade}` : ""].filter(Boolean).join(" ")),
    testScores: p.tests.filter((t) => t.name || t.score).map((t) => [t.name, t.score, t.sections].filter(Boolean).join(" ")),
    practiceTestsInApp: data.testAttempts.slice(0, 5).map((a) => `${a.exam} ${a.correct}/${a.total} correct`),
    activities: unknown(p.activities),
    sports: unknown(p.sports),
    awards: unknown(p.awards),
    interests: unknown(p.interests),
    goals: unknown(p.goals || p.goalChoice),
    intendedMajor: unknown(inputs.major),
    budget: unknown(inputs.budget),
    locationPreference: unknown(inputs.location),
    dreamCollege: unknown(inputs.dream),
    essaysStarted: data.essays.filter((e) => e.draft?.trim() || e.outline?.trim()).map((e) => e.title || e.kind),
    collegesStudentSaved: data.colleges.map((c) => c.name).filter(Boolean),
  };
}

const RULES = [
  "STRICT RULES:",
  "- Use ONLY facts present in the PROFILE JSON below. Never invent strengths, achievements, activities, grades, or scores.",
  "- A field marked \"unknown\" or an empty list means the student has not shared it. Say it is unknown; never assume a value.",
  "- Every strength MUST cite specific data from the PROFILE JSON (e.g. \"GPA 3.8\", \"robotics club\"). Never use filler like \"starting early\", \"blank slate\", or \"motivation\". If no real strength is in the data, return \"strengths\": [].",
].join("\n");

export function promptFor(data, inputs, mode) {
  const grade = data.profile.grade || "unknown";
  const profileJSON = JSON.stringify(facts(data, inputs), null, 1);
  const shared = [
    "Act as an experienced, honest high school college counselor.",
    TONE,
    RULES,
    `PROFILE JSON:\n${profileJSON}`,
  ];
  if (mode === "starter") {
    return [
      ...shared,
      "The profile is too thin for college suggestions. Do NOT name any colleges or universities at all. Do not invent facts about the student.",
      `Write a generic starter action plan for a student in grade ${grade} (if grade is unknown, assume early high school), from now through the end of next school year. Focus on: getting strong grades, trying activities that match their interests, taking a PSAT or practice test, and filling in their profile.`,
      "Reply with ONLY valid JSON, no markdown:",
      '{"summary":"2 honest, encouraging sentences","strengths":[],"improve":[{"area":"...","fix":"concrete action"}],"plan":[{"term":"Grade 10 Spring","courses":["..."],"tests":["..."],"activities":["..."],"summer":["..."],"essays":[],"applications":[]}]}',
    ].join("\n\n");
  }
  return [
    ...shared,
    "Suggest colleges CALIBRATED to the student's actual GPA and scores, using known acceptance rates and middle-50% SAT/ACT ranges. A college counts as: likely if the student's numbers are well above its typical range and admit rate is high; target if their numbers sit in its middle-50% range; reach if below range or admit rate under ~20%. If GPA or scores are unknown, weight what is known and say in each fit line which data is missing. Prefer realistic options for a New Jersey student plus matches for their interests and preferences.",
    "Each college reason MUST reference the student's own data (e.g. \"your 3.4 GPA fits its range\").",
    "If dreamCollege is not unknown, you may include it ONLY in reach (or wherever it honestly fits) with an honest note on the gap between their current numbers and its typical admits, and how to close it. Do not add highly selective colleges (admit rate under 15%) otherwise unless the student's numbers are in their range.",
    `Build the semester plan from the current semester of grade ${grade} through spring of grade 12, aimed at the target college you set in targetCollege (use dreamCollege if given).`,
    "Reply with ONLY valid JSON, no markdown:",
    '{"summary":"2 honest, encouraging sentences about where they stand","strengths":["each citing real data"],"improve":[{"area":"...","fix":"concrete action"}],"colleges":{"reach":[{"name":"...","reason":"one line citing their data","fit":"what fits / gap"}],"target":[...],"likely":[...]},"targetCollege":"name","dreamGap":"honest gap note and how to close it, or empty","plan":[{"term":"Grade 10 Spring","courses":["..."],"tests":["..."],"activities":["..."],"summer":["..."],"essays":["..."],"applications":["..."]}],"fillIn":["profile items still unknown"]}',
    "3-4 colleges per band. Plan items are short checklist actions.",
  ].join("\n\n");
}

export function mountCollegePlan(root) {
  markSeen("college-plan");
  const view = shell(root, { title: "College plan", tab: "plan", back: "/home" });
  const host = h("div", { class: "stack", "data-testid": "college-plan" });
  view.content.append(host);
  let busy = false;
  const saved = () => (session.data.collegePlan?.v === PLAN_VERSION ? session.data.collegePlan : null);
  if (session.data.collegePlan && session.data.collegePlan.v !== PLAN_VERSION) update((data) => { data.collegePlan = null; });

  const paint = (status = "") => {
    const plan = saved();
    const dream = txt({ value: plan?.dream || "", placeholder: "e.g. Rutgers, Georgia Tech, MIT", "data-testid": "cp-dream" });
    const major = txt({ value: plan?.major || "", placeholder: "e.g. computer science" });
    const budget = txt({ value: plan?.budget || "", placeholder: "e.g. under $30k/year, in-state preferred" });
    const location = txt({ value: plan?.location || "", placeholder: "e.g. Northeast, near NJ, anywhere" });
    const check = readiness(session.data, plan || {});
    const go = h("button", { class: "btn gold wide", type: "submit", disabled: busy, "data-testid": "cp-generate" }, busy ? "Building your plan…" : !check.ready ? (plan ? "Refresh my starter plan" : "Get my starter plan") : plan ? "Regenerate my plan" : "Build my college plan");
    const form = h("form", { class: "card stack" }, [
      h("h2", {}, plan ? "Update your plan" : "Tell me a little more (optional)"),
      field("Dream or target college", dream),
      field("Intended major", major),
      field("Budget", budget),
      field("Location preference", location),
      go,
      status ? h("p", { class: "hint", role: "status" }, status) : null,
    ]);
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      if (busy) return;
      const inputs = { dream: dream.value.trim(), major: major.value.trim(), budget: budget.value.trim(), location: location.value.trim() };
      generate(inputs, readiness(session.data, inputs).ready ? "full" : "starter");
    });
    host.replaceChildren(
      h("h1", { class: "display small" }, ["Your ", h("em", {}, "college plan")]),
      h("p", { class: "lede" }, "Your counselor studies your real profile, finds your strengths and growth areas, suggests colleges that fit your numbers, and maps every semester to get there."),
      !check.ready ? h("section", { class: "card stack", "data-testid": "cp-know-you", style: { borderLeft: "4px solid var(--gold)" } }, [
        h("h2", {}, "Let's get to know you first"),
        h("p", {}, "A good counselor never guesses. Suggesting colleges before I know your grades and what you love would just be guessing, so let's fill in a few things. It only takes a few minutes, and then your college list will be built around you."),
        h("ul", { class: "plain" }, check.missing.map((item) => h("li", {}, `📝 Add ${item}`))),
        h("div", { class: "composer-tools" }, [
          h("button", { type: "button", class: "btn primary", "data-testid": "cp-goto-profile", onClick: () => navigate("/profile") }, "Fill in My Profile"),
          h("button", { type: "button", class: "btn ghost", onClick: () => navigate("/tests") }, "Take a practice test"),
        ]),
        h("p", { class: "hint" }, "Meanwhile, you can get a starter plan for your grade below. It won't name colleges yet."),
      ]) : null,
      plan ? renderPlan(plan, paint) : null,
      form,
      h("p", { class: "hint" }, HINT),
    );
  };

  async function generate(inputs, mode) {
    if (!usesCloud()) {
      toast("Sign in with email so Gemini can build your college plan.");
      return;
    }
    busy = true;
    paint("Studying your profile and building your plan. This usually takes 20–40 seconds.");
    let raw = "";
    let lastError = null;
    for (let attempt = 0; attempt < 2 && !raw; attempt += 1) {
      try {
        raw = await geminiText({
          system: promptFor(session.data, inputs, mode),
          messages: [{ role: "user", content: mode === "starter" ? "Build my starter plan as JSON. No college names." : "Build my college plan as JSON." }],
          data: session.data,
        });
      } catch (error) {
        lastError = error;
        await new Promise((r) => setTimeout(r, 1500));
      }
    }
    busy = false;
    if (!raw) {
      paint();
      toast(`Could not build the plan: ${String(lastError?.message || "no reply").slice(0, 120)}. Please try again.`);
      return;
    }
    update((data) => {
      data.collegePlan = { v: PLAN_VERSION, mode, at: new Date().toISOString(), raw, done: [], ...inputs };
      pushActivity(data, "college", "Built a college plan");
    });
    paint();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  paint();
  return { unmount: view.destroy };
}

function renderPlan(saved, paint) {
  const data = parsePlanJSON(saved.raw);
  const when = saved.at ? new Date(saved.at).toLocaleDateString(undefined, { dateStyle: "medium" }) : "";
  if (!data) {
    return h("section", { class: "card stack" }, [
      h("h2", {}, "Your plan"),
      h("p", { class: "hint" }, when && `Built ${when}`),
      h("div", { style: "white-space:pre-wrap" }, saved.raw),
    ]);
  }
  const done = new Set(saved.done || []);
  const check = (key, label) => {
    const box = h("input", { type: "checkbox", checked: done.has(key), style: "width:20px;height:20px;flex:none;margin-top:2px" });
    box.addEventListener("change", () => {
      update((d) => {
        if (!d.collegePlan) return;
        const set = new Set(d.collegePlan.done || []);
        if (box.checked) set.add(key); else set.delete(key);
        d.collegePlan.done = [...set];
      });
    });
    return h("label", { style: "display:flex;gap:10px;align-items:flex-start;padding:4px 0;cursor:pointer" }, [box, h("span", {}, label)]);
  };
  const band = (key, title, color) => {
    const rows = arr(data.colleges?.[key]);
    if (!rows.length) return null;
    return h("div", { class: "stack" }, [
      h("h3", { style: `color:${color}` }, title),
      ...rows.map((c) => {
        const name = s(c.name || c);
        const have = session.data.colleges.some((x) => x.name.trim().toLowerCase() === name.trim().toLowerCase());
        const add = h("button", { type: "button", class: "btn ghost", disabled: have, "data-testid": "cp-add-college" }, have ? "In my colleges" : "Add to my colleges");
        add.addEventListener("click", () => {
          update((d) => {
            d.colleges.unshift({ id: uid(), name, location: "", majors: saved.major || "", status: "researching", band: key, requirements: "", testPolicy: "", deadline: "", source: "ARAHA college plan suggestion", lastChecked: "", notes: s(c.reason) });
            pushActivity(d, "college", "Saved a college");
          });
          add.disabled = true;
          add.textContent = "In my colleges";
          toast(`${name} added to My colleges.`);
        });
        return h("div", { class: "card stack", style: `border-left:4px solid ${color};padding:12px` }, [
          h("b", {}, name),
          c.reason ? h("span", {}, s(c.reason)) : null,
          c.fit ? h("span", { class: "hint" }, `Fit: ${s(c.fit)}`) : null,
          add,
        ]);
      }),
    ]);
  };
  const list = (title, items, render) => (arr(items).length ? h("section", { class: "card stack" }, [h("h2", {}, title), ...arr(items).map(render)]) : null);
  const groups = [["courses", "Courses"], ["tests", "Test goals"], ["activities", "Activities and leadership"], ["summer", "Summer"], ["essays", "Essays"], ["applications", "Applications and deadlines"]];
  return h("div", { class: "stack" }, [
    data.summary ? h("section", { class: "card stack", style: "background:linear-gradient(135deg,var(--navy),var(--navy-2));color:#fff" }, [
      h("p", { style: "margin:0;font-size:1.05rem;line-height:1.5" }, s(data.summary)),
      h("span", { style: "opacity:.75;font-size:.85rem" }, [when && `Built ${when}`, data.targetCollege && ` · Goal: ${s(data.targetCollege)}`].filter(Boolean).join("")),
    ]) : null,
    arr(data.strengths).length ? list("Your strengths", data.strengths, (item) => h("p", { style: "margin:0" }, ["✅ ", s(item)]))
      : h("section", { class: "card stack", "data-testid": "cp-no-strengths" }, [h("h2", {}, "Your strengths"), h("p", { class: "hint" }, "We'll find your strengths once you add your grades and activities.")]),
    list("Where to grow", data.improve, (item) => h("div", { style: "padding:6px 0;border-bottom:1px solid var(--line)" }, [
      h("b", {}, s(item.area || item)),
      item.fix ? h("p", { style: "margin:4px 0 0" }, ["→ ", s(item.fix)]) : null,
    ])),
    data.dreamGap ? h("section", { class: "card stack" }, [h("h2", {}, "Your dream school"), h("p", { style: "margin:0" }, s(data.dreamGap))]) : null,
    saved.mode === "starter" || !data.colleges ? null : h("section", { class: "card stack", "data-testid": "cp-colleges" }, [
      h("h2", {}, "Suggested colleges"),
      band("reach", "Reach", "#E2262E"),
      band("target", "Target", "#1B5CEB"),
      band("likely", "Likely", "#16A34A"),
      h("p", { class: "hint" }, HINT),
    ]),
    arr(data.plan).length ? h("section", { class: "card stack", "data-testid": "cp-semesters" }, [
      h("h2", {}, data.targetCollege ? `Semester plan to ${s(data.targetCollege)}` : "Semester-by-semester plan"),
      ...arr(data.plan).map((term, ti) => h("div", { class: "stack", style: "padding:10px 0;border-top:1px solid var(--line)" }, [
        h("h3", { style: "margin:0;color:var(--em)" }, s(term.term || `Step ${ti + 1}`)),
        ...groups.map(([key, label]) => (arr(term[key]).length ? h("div", {}, [
          h("small", { class: "hint", style: "text-transform:uppercase;letter-spacing:.04em" }, label),
          ...arr(term[key]).map((item, ii) => check(`${ti}:${key}:${ii}`, s(item))),
        ]) : null)),
      ])),
    ]) : null,
    list("Fill in to sharpen your plan", data.fillIn, (item) => h("p", { style: "margin:0" }, ["📝 ", s(item)])),
  ]);
}
