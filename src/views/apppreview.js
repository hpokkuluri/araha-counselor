import { h } from "../dom.js";
import { readinessItems } from "../readiness.js";
import { brandName } from "../brand.js";
import { gradeLabel } from "../format.js";

const lines = (text) => String(text || "").split(/\n|;|•/).map((t) => t.replace(/^[-*\s]+/, "").trim()).filter(Boolean);

function placeholder(what) {
  return h("div", { class: "ap-empty" }, `Add your ${what} to complete this section ✨`);
}

function section(title, filled, body, what) {
  return h("section", { class: "ap-sec" }, [
    h("h2", {}, [h("span", { class: filled ? "ap-dot on" : "ap-dot" }), title]),
    filled ? body : placeholder(what),
  ]);
}

export function openApplicationPreview(data) {
  const p = data.profile;
  const ready = readinessItems(data);
  const pct = Math.round((ready.done / ready.total) * 100);
  const motivate = pct >= 90 ? "This is looking like a standout application. Keep polishing!"
    : pct >= 60 ? "You're well on your way. A few more pieces and it shines."
      : pct >= 30 ? "Great start! Every section you add makes your story stronger."
        : "Every great application starts right here. Let's build yours one step at a time.";
  const classes = p.classes.filter((c) => c.name?.trim());
  const planned = ["9", "10", "11", "12"].flatMap((y) => (data.plan[y] || []).filter((c) => c.name?.trim()).map((c) => ({ ...c, year: y })));
  const activities = [...lines(p.activities), ...lines(p.sports)];
  const awards = lines(p.awards);
  const essays = data.essays.filter((e) => e.draft?.trim() || e.outline?.trim());
  const initials = (p.name || "You").split(/\s+/).map((w) => w[0]).join("").slice(0, 2).toUpperCase();
  const close = () => { layer.remove(); document.body.classList.remove("ap-open"); };

  const page = h("article", { class: "ap-page", "data-testid": "app-preview" }, [
    h("header", { class: "ap-head" }, [
      h("div", { class: "ap-avatar" }, initials),
      h("div", {}, [
        h("h1", {}, p.name?.trim() || "Your name"),
        h("p", {}, [p.school || "Your high school", p.grade ? gradeLabel(p.grade) : "", [p.town, p.region].filter(Boolean).join(", ")].filter(Boolean).join(" · ")),
        p.goals || p.goalChoice ? h("p", { class: "ap-goal" }, `🎯 ${p.goals ? p.goals.slice(0, 160) : p.goalChoice}`) : null,
      ]),
    ]),
    h("div", { class: "ap-meter" }, [
      h("div", { class: "ap-meter-top" }, [h("b", {}, `${pct}% complete`), h("span", {}, `${ready.done} of ${ready.total} pieces`)]),
      h("div", { class: "ap-bar" }, h("i", { style: { width: `${pct}%` } })),
      h("p", {}, motivate),
    ]),
    section("Academics", Boolean(p.gpa || classes.length || planned.length), h("div", { class: "stack" }, [
      p.gpa ? h("div", { class: "ap-kpis" }, [h("div", {}, [h("b", {}, p.gpa), h("span", {}, `GPA${p.gpaScale ? ` / ${p.gpaScale}` : ""}${p.gpaWeighted ? ` · ${p.gpaWeighted}` : ""}`)])]) : null,
      classes.length ? h("ul", { class: "ap-list" }, classes.map((c) => h("li", {}, [h("b", {}, c.name), h("span", {}, [c.level !== "Regular" ? c.level : "", c.grade].filter(Boolean).join(" · "))]))) : null,
      planned.length ? h("p", { class: "ap-small" }, `Planned: ${planned.slice(0, 12).map((c) => `${c.name} (gr ${c.year})`).join(", ")}`) : null,
    ]), "GPA and classes"),
    section("Test scores", p.tests.length > 0, h("div", { class: "ap-kpis" }, p.tests.map((t) => h("div", {}, [h("b", {}, t.score || "—"), h("span", {}, [t.name, t.date].filter(Boolean).join(" · "))]))), "PSAT, SAT, ACT, or AP scores"),
    section("Activities", activities.length > 0, h("ol", { class: "ap-list num" }, activities.slice(0, 10).map((a) => h("li", {}, a))), "clubs, sports, jobs, and service"),
    section("Honors & awards", awards.length > 0, h("ul", { class: "ap-list" }, awards.slice(0, 5).map((a) => h("li", {}, ["🏅 ", a]))), "honors and awards"),
    section("Personal essay", essays.length > 0, h("div", { class: "stack" }, essays.slice(0, 2).map((e) => h("div", { class: "ap-essay" }, [
      h("h3", {}, e.title || "Personal essay"),
      e.prompt ? h("p", { class: "ap-small" }, e.prompt.slice(0, 240)) : null,
      h("div", { class: "ap-essay-body" }, (e.draft || e.outline).slice(0, 4000)),
    ]))), "personal essay draft"),
    section("Recommendations", data.recommendations.length > 0, h("ul", { class: "ap-list" }, data.recommendations.map((r) => h("li", {}, [h("b", {}, r.name || "Recommender"), h("span", {}, r.role || "")]))), "recommender notes"),
    section("Colleges", data.colleges.length > 0, h("div", { class: "ap-chips" }, data.colleges.map((c) => h("span", { class: `ap-chip ${c.band}` }, c.name))), "college list"),
    h("footer", { class: "ap-foot" }, [brandName("compact"), h("span", {}, "Preview in ARAHA's own layout · not the Common App")]),
  ]);
  const layer = h("div", { class: "ap-layer", role: "dialog", "aria-label": "Application preview" }, [
    h("div", { class: "ap-tools" }, [
      h("button", { type: "button", class: "btn ghost", onClick: () => window.print() }, "Print / save PDF"),
      h("button", { type: "button", class: "btn primary", "data-testid": "app-preview-close", onClick: close }, "✕ Close"),
    ]),
    page,
  ]);
  document.body.classList.add("ap-open");
  document.body.append(layer);
  window.addEventListener("hashchange", close, { once: true });
  return close;
}
