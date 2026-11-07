export function readinessItems(data) {
  const profile = data?.profile || {};
  const essays = data?.essays || [];
  const started = essays.filter((essay) => essay.draft?.trim() || essay.outline?.trim() || essay.brainstorm?.trim());
  const recs = data?.recommendations || [];
  const items = [
    { id: "name", label: "Name on My Profile", done: Boolean(profile.name?.trim()) },
    { id: "grade", label: "Grade", done: Boolean(profile.grade) },
    { id: "school", label: "School", done: Boolean(profile.school?.trim()) },
    { id: "classes", label: "At least one class", done: (profile.classes || []).some((row) => row.name?.trim()) },
    { id: "plan", label: "A course on the four-year plan", done: ["9", "10", "11", "12"].some((year) => (data?.plan?.[year] || []).some((row) => row.name?.trim())) },
    { id: "activities", label: "An activity, sport, or award", done: Boolean(profile.activities?.trim() || profile.sports?.trim() || profile.awards?.trim()) },
    { id: "goals", label: "A goal or direction", done: Boolean(profile.goalChoice || profile.goals?.trim()) },
    { id: "college", label: "A college on the list", done: (data?.colleges || []).some((row) => row.name?.trim()) },
    { id: "essay", label: "An essay started in the student's own words", done: started.length > 0 },
    { id: "rec", label: "A recommendation note", done: recs.some((row) => row.name?.trim()) },
  ];
  const done = items.filter((item) => item.done).length;
  return {
    items,
    done,
    total: items.length,
    label: `${done} of ${items.length} tasks filled in. This is not an admission chance.`,
  };
}

export function applicationSections(data) {
  const ready = readinessItems(data);
  const profile = data?.profile || {};
  const evidence = [];
  if (profile.name?.trim()) evidence.push(`Name: ${profile.name.trim()}`);
  if (profile.school?.trim()) evidence.push(`School: ${profile.school.trim()}`);
  if (profile.gpa?.trim()) evidence.push(`GPA entered: ${profile.gpa.trim()}${profile.gpaScale ? ` (${profile.gpaScale} scale)` : ""}`);
  const classes = (profile.classes || []).filter((row) => row.name?.trim());
  if (classes.length) {
    evidence.push(`Classes: ${classes.map((row) => row.grade?.trim() ? `${row.name} ${row.grade}` : row.name).join(", ")}`);
  }
  const gaps = ready.items.filter((item) => !item.done).map((item) => item.label);
  const actions = [];
  for (const essay of data?.essays || []) {
    const state = essay.draft?.trim() ? "draft saved" : essay.outline?.trim() ? "outline only" : essay.brainstorm?.trim() ? "brainstorm only" : "not started";
    actions.push(`${essay.title || "Untitled essay"}: ${state}${essay.collegeName ? ` for ${essay.collegeName}` : ""}${essay.essayDeadline ? `, date entered ${essay.essayDeadline}` : ", no date entered"}`);
  }
  if (!data?.essays?.length) actions.push("Add an essay when you have a prompt. The coach will not write it for you.");
  for (const rec of data?.recommendations || []) {
    actions.push(`${rec.name || "Recommendation"}: ${rec.status || "considering"}`);
  }
  for (const item of data?.milestones || []) {
    if (!item.done && item.title) actions.push(`Milestone still open: ${item.title}`);
  }
  return { evidence, gaps, actions, readiness: ready };
}
