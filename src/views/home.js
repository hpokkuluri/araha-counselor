import { h } from "../dom.js";
import { shell } from "../shell.js";
import { navigate } from "../nav.js";
import { session, usesCloud } from "../session.js";
import { allUpcoming, dueLabel, gradeLabel, profileGaps } from "../format.js";
import { icon } from "../icons.js";
import { field, txt, toast } from "../dom.js";
import { geminiText } from "../cloud.js";
import { update } from "../session.js";
import { GOAL_CHOICES, uid } from "../data.js";
import { checkInDue, gradeChecklist, gradeNotes, intakeReady, nextYearNotes } from "../counsel.js";

const LINKS = [
  ["/plan", "Four-year plan", "#1B5CEB"],
  ["/colleges", "Colleges", "#F2B33D"],
  ["/careers", "Careers", "#16A34A"],
  ["/scholarships", "Scholarships", "#E2262E"],
  ["/essays", "Essays", "#7C5CFF"],
  ["/study", "Subjects", "#0EA5E9"],
  ["/deadlines", "Deadlines", "#D97706"],
  ["/progress", "Email parents", "#F2B33D"],
];

export function mountHome(root) {
  const view = shell(root, { brand: true, tab: "home" });
  const data = session.data;
  const profile = data.profile;
  const first = profile.name.trim().split(/\s+/)[0];
  const sub = [gradeLabel(profile.grade), profile.school.trim()].filter(Boolean).join(" · ");
  const upcoming = allUpcoming(data);
  const gaps = profileGaps(profile);
  const openDates = data.deadlines.filter((item) => !item.done).length;

  const nodes = [
    h("h1", { class: "display" }, first ? ["Hi, ", h("em", {}, first)] : "Hi"),
    h("p", { class: "lede" }, sub || "Your counselor stays on this device."),
    h("button", {
      type: "button",
      class: "btn gold wide hero-btn",
      "data-testid": "open-chat",
      onClick: () => navigate("/chat"),
    }, ["Talk with your counselor", icon("chevron")]),
    h("div", { class: "stats" }, [
      stat(String(data.colleges.length), "Colleges"),
      stat(String(upcoming.length || openDates), "Coming up"),
      stat(String(data.subjects.length), "Subjects"),
    ]),
    gaps.length ? h("button", {
      type: "button",
      class: "card linkcard",
      "data-testid": "goto-profile",
      onClick: () => navigate("/profile"),
    }, [
      h("b", {}, "Finish your profile"),
      h("span", {}, `Add ${gaps.join(", ")}.`),
    ]) : null,
    h("h2", { class: "sec-h" }, "Coming up"),
  ];
  if (!intakeReady(profile)) nodes.splice(2, 0, intakeCard());
  nodes.push(checklistCard(profile.grade), planCard(data), checkInCard(data));
  view.content.append(...nodes.filter(Boolean));
  view.content.append(
    upcoming.length ? h("div", { class: "stack" }, upcoming.slice(0, 4).map((item) => (
      h("button", { type: "button", class: "card rowlink", onClick: () => navigate(item.href) }, [
        h("b", {}, item.title),
        h("span", {}, `${item.category} · ${dueLabel(item.date)}`),
      ])
    ))) : h("div", { class: "empty" }, "No deadlines yet. Add the PSAT, an application date, or a school event when you have one."),
    h("h2", { class: "sec-h" }, "Your map"),
    h("div", { class: "chip-wrap" }, LINKS.map(([href, label, color]) => (
      h("button", {
        type: "button",
        class: "chip",
        style: { "--accent": color },
        onClick: () => navigate(href),
      }, label)
    ))),
  );
  return { unmount: view.destroy };
}

function stat(value, label) {
  return h("div", { class: "stat" }, [h("b", {}, value), h("span", {}, label)]);
}

