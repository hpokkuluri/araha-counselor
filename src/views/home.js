import { h } from "../dom.js";
import { shell } from "../shell.js";
import { navigate } from "../nav.js";
import { session } from "../session.js";
import { allUpcoming, dueLabel, gradeLabel, profileGaps } from "../format.js";
import { icon } from "../icons.js";

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
