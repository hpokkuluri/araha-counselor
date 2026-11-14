import { emptyData, normalizeData } from "./data.js";
import { profileBlock } from "./prompts.js";
import { GEMINI_MODEL, fcmVapidKey, getFirebaseApp } from "./firebase.js";

const ENCOURAGE = "Never discourage the student. If something is missing or behind, say so calmly and give a concrete catch-up plan for this year.";

export async function watchAuth(onUser) {
  const { auth } = await getFirebaseApp();
  const { onAuthStateChanged } = await import("firebase/auth");
  return onAuthStateChanged(auth, onUser);
}

export function waitForUser(timeoutMs = 8000) {
  return new Promise((resolve) => {
    let stop = null;
    let done = false;
    const finish = (user) => {
      if (done) return;
      done = true;
      resolve(user || null);
      if (stop) stop();
    };
    const timer = setTimeout(() => finish(null), timeoutMs);
    watchAuth((user) => {
      clearTimeout(timer);
      finish(user);
    }).then((unsubscribe) => {
      stop = unsubscribe;
      if (done) unsubscribe();
    }).catch(() => {
      clearTimeout(timer);
      finish(null);
    });
  });
}

export async function signUpEmail(email, password) {
  const { auth } = await getFirebaseApp();
  const { createUserWithEmailAndPassword } = await import("firebase/auth");
  const cred = await createUserWithEmailAndPassword(auth, email.trim(), password);
  return cred.user;
}

export async function signInEmail(email, password) {
  const { auth } = await getFirebaseApp();
  const { signInWithEmailAndPassword } = await import("firebase/auth");
  const cred = await signInWithEmailAndPassword(auth, email.trim(), password);
  return cred.user;
}

export async function resetPassword(email) {
  const { auth } = await getFirebaseApp();
  const { sendPasswordResetEmail } = await import("firebase/auth");
  await sendPasswordResetEmail(auth, email.trim());
}

export async function signOutCloud() {
  const { auth } = await getFirebaseApp();
  const { signOut } = await import("firebase/auth");
  await signOut(auth);
}

export async function loadCloudData(uid) {
  const { db } = await getFirebaseApp();
  const { doc, getDoc } = await import("firebase/firestore");
  const snap = await getDoc(doc(db, "users", uid));
  if (!snap.exists()) return { data: emptyData(), approvedParents: [], linkedKids: [] };
  const raw = snap.data() || {};
  return {
    data: normalizeData(raw.data || {}),
    approvedParents: Array.isArray(raw.approvedParents) ? raw.approvedParents : [],
    linkedKids: Array.isArray(raw.linkedKids) ? raw.linkedKids : [],
  };
}

export async function saveCloudData(uid, data, extra = {}) {
  const { db } = await getFirebaseApp();
  const { doc, setDoc } = await import("firebase/firestore");
  const payload = {
    data: normalizeData(data),
    updatedAt: new Date().toISOString(),
    ...extra,
  };
  await setDoc(doc(db, "users", uid), payload, { merge: true });
}

function model() {
  return getFirebaseApp().then(async ({ app }) => {
    const { getAI, getGenerativeModel, GoogleAIBackend } = await import("firebase/ai");
    const ai = getAI(app, { backend: new GoogleAIBackend() });
    return getGenerativeModel(ai, { model: GEMINI_MODEL }, { timeout: 60000 });
  });
}

export async function geminiText({ system, messages, data, onDelta, shouldStop }) {
  const generative = await model();
  const history = (messages || []).map((item) => `${item.role === "assistant" ? "Counselor" : "Student"}: ${item.content}`).join("\n");
  const prompt = [
    system || "You are ARAHA, a high school counselor.",
    ENCOURAGE,
    "Student profile:",
    profileBlock(data || { profile: {}, plan: { 9: [], 10: [], 11: [], 12: [] }, colleges: [], careers: [], scholarships: [] }),
    history ? `Conversation:\n${history}` : "",
  ].filter(Boolean).join("\n\n");
  const result = await generative.generateContentStream(prompt);
  let text = "";
  for await (const chunk of result.stream) {
    if (shouldStop?.()) return text.trim();
    const piece = chunk.text?.() || "";
    if (!piece) continue;
    text += piece;
    onDelta?.(text);
  }
  return text.trim();
}

export async function geminiImage({ system, prompt, file, data }) {
  const generative = await model();
  const bytes = new Uint8Array(await file.arrayBuffer());
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  const result = await generative.generateContent([
    { text: `${system}\n\n${ENCOURAGE}\n\nStudent profile:\n${profileBlock(data)}\n\n${prompt}` },
    { inlineData: { mimeType: file.type || "image/jpeg", data: btoa(binary) } },
  ]);
  return result.response.text();
}

export async function publishLinkCode(uid, name) {
  const code = Math.random().toString(36).slice(2, 8).toUpperCase();
  const { db } = await getFirebaseApp();
  const { doc, setDoc } = await import("firebase/firestore");
  await setDoc(doc(db, "linkCodes", code), {
    studentUid: uid,
    name: name || "Student",
    createdAt: new Date().toISOString(),
  });
  return code;
}

export async function readLinkCode(code) {
  const { db } = await getFirebaseApp();
  const { doc, getDoc } = await import("firebase/firestore");
  const snap = await getDoc(doc(db, "linkCodes", String(code || "").trim().toUpperCase()));
  if (!snap.exists()) return null;
  return snap.data();
}

export async function requestParentLink(parentUid, studentUid, parentEmail) {
  const { db } = await getFirebaseApp();
  const { doc, setDoc } = await import("firebase/firestore");
  await setDoc(doc(db, "linkRequests", studentUid, "from", parentUid), {
    parentUid,
    parentEmail: parentEmail || "",
    status: "pending",
    at: new Date().toISOString(),
  });
}

export async function parentRequests(studentUid) {
  const { db } = await getFirebaseApp();
  const { collection, getDocs } = await import("firebase/firestore");
  const snap = await getDocs(collection(db, "linkRequests", studentUid, "from"));
  return snap.docs.map((item) => item.data());
}

export async function approveParent(studentUid, parentUid, approvedParents) {
  const { db } = await getFirebaseApp();
  const { doc, setDoc } = await import("firebase/firestore");
  const next = Array.from(new Set([...(approvedParents || []), parentUid]));
  await setDoc(doc(db, "users", studentUid), { approvedParents: next }, { merge: true });
  await setDoc(doc(db, "linkRequests", studentUid, "from", parentUid), { status: "approved" }, { merge: true });
  return next;
}

export async function loadStudent(uid) {
  return loadCloudData(uid);
}

export async function savePushToken(uid, token) {
  const { db } = await getFirebaseApp();
  const { doc, setDoc } = await import("firebase/firestore");
  await setDoc(doc(db, "users", uid), { fcmToken: token }, { merge: true });
}

export async function enablePush(uid) {
  if (!fcmVapidKey) return { ok: false, reason: "Add a VAPID key in src/firebase.js after Cloud Messaging is turned on. Push stays off until then." };
  if (!globalThis.Notification) return { ok: false, reason: "This browser does not offer notifications." };
  const permission = await Notification.requestPermission();
  if (permission !== "granted") return { ok: false, reason: "Notifications were not allowed." };
  const { app } = await getFirebaseApp();
  const { getMessaging, getToken } = await import("firebase/messaging");
  const messaging = getMessaging(app);
  const token = await getToken(messaging, { vapidKey: fcmVapidKey });
  if (token) await savePushToken(uid, token);
  return { ok: Boolean(token), reason: token ? "" : "No push token was issued." };
}
