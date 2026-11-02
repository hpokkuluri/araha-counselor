export function gradeLabel(grade) {
  return { 9: "9th grade", 10: "10th grade", 11: "11th grade", 12: "12th grade" }[grade] || "";
}

export function prettyDate(iso) {
  if (!iso) return "";
  const date = new Date(iso.length === 10 ? `${iso}T00:00:00` : iso);
  if (Number.isNaN(date.getTime())) return String(iso);
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

export function dueLabel(iso, now = new Date()) {
  if (!iso) return "";
  const date = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(date.getTime())) return iso;
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  const days = Math.round((date - today) / 86400000);
  if (days < -1) return `${-days} days overdue`;
  if (days === -1) return "Yesterday";
  if (days === 0) return "Today";
  if (days === 1) return "Tomorrow";
  if (days < 14) return `In ${days} days`;
  return prettyDate(iso);
}

export function allUpcoming(data) {
  const rows = [];
  for (const item of data.deadlines || []) {
    if (!item.done && item.date) {
      rows.push({ date: item.date, title: item.title || "Deadline", category: item.category || "Other", href: "/deadlines" });
    }
  }
  for (const item of data.scholarships || []) {
    if (item.deadline && item.status !== "awarded" && item.status !== "closed") {
      rows.push({ date: item.deadline, title: item.name || "Scholarship", category: "Scholarship", href: "/scholarships" });
    }
  }
  return rows.sort((a, b) => String(a.date).localeCompare(String(b.date)));
}

export function profileGaps(profile) {
  const gaps = [];
  if (!profile.name.trim()) gaps.push("your name");
  if (!profile.grade) gaps.push("your grade");
  if (!profile.school.trim()) gaps.push("your school");
  if (!profile.parent1Email.trim() && !profile.parent2Email.trim()) gaps.push("a parent email");
  return gaps;
}

export function statusLabel(pairs, value) {
  return pairs.find(([id]) => id === value)?.[1] || value || "";
}

export function safeFilePart(value) {
  const clean = String(value || "").trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  return clean.slice(0, 40);
}
