import { h, field, txt, area, select, toast } from "../dom.js";
import { shell } from "../shell.js";
import { session, update } from "../session.js";
import { AREAS, COURSE_STATUS, LEVELS, pushActivity, uid } from "../data.js";
import { gradeLabel, statusLabel } from "../format.js";
import { catchUpRoadmap, nextYearNotes, pathwayStatus } from "../counsel.js";

export function mountPlan(root) {
  const view = shell(root, { title: "Four-year plan", tab: "plan" });
  let year = session.data.profile.grade || "9";
  if (!["9", "10", "11", "12"].includes(year)) year = "9";
  const host = h("div", { class: "stack" });
  const paint = () => {
    const courses = session.data.plan[year] || [];
    host.replaceChildren(
      h("div", { class: "seg" }, ["9", "10", "11", "12"].map((value) => (
        h("button", { type: "button", class: value === year ? "on" : "", onClick: () => { year = value; paint(); } }, gradeLabel(value).replace(" grade", ""))
      ))),
      h("p", { class: "hint" }, "Plan courses for each year. These are your notes, not a school schedule."),
      ...courses.map((course, index) => courseCard(year, course, index, paint)),
      addCard(year, paint),
    );
  };
  paint();
  view.content.append(host, pathwayCard(), offerings());
  return { unmount: view.destroy };
}

function pathwayCard() {
  const path = pathwayStatus(session.data);
  const roadmap = catchUpRoadmap(session.data);
  return h("section", { class: "card stack" }, [
    h("h2", {}, "Preparation sequence"),
    h("p", { class: "hint" }, path.note),
    path.steps.length ? h("ul", { class: "plain" }, path.steps.map((step) => h("li", {}, `${step.status === "listed" ? "On your list" : "Ask the school"} · ${step.label}. ${step.why}`))) : null,
    roadmap.length ? h("h3", {}, "This-year catch-up") : null,
    ...roadmap.map((item) => h("p", {}, [h("b", {}, item.title), " ", item.detail])),
    roadmap.length ? h("button", {
      type: "button",
      class: "btn primary",
      onClick: () => {
        update((data) => {
          const have = new Set(data.milestones.map((item) => item.title));
          for (const item of catchUpRoadmap(data)) {
            if (have.has(item.title)) continue;
            data.milestones.push({ id: uid(), title: item.title, detail: item.detail, done: false });
          }
        });
        toast("Milestones saved on this device.");
      },
    }, "Save these milestones") : null,
  ]);
}

function offerings() {
  const host = h("section", { class: "card stack" });
  const paint = () => {
    const notes = nextYearNotes(session.data);
    const name = txt({ placeholder: "Course your school actually lists" });
    const level = select(LEVELS.map((value) => [value, value]), "Regular");
    const form = h("form", { class: "stack" }, [
      h("h2", {}, "School courses you entered"),
      h("p", { class: "hint" }, "ARAHA does not know your catalog. Add a course only after you see it offered. Uploading a file is not available; type the name."),
      ...notes.items.map((item) => h("p", {}, [h("b", {}, `${item.title}. `), item.detail])),
      ...session.data.offerings.map((row, index) => h("p", {}, [
        `${row.name} · ${row.level}`,
        " ",
        h("button", { type: "button", class: "btn ghost", onClick: () => {
          update((data) => { data.offerings.splice(index, 1); });
          paint();
        } }, "Remove"),
      ])),
      field("Course", name),
      field("Level", level),
      h("button", { class: "btn primary", type: "submit" }, "Add school course"),
    ]);
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      if (!name.value.trim()) return;
      update((data) => {
        data.offerings.unshift({ id: uid(), name: name.value.trim(), level: level.value, grades: "", notes: "" });
      });
      paint();
    });
    host.replaceChildren(form);
  };
  paint();
  return host;
}

function courseCard(year, course, index, paint) {
  const name = txt({ value: course.name, placeholder: "e.g. Geometry" });
  const level = select(LEVELS.map((value) => [value, value]), course.level);
  const area = select(AREAS.map((value) => [value, value]), course.area);
  const status = select(COURSE_STATUS, course.status);
  const credit = txt({ value: course.credit, placeholder: "e.g. 1" });
  const notes = areaNotes(course.notes);
  const write = () => update((data) => {
    const item = data.plan[year][index];
    if (!item) return;
    item.name = name.value;
    item.level = level.value;
    item.area = area.value;
    item.status = status.value;
    item.credit = credit.value;
    item.notes = notes.value;
  });
  [name, credit, notes].forEach((node) => node.addEventListener("input", write));
  [level, area, status].forEach((node) => node.addEventListener("change", write));
  return h("article", { class: "card editor" }, [
    field("Course", name),
    h("div", { class: "grid-2" }, [field("Level", level), field("Area", area)]),
    h("div", { class: "grid-2" }, [field("Status", status), field("Credits", credit)]),
    field("Notes", notes),
    h("p", { class: "hint" }, statusLabel(COURSE_STATUS, course.status)),
    h("button", { type: "button", class: "btn ghost danger-text", onClick: () => {
      update((data) => { data.plan[year].splice(index, 1); });
      paint();
    } }, "Remove course"),
  ]);
}

function areaNotes(value) {
  return area({ rows: 2, placeholder: "Optional note", value: value || "" });
}

function addCard(year, paint) {
  const name = txt({ placeholder: "e.g. Geometry", "data-testid": "course-name" });
  const level = select(LEVELS.map((value) => [value, value]), "Regular");
  const subject = select(AREAS.map((value) => [value, value]), "Math");
  const status = select(COURSE_STATUS, "planned");
  const form = h("form", { class: "card editor" }, [
    h("h3", {}, `Add a ${gradeLabel(year)} course`),
    field("Course", name),
    h("div", { class: "grid-2" }, [field("Level", level), field("Area", subject)]),
    field("Status", status),
    h("button", { class: "btn primary", type: "submit" }, "Add course"),
  ]);
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    if (!name.value.trim()) return;
    update((data) => {
      data.plan[year].push({
        id: uid(),
        name: name.value.trim(),
        level: level.value,
        area: subject.value,
        status: status.value,
        credit: "",
        notes: "",
      });
      pushActivity(data, "plan", `Added ${name.value.trim()}`);
    });
    paint();
  });
  return form;
}
