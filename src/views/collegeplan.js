import { h, field, txt, toast } from "../dom.js";
import { shell } from "../shell.js";
import { session, update, usesCloud } from "../session.js";
import { pushActivity, uid } from "../data.js";
import { geminiText } from "../cloud.js";
import { navigate } from "../nav.js";

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

function thinFields(data) {
  const p = data.profile;
  const missing = [];
  if (!p.grade) missing.push("grade");
  if (!p.gpa) missing.push("GPA");
  if (!p.tests.length) missing.push("test scores (PSAT/SAT/ACT)");
  if (!p.activities) missing.push("activities");
  if (!p.interests) missing.push("interests");
  if (!p.awards) missing.push("honors and awards");
  if (!p.classes.length) missing.push("current classes");
  return missing;
}

function promptFor(data, inputs) {
  const grade = data.profile.grade || "10";
  const essays = data.essays.map((e) => e.title || e.kind).filter(Boolean).slice(0, 6).join(", ");
  const attempts = data.testAttempts.slice(0, 5).map((a) => `${a.exam} ${a.correct}/${a.total}`).join("; ");
  return [
    "Act as an experienced, warm high school college counselor. Study this student's profile, find strengths and weak spots, and build a realistic, motivating college plan.",
    "Prefer realistic options for a New Jersey student (include NJ publics like Rutgers, TCNJ, Stevens, NJIT, Rowan, Montclair State where they fit) plus out-of-state options that match the student's interests and preferences.",
    `Student preferences: budget: ${inputs.budget || "not given"}; location: ${inputs.location || "not given"}; intended major: ${inputs.major || "not given"}; dream or target college: ${inputs.dream || "pick the best-fit target college yourself"}.`,
    essays ? `Essays started: ${essays}.` : "",
    attempts ? `Practice test results in the app: ${attempts}.` : "",
    `The student is in grade ${grade}. Build the semester plan from the current semester of grade ${grade} through the fall of grade 12 (applications) and spring of grade 12 (decisions).`,
    "If the profile is thin, still make the best plan you can and list what the student should fill in.",
    "Reply with ONLY valid JSON, no markdown, matching exactly this shape:",
    '{"summary":"2 sentence encouraging overview","strengths":["..."],"improve":[{"area":"...","fix":"concrete action"}],"colleges":{"reach":[{"name":"...","reason":"one line","fit":"academic/major/cost fit in a few words"}],"target":[...],"likely":[...]},"targetCollege":"name","plan":[{"term":"Grade 10 Spring","courses":["..."],"tests":["..."],"activities":["..."],"summer":["..."],"essays":["..."],"applications":["..."]}],"fillIn":["profile items to add"]}',
    "Give 3-4 colleges in each of reach, target, likely. 3-6 strengths, 3-6 improvements. Each plan list item is a short checklist action. Never discourage the student.",
  ].filter(Boolean).join("\n");
}

export function mountCollegePlan(root) {
  const view = shell(root, { title: "College plan", tab: "plan", back: "/home" });
  const host = h("div", { class: "stack", "data-testid": "college-plan" });
  view.content.append(host);
  let busy = false;
  const saved = () => session.data.collegePlan;

  const paint = (status = "") => {
    const plan = saved();
    const dream = txt({ value: plan?.dream || "", placeholder: "e.g. Rutgers, Georgia Tech, MIT", "data-testid": "cp-dream" });
    const major = txt({ value: plan?.major || "", placeholder: "e.g. computer science" });
    const budget = txt({ value: plan?.budget || "", placeholder: "e.g. under $30k/year, in-state preferred" });
    const location = txt({ value: plan?.location || "", placeholder: "e.g. Northeast, near NJ, anywhere" });
    const go = h("button", { class: "btn gold wide", type: "submit", disabled: busy, "data-testid": "cp-generate" }, busy ? "Building your plan…" : plan ? "Regenerate my plan" : "Build my college plan");
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
      generate({ dream: dream.value.trim(), major: major.value.trim(), budget: budget.value.trim(), location: location.value.trim() });
    });
    const missing = thinFields(session.data);
    host.replaceChildren(
      h("h1", { class: "display small" }, ["Your ", h("em", {}, "college plan")]),
      h("p", { class: "lede" }, "Your counselor studies your profile, finds your strengths and growth areas, suggests colleges, and maps every semester to get there."),
      missing.length ? h("button", { type: "button", class: "card linkcard", onClick: () => navigate("/profile") }, [
        h("b", {}, "Make the plan sharper"),
        h("span", {}, `Add ${missing.join(", ")} on My Profile.`),
      ]) : null,
      plan ? renderPlan(plan, paint) : null,
      form,
      h("p", { class: "hint" }, HINT),
    );
  };

  async function generate(inputs) {
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
          system: promptFor(session.data, inputs),
          messages: [{ role: "user", content: "Build my college plan as JSON." }],
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
      data.collegePlan = { at: new Date().toISOString(), raw, done: [], ...inputs };
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
    list("Your strengths", data.strengths, (item) => h("p", { style: "margin:0" }, ["✅ ", s(item)])),
    list("Where to grow", data.improve, (item) => h("div", { style: "padding:6px 0;border-bottom:1px solid var(--line)" }, [
      h("b", {}, s(item.area || item)),
      item.fix ? h("p", { style: "margin:4px 0 0" }, ["→ ", s(item.fix)]) : null,
    ])),
    h("section", { class: "card stack", "data-testid": "cp-colleges" }, [
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
