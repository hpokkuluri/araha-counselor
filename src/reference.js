export const COLLEGE_FILE = "colleges.json";
export const SCHOOL_FILE = "schools.json";

export function referenceUrl(base, file) {
  const root = base.endsWith("/") ? base : `${base}/`;
  return `${root}data/${file}`;
}

export function findColleges(payload, query, limit = 8) {
  const q = String(query || "").trim().toLowerCase();
  if (q.length < 3) return [];
  const exact = [];
  const partial = [];
  for (const row of payload?.rows || []) {
    const name = String(row.name || "").toLowerCase();
    if (name === q) exact.push(row);
    else if (name.includes(q)) partial.push(row);
    if (partial.length >= limit) break;
  }
  return [...exact, ...partial].slice(0, limit);
}

export function collegeSummary(row, meta = {}) {
  if (!row) return [];
  const lines = [`${row.name} · ${[row.city, row.state].filter(Boolean).join(", ")}`];
  if (row.control) lines.push(row.control);
  if (typeof row.admitRate === "number") {
    lines.push(`Published admission rate: ${(row.admitRate * 100).toFixed(1)}% of applicants. This is not your chance of admission.`);
  }
  if (row.satReading) lines.push(`SAT reading, 25th–75th percentile of submitted scores: ${row.satReading[0]}–${row.satReading[1]}.`);
  if (row.satMath) lines.push(`SAT math, 25th–75th percentile of submitted scores: ${row.satMath[0]}–${row.satMath[1]}.`);
  if (row.act) lines.push(`ACT composite, 25th–75th percentile of submitted scores: ${row.act[0]}–${row.act[1]}.`);
  if (typeof row.gradRate === "number") lines.push(`Graduation rate within 150% of normal time: ${(row.gradRate * 100).toFixed(1)}%.`);
  if (typeof row.netPrice === "number") lines.push(`Average net price: $${row.netPrice.toLocaleString("en-US")}.`);
  if (row.url) lines.push(`Institution URL on the Scorecard file: ${row.url}`);
  lines.push(`Source: ${meta.source || "College Scorecard"}. File date ${meta.scorecardUpdated || "unknown"}. Packaged ${meta.packaged || "unknown"}.`);
  lines.push(meta.omitted || "Deadlines and test-optional rules are not in this file.");
  return lines;
}

export function findSchools(payload, { city = "", state = "", zip = "" } = {}, limit = 20) {
  const code = String(zip || "").trim().slice(0, 5);
  const town = String(city || "").trim().toLowerCase();
  const region = String(state || "").trim().toUpperCase();
  if (!code && town.length < 3) {
    return { rows: [], note: "Enter a 5-digit ZIP or a town of at least 3 letters. Your profile is not sent with the lookup." };
  }
  const rows = [];
  let truncated = false;
  for (const item of payload?.rows || []) {
    const [name, itemCity, itemState, itemZip] = item;
    if (code && itemZip !== code) continue;
    if (!code && itemCity.toLowerCase() !== town) continue;
    if (region && itemState !== region) continue;
    rows.push({ name, city: itemCity, state: itemState, zip: itemZip });
    if (rows.length >= limit) {
      truncated = true;
      break;
    }
  }
  return {
    rows,
    truncated,
    note: payload?.coverage || "",
  };
}

const cache = new Map();

export async function loadReference(file, { refresh = false, base = import.meta.env?.BASE_URL || "/" } = {}) {
  const url = referenceUrl(base, file);
  if (refresh) cache.delete(url);
  if (!refresh && cache.has(url)) return cache.get(url);
  const response = await fetch(url, { cache: refresh ? "reload" : "force-cache" });
  if (!response.ok) throw new Error("The packaged reference file did not load. Your profile was not sent.");
  const payload = await response.json();
  cache.set(url, payload);
  if (globalThis.caches) {
    try {
      const box = await caches.open("araha-reference-v2");
      await box.put(url, new Response(JSON.stringify(payload), { headers: { "Content-Type": "application/json" } }));
    } catch { /* the page can still use the copy it just loaded */ }
  }
  return payload;
}
