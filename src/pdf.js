import { jsPDF } from "jspdf";
import { COLLEGE_STATUS, COURSE_STATUS, ESSAY_KINDS, SCHOLARSHIP_STATUS } from "./data.js";
import { gradeLabel, prettyDate, safeFilePart, statusLabel } from "./format.js";
import { essayStatus } from "./summary.js";

const NAVY = [14, 27, 61];
const GOLD = [242, 179, 61];
const RED = [226, 38, 46];
const INK = [20, 27, 46];
const MUTED = [77, 88, 117];
const PAPER = [243, 245, 250];

function bufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  const size = 0x8000;
  for (let i = 0; i < bytes.length; i += size) {
    binary += String.fromCharCode(...bytes.subarray(i, i + size));
  }
  return btoa(binary);
}

async function loadBrandFonts(doc) {
  const faces = [
    ["manrope-latin-400-normal.ttf", "Manrope", "normal"],
    ["manrope-latin-700-normal.ttf", "Manrope", "bold"],
    ["instrument-serif-latin-400-normal.ttf", "InstrumentSerif", "normal"],
    ["instrument-serif-latin-400-italic.ttf", "InstrumentSerif", "italic"],
  ];
  const base = import.meta.env?.BASE_URL || "/";
  for (const [file, name, style] of faces) {
    const response = await fetch(`${base}fonts/${file}`);
    if (!response.ok) throw new Error(file);
    doc.addFileToVFS(file, bufferToBase64(await response.arrayBuffer()));
    doc.addFont(file, name, style);
  }
}

function clip(value, max) {
  const text = String(value || "").trim();
  if (!text) return "";
  if (text.length <= max) return text;
  return `${text.slice(0, max - 3).trimEnd()}...`;
}

function drawLogo(doc, x, y, scale) {
  const polys = [
    [[27, 32], [21, 42.4], [9, 42.4], [3, 32], [9, 21.6], [21, 21.6]],
    [[48, 20], [42, 30.4], [30, 30.4], [24, 20], [30, 9.6], [42, 9.6]],
    [[48, 44], [42, 54.4], [30, 54.4], [24, 44], [30, 33.6], [42, 33.6]],
  ];
  doc.setDrawColor(...RED);
  doc.setLineWidth(1.15);
  for (const poly of polys) {
    for (let i = 0; i < poly.length; i++) {
      const a = poly[i];
      const b = poly[(i + 1) % poly.length];
      doc.line(x + a[0] * scale, y + a[1] * scale, x + b[0] * scale, y + b[1] * scale);
    }
  }
  doc.setTextColor(255, 255, 255);
  doc.setFont("Manrope", "bold");
  const labels = [[15, 36.2, "a", 7.5], [36, 24.2, "ra", 7], [36, 48.2, "ha", 7]];
  for (const [tx, ty, text, size] of labels) {
    doc.setFontSize(size);
    doc.text(text, x + tx * scale, y + ty * scale, { align: "center" });
  }
}

