const key = process.env.RESEND_API_KEY || "";
const account = process.env.FIREBASE_SERVICE_ACCOUNT || "";

if (!key || !account) {
  console.log("Reminders skipped. Set RESEND_API_KEY and FIREBASE_SERVICE_ACCOUNT to send mail.");
  process.exit(0);
}

const { initializeApp, cert, getApps } = await import("firebase-admin/app");
const { getFirestore } = await import("firebase-admin/firestore");

if (!getApps().length) {
  initializeApp({ credential: cert(JSON.parse(account)) });
}
const db = getFirestore();
const users = await db.collection("users").get();
const now = new Date();
const soon = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

for (const doc of users.docs) {
  const data = doc.data()?.data || {};
  const email = doc.data()?.email || "";
  if (!email) continue;
  const due = (data.deadlines || []).filter((item) => item.date && !item.done && item.date <= soon.toISOString().slice(0, 10) && item.date >= now.toISOString().slice(0, 10));
  const lines = [
    "ARAHA Counselor reminder",
    due.length ? `Coming up: ${due.map((item) => `${item.title || "Deadline"} (${item.date})`).join("; ")}` : "No dated deadlines in the next 7 days.",
    "Open the app to update your plan. This note is only as fresh as the dates you saved.",
  ];
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: "ARAHA Counselor <counselor@arahasoft.com>",
      to: email,
      subject: "Your ARAHA Counselor reminder",
      text: lines.join("\n"),
    }),
  });
  if (!response.ok) console.log(`Resend failed for ${doc.id}: ${response.status}`);
  else console.log(`Sent reminder to ${doc.id}`);
}