function intakeCard() {
  const profile = session.data.profile;
  const name = txt({ value: profile.name, placeholder: "Your name", "data-testid": "intake-name" });
  const grade = h("select", { class: "txt", "data-testid": "intake-grade" }, [
    ["", "Grade"], ["9", "9th"], ["10", "10th"], ["11", "11th"], ["12", "12th"],
  ].map(([value, label]) => h("option", { value }, label)));
  grade.value = profile.grade || "";
  const school = txt({ value: profile.school, placeholder: "Your school", "data-testid": "intake-school" });
  const goal = h("select", { class: "txt" }, GOAL_CHOICES.map(([value, label]) => h("option", { value }, label)));
  goal.value = profile.goalChoice || "";
  const form = h("form", { class: "card stack", "data-testid": "intake" }, [
    h("h2", {}, "Start My Profile"),
    h("p", { class: "hint" }, "This stays on this device. Clearing a chat does not erase it. You can change every answer later."),
    field("Name", name),
    field("Grade", grade),
    field("School", school),
    field("Direction", goal, "Undecided is fine."),
    h("button", { class: "btn gold", type: "submit" }, "Save and keep going"),
  ]);
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    if (!name.value.trim() || !grade.value) {
      toast("Add your name and grade. You can fill the rest later.");
      return;
    }
    update((data) => {
      data.profile.name = name.value.trim();
      data.profile.grade = grade.value;
      data.profile.school = school.value.trim();
      data.profile.goalChoice = goal.value;
      data.profile.intakeDone = true;
    });
    navigate("/home");
  });
  return form;
}

async function saveRoadmap() {
  if (!usesCloud()) {
    toast("Sign in with email so Gemini can write the summary.");
    return;
  }
  toast("Writing your summary…");
  try {
    const text = await geminiText({
      system: "Write a calm counselor summary and a four-year roadmap from the profile. Use headings Summary and Roadmap. Never shame. If a course is not on the school list the student typed, tell them to ask the school.",
      messages: [{ role: "user", content: "Use my profile." }],
      data: session.data,
    });
    update((data) => {
      data.profile.counselorSummary = text;
      data.roadmap = text;
    });
    toast("Summary saved on your account.");
  } catch (error) {
    toast(error.message || "Gemini didn't answer.");
  }
}

function checklistCard(grade) {
  return h("section", { class: "card stack" }, [
    h("h2", {}, grade ? `A ${gradeLabel(grade)} starting list` : "A starting list"),
    h("ul", { class: "plain" }, gradeChecklist(grade).map((item) => h("li", {}, item))),
    h("p", { class: "hint" }, "These are habits, not dated requirements. Confirm dates with your school and the official form."),
  ]);
}

function planCard(data) {
  const notes = nextYearNotes(data);
  const grades = gradeNotes(data.profile.classes);
  return h("section", { class: "card stack" }, [
    h("h2", {}, "Next year, from what you entered"),
    ...notes.items.map((item) => h("p", {}, [h("b", {}, item.title), " ", item.detail])),
    h("h3", {}, "Grades you typed"),
    ...grades.notes.map((line) => h("p", { class: "hint" }, line)),
    h("button", { type: "button", class: "btn gold", onClick: saveRoadmap }, "Save a counselor summary and roadmap"),
    h("button", { type: "button", class: "btn ghost", onClick: () => navigate("/plan") }, "Open the four-year plan"),
    h("button", { type: "button", class: "btn ghost", onClick: () => navigate("/application") }, "My application preview"),
  ]);
}

function milestoneList() {
  const rows = session.data.milestones || [];
  if (!rows.length) return null;
  return h("div", { class: "stack" }, rows.map((item, index) => h("label", { class: "checkline" }, [
    h("input", {
      type: "checkbox",
      checked: item.done,
      onChange: (event) => update((data) => { if (data.milestones[index]) data.milestones[index].done = event.target.checked; }),
    }),
    item.title,
  ])));
}

function checkInCard(data) {
  if (!checkInDue(data.checkins)) {
    return h("section", { class: "card stack" }, [
      h("p", { class: "hint" }, "You checked in this week. The next prompt shows after seven days."),
      milestoneList(),
    ]);
  }
  const note = txt({ placeholder: "How are classes going, in your words?" });
  const p1 = txt({ placeholder: "One thing to finish" });
  const p2 = txt({ placeholder: "One class to review" });
  const p3 = txt({ placeholder: "One person to ask" });
  const form = h("form", { class: "card stack", "data-testid": "check-in" }, [
    h("h2", {}, "This week's check-in"),
    h("p", { class: "hint" }, "Three priorities, saved on your account. This does not email anyone by itself."),
    field("Priority 1", p1),
    field("Priority 2", p2),
    field("Priority 3", p3),
    field("Note", note),
    h("button", { class: "btn primary", type: "submit" }, "Save check-in"),
    milestoneList(),
  ]);
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    update((row) => {
      const priorities = [p1.value, p2.value, p3.value].map((item) => item.trim()).filter(Boolean);
      row.checkins.unshift({ id: uid(), at: new Date().toISOString(), note: [`Priorities: ${priorities.join(" · ") || "none"}`, note.value.trim()].filter(Boolean).join("\n") });
    });
    toast("Check-in saved on this device.");
    navigate("/home");
  });
  return form;
}
