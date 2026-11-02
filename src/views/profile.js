import { h, field, txt, area, select, toast } from "../dom.js";
import { shell } from "../shell.js";
import { session, update } from "../session.js";
import { uid } from "../data.js";

export function mountProfile(root) {
  const view = shell(root, { title: "Profile", tab: "more", back: "/settings" });
  const profile = session.data.profile;
  const form = h("form", { class: "stack", "data-testid": "profile-form" });
  const name = bind(txt({ placeholder: "e.g. Alex Rivera", autocomplete: "name", "data-testid": "profile-name" }), profile.name, (data, value) => { data.profile.name = value; });
  const grade = bind(select([["", "Select grade"], ["9", "9th"], ["10", "10th"], ["11", "11th"], ["12", "12th"]], profile.grade, { "data-testid": "profile-grade" }), profile.grade, (data, value) => { data.profile.grade = value; }, "change");
  const school = bind(txt({ placeholder: "e.g. East Windsor High School", "data-testid": "profile-school" }), profile.school, (data, value) => { data.profile.school = value; });
  const gpa = bind(txt({ placeholder: "e.g. 3.7 unweighted", "data-testid": "profile-gpa" }), profile.gpa, (data, value) => { data.profile.gpa = value; });
  const activities = bind(area({ placeholder: "e.g. robotics club, volunteering at the library" }), profile.activities, (data, value) => { data.profile.activities = value; });
  const sports = bind(area({ placeholder: "e.g. JV soccer" }), profile.sports, (data, value) => { data.profile.sports = value; });
  const awards = bind(area({ placeholder: "e.g. science fair, honor roll" }), profile.awards, (data, value) => { data.profile.awards = value; });
  const interests = bind(area({ placeholder: "e.g. mechanical engineering, drawing" }), profile.interests, (data, value) => { data.profile.interests = value; });
  const goals = bind(area({ placeholder: "e.g. take AP Physics, visit two campuses" }), profile.goals, (data, value) => { data.profile.goals = value; });
  const p1 = bind(txt({ placeholder: "e.g. parent name", autocomplete: "name" }), profile.parent1Name, (data, value) => { data.profile.parent1Name = value; });
  const e1 = bind(txt({ type: "email", placeholder: "e.g. parent@email.com", autocomplete: "email", "data-testid": "parent1-email" }), profile.parent1Email, (data, value) => { data.profile.parent1Email = value; });
  const p2 = bind(txt({ placeholder: "e.g. parent name" }), profile.parent2Name, (data, value) => { data.profile.parent2Name = value; });
  const e2 = bind(txt({ type: "email", placeholder: "e.g. parent@email.com", "data-testid": "parent2-email" }), profile.parent2Email, (data, value) => { data.profile.parent2Email = value; });

  const classes = h("div", { class: "stack" });
  const tests = h("div", { class: "stack" });
  const drawLists = () => {
    classes.replaceChildren(...session.data.profile.classes.map((row, index) => pairRow(row, index, "classes", "e.g. Geometry", "e.g. A-")));
    tests.replaceChildren(...session.data.profile.tests.map((row, index) => testRow(row, index)));
  };
  drawLists();

  form.append(
    h("p", { class: "lede" }, "This is the context your counselor and essay coach use. Example hints are placeholders, not your record."),
    field("Name", name),
    h("div", { class: "grid-2" }, [field("Grade", grade), field("School", school)]),
    field("GPA", gpa, "Type it the way your school reports it."),
    h("h2", { class: "sec-h" }, "Current classes"),
    classes,
    h("button", { type: "button", class: "btn ghost", onClick: () => addRow("classes", { name: "", grade: "" }, drawLists) }, "Add a class"),
    h("h2", { class: "sec-h" }, "Test scores"),
    tests,
    h("button", { type: "button", class: "btn ghost", onClick: () => addRow("tests", { name: "", score: "", date: "" }, drawLists) }, "Add a test"),
    field("Activities", activities),
    field("Sports", sports),
    field("Awards", awards),
    field("Interests", interests),
    field("Goals", goals),
    h("h2", { class: "sec-h" }, "Parents"),
    h("p", { class: "hint" }, "Used only for the Email my parents button on this device."),
    h("div", { class: "grid-2" }, [field("Parent 1 name", p1), field("Parent 1 email", e1)]),
    h("div", { class: "grid-2" }, [field("Parent 2 name", p2), field("Parent 2 email", e2)]),
    h("button", { class: "btn primary wide", type: "submit", "data-testid": "profile-save" }, "Save profile"),
  );
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    toast("Profile saved on this device.");
  });
  view.content.append(form);
  return { unmount: view.destroy };
}

function bind(node, value, write, eventName = "input") {
  if ("value" in node) node.value = value || "";
  node.addEventListener(eventName, () => update((data) => write(data, node.value)));
  return node;
}

function addRow(key, extra, draw) {
  update((data) => { data.profile[key].push({ id: uid(), ...extra }); });
  draw();
}

function pairRow(row, index, key, nameHint, gradeHint) {
  const name = txt({ placeholder: nameHint, value: row.name });
  const grade = txt({ placeholder: gradeHint, value: row.grade });
  name.addEventListener("input", () => update((data) => { data.profile[key][index].name = name.value; }));
  grade.addEventListener("input", () => update((data) => { data.profile[key][index].grade = grade.value; }));
  return h("div", { class: "pair" }, [
    name,
    grade,
    h("button", { type: "button", class: "icon-btn", ariaLabel: "Remove", onClick: () => {
      update((data) => { data.profile[key].splice(index, 1); });
      name.closest(".pair")?.remove();
    } }, "×"),
  ]);
}

function testRow(row, index) {
  const name = txt({ placeholder: "e.g. PSAT", value: row.name });
  const score = txt({ placeholder: "e.g. 1200", value: row.score });
  const date = txt({ type: "date", value: row.date });
  const write = () => update((data) => {
    const item = data.profile.tests[index];
    if (!item) return;
    item.name = name.value;
    item.score = score.value;
    item.date = date.value;
  });
  name.addEventListener("input", write);
  score.addEventListener("input", write);
  date.addEventListener("change", write);
  return h("div", { class: "triple" }, [
    name, score, date,
    h("button", { type: "button", class: "icon-btn", ariaLabel: "Remove test", onClick: () => {
      update((data) => { data.profile.tests.splice(index, 1); });
      name.closest(".triple")?.remove();
    } }, "×"),
  ]);
}