export async function buildPdf(data) {
  const doc = new jsPDF({ unit: "pt", format: "letter" });
  let branded = false;
  try {
    await loadBrandFonts(doc);
    branded = true;
  } catch {
    branded = false;
  }
  const font = (family, style) => {
    if (!branded) {
      doc.setFont("helvetica", style === "italic" ? "italic" : style === "bold" ? "bold" : "normal");
      return;
    }
    doc.setFont(family, style);
  };

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 40;
  let y = 0;
  let page = 1;

  const footer = () => {
    font("Manrope", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...MUTED);
    doc.text("Araha Counselor  ·  Arahasoft  ·  Generated on this device. Not uploaded.", margin, pageHeight - 26);
    doc.text(String(page), pageWidth - margin, pageHeight - 26, { align: "right" });
  };

  const nextPage = () => {
    footer();
    doc.addPage();
    page += 1;
    y = 46;
    font("Manrope", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...MUTED);
    doc.text("Araha Counselor progress report", margin, 30);
    doc.setDrawColor(...GOLD);
    doc.setLineWidth(1.25);
    doc.line(margin, 36, margin + 42, 36);
    y = 52;
  };

  const ensure = (height) => {
    if (y + height > pageHeight - 46) nextPage();
  };

  const section = (title) => {
    ensure(34);
    y += 14;
    font("Manrope", "bold");
    doc.setFontSize(11);
    doc.setTextColor(...NAVY);
    doc.text(title, margin, y);
    y += 5;
    doc.setDrawColor(...GOLD);
    doc.setLineWidth(1.6);
    doc.line(margin, y, margin + 42, y);
    y += 16;
  };

  const paragraph = (text, color = INK) => {
    font("Manrope", "normal");
    doc.setFontSize(10);
    doc.setTextColor(...color);
    const lines = doc.splitTextToSize(text || "Nothing added yet.", pageWidth - margin * 2);
    for (const line of lines) {
      ensure(14);
      doc.text(line, margin, y);
      y += 13;
    }
  };

  const bullet = (text) => {
    font("Manrope", "normal");
    doc.setFontSize(10);
    doc.setTextColor(...INK);
    const lines = doc.splitTextToSize(text, pageWidth - margin * 2 - 16);
    lines.forEach((line, index) => {
      ensure(14);
      if (index === 0) {
        doc.setFillColor(...GOLD);
        doc.circle(margin + 3, y - 3, 2, "F");
      }
      doc.setTextColor(...INK);
      doc.text(line, margin + 14, y);
      y += 13;
    });
  };

  doc.setFillColor(...NAVY);
  doc.rect(0, 0, pageWidth, 126, "F");
  doc.setFillColor(...GOLD);
  doc.rect(0, 126, pageWidth, 4, "F");
  if (branded) drawLogo(doc, 36, 22, 0.72);
  else {
    doc.setDrawColor(...RED);
    doc.setLineWidth(1.4);
    doc.circle(58, 58, 16);
  }

  const profile = data.profile;
  font(branded ? "Manrope" : "helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(255, 255, 255);
  doc.text("ARAHASOFT", branded ? 92 : 86, 42);

  font(branded ? "InstrumentSerif" : "helvetica", "normal");
  doc.setFontSize(26);
  doc.setTextColor(255, 255, 255);
  doc.text("Araha", branded ? 92 : 86, 72);
  const arahaWidth = doc.getTextWidth("Araha ");
  font(branded ? "InstrumentSerif" : "helvetica", "italic");
  doc.setTextColor(...GOLD);
  doc.text("Counselor", (branded ? 92 : 86) + arahaWidth, 72);

  font("Manrope", "normal");
  doc.setFontSize(10);
  doc.setTextColor(255, 255, 255);
  const who = profile.name.trim() || "Student progress report";
  const meta = [gradeLabel(profile.grade), profile.school.trim(), prettyDate(new Date().toISOString())].filter(Boolean).join("   ·   ");
  doc.text(doc.splitTextToSize(who, 360), branded ? 92 : 86, 96);
  doc.setTextColor(210, 216, 232);
  doc.text(doc.splitTextToSize(meta || "Generated on this device", 420), branded ? 92 : 86, 112);

  y = 150;
  const parents = [profile.parent1Name, profile.parent2Name].map((name) => name.trim()).filter(Boolean);
  if (parents.length) paragraph(`Prepared for ${parents.join(" and ")}.`, MUTED);

  const stats = [
    [profile.gpa.trim() || "—", "GPA"],
    [String(data.subjects.length), "Subjects"],
    [String(data.colleges.length), "Colleges"],
    [String(data.deadlines.filter((item) => !item.done).length), "Open dates"],
  ];
  const gap = 8;
  const boxW = (pageWidth - margin * 2 - gap * 3) / 4;
  ensure(58);
  stats.forEach((item, index) => {
    const x = margin + index * (boxW + gap);
    doc.setFillColor(...PAPER);
    doc.roundedRect(x, y, boxW, 48, 8, 8, "F");
    font(branded ? "InstrumentSerif" : "helvetica", "normal");
    doc.setFontSize(16);
    doc.setTextColor(...NAVY);
    doc.text(String(item[0]).slice(0, 12), x + 10, y + 22);
    font("Manrope", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...MUTED);
    doc.text(item[1], x + 10, y + 36);
  });
  y += 60;

  section("Profile");
  paragraph(`School: ${profile.school.trim() || "Not added yet"}`);
  paragraph(`Grade: ${gradeLabel(profile.grade) || "Not added yet"}`);
  paragraph(`GPA: ${profile.gpa.trim() || "Not added yet"}`);
  const classes = profile.classes.filter((row) => row.name.trim());
  if (classes.length) {
    y += 4;
    for (const row of classes) bullet(`${row.name}${row.grade.trim() ? ` — ${row.grade.trim()}` : ""}`);
  } else paragraph("No current classes added yet.");
  const tests = profile.tests.filter((row) => row.name.trim() || row.score.trim());
  if (tests.length) {
    y += 4;
    for (const row of tests) bullet([row.name, row.score, row.date && prettyDate(row.date)].filter(Boolean).join(" — "));
  }
  for (const [label, value] of [
    ["Activities", profile.activities],
    ["Sports", profile.sports],
    ["Awards", profile.awards],
    ["Interests", profile.interests],
    ["Goals", profile.goals],
  ]) {
    if (!value.trim()) continue;
    y += 6;
    font("Manrope", "bold");
    doc.setFontSize(10);
    doc.setTextColor(...NAVY);
    ensure(14);
    doc.text(label, margin, y);
    y += 14;
    paragraph(clip(value, 700));
  }

  section("Four-year plan");
  for (const year of ["9", "10", "11", "12"]) {
    font("Manrope", "bold");
    doc.setFontSize(10);
    doc.setTextColor(...NAVY);
    ensure(16);
    doc.text(gradeLabel(year), margin, y);
    y += 14;
    const courses = data.plan[year] || [];
    if (!courses.length) paragraph("No courses yet.");
    for (const course of courses) {
      bullet(`${course.name || "Untitled course"} · ${course.level} · ${course.area} · ${statusLabel(COURSE_STATUS, course.status)}${course.credit ? ` · ${course.credit} credit` : ""}`);
    }
  }

  section("Subjects");
  if (!data.subjects.length) paragraph("No subjects added yet.");
  for (const subject of data.subjects) {
    const questions = subject.messages.filter((message) => message.role === "user").length;
    bullet(`${subject.name || "Untitled"} — ${questions} tutor ${questions === 1 ? "question" : "questions"}`);
    if (subject.notes.trim()) paragraph(clip(subject.notes, 360), MUTED);
  }

  section("Deadlines");
  const dates = [...data.deadlines].sort((a, b) => String(a.date).localeCompare(String(b.date)));
  if (!dates.length) paragraph("No deadlines added yet.");
  for (const item of dates) {
    bullet(`${item.date ? prettyDate(item.date) : "No date"} — ${item.title || "Untitled"} [${item.category}]${item.done ? " — done" : ""}`);
  }

  section("Colleges and majors");
  if (!data.colleges.length) paragraph("No colleges saved yet.");
  for (const college of data.colleges) {
    bullet([college.name || "Untitled", college.location, statusLabel(COLLEGE_STATUS, college.status)].filter(Boolean).join(" — "));
    if (college.majors.trim()) paragraph(`Majors of interest: ${clip(college.majors, 240)}`, MUTED);
    if (college.notes.trim()) paragraph(clip(college.notes, 300), MUTED);
  }

  section("Scholarships");
  if (!data.scholarships.length) paragraph("No scholarships tracked yet.");
  for (const item of data.scholarships) {
    bullet([
      item.name || "Untitled",
      item.amount,
      item.deadline && `due ${prettyDate(item.deadline)}`,
      statusLabel(SCHOLARSHIP_STATUS, item.status),
    ].filter(Boolean).join(" — "));
    if (item.notes.trim()) paragraph(clip(item.notes, 280), MUTED);
  }

  section("Essays");
  if (!data.essays.length) paragraph("No essays started yet.");
  for (const essay of data.essays) {
    bullet(`${essay.title || "Untitled"} — ${statusLabel(ESSAY_KINDS, essay.kind)} — ${essayStatus(essay)}`);
  }
  y += 8;
  paragraph("Essay drafts stay in the app. This report shows status only, so a shared file does not include the writing itself.");

  footer();
  const blob = doc.output("blob");
  const first = safeFilePart(profile.name) || "student";
  return { blob, filename: `araha-counselor-${first}.pdf` };
}

export async function sharePdfFile(blob, filename) {
  const file = new File([blob], filename, { type: "application/pdf" });
  const payload = {
    files: [file],
    title: "Araha Counselor progress",
    text: "Progress report from Araha Counselor. Generated on this device.",
  };
  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    await navigator.share(payload);
    return "shared";
  }
  return "unsupported";
}
