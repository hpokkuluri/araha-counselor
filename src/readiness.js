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
