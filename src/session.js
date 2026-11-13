import { ITERATIONS, b64ToBytes, bytesToB64, decryptJSON, deriveSecrets, encryptJSON, timingEqual } from "./crypto.js";
import { emptyData, normalizeData, pushActivity } from "./data.js";
import * as db from "./db.js";
import { getEntitlement } from "./entitlement.js";
import { fitModelChoice } from "./ai.js";

const SESSION_KEY = "ac-session";

export const session = {
  id: null,
  username: "",
  key: null,
  data: null,
  entitlement: null,
  parentUntil: 0,
  pinFails: 0,
  pinWait: 0,
};

let writing = false;
let dirty = false;

export function signedIn() {
  return Boolean(session.data && session.id && (session.cloud || session.key));
}

export function usesCloud() {
  return Boolean(session.cloud) && session.data?.settings?.preferLocal !== true;
}

export function normName(username) {
  return String(username || "").trim().toLowerCase();
}

function remember(raw) {
  if (!raw || !session.id) return;
  sessionStorage.setItem(SESSION_KEY, JSON.stringify({
    id: session.id,
    username: session.username,
    key: bytesToB64(raw),
  }));
}

async function enter(record, key, data, raw, { log = true } = {}) {
  session.id = record.id;
  session.username = record.username;
  session.key = key;
  session.data = data;
  session.parentUntil = 0;
  session.pinFails = 0;
  session.pinWait = 0;
  const fitted = fitModelChoice(data.settings);
  if (fitted !== data.settings.modelId) data.settings.modelId = fitted;
  session.entitlement = await getEntitlement({ id: record.id, username: record.username });
  if (!session.entitlement?.ok) {
    clearSession();
    throw new Error("This profile isn't unlocked for ARAHA Counselor.");
  }
  remember(raw);
  if (log) pushActivity(data, "session", "Opened ARAHA Counselor");
  dirty = true;
  await flush();
}

export async function restoreSession() {
  try {
    const { waitForUser, loadCloudData } = await import("./cloud.js");
    const user = await waitForUser();
    if (user) {
      const cloud = await loadCloudData(user.uid);
      session.id = user.uid;
      session.username = user.email || "";
      session.cloud = true;
      session.key = { cloud: true };
      session.data = cloud.data;
      session.approvedParents = cloud.approvedParents;
      session.linkedKids = cloud.linkedKids;
      session.parentUntil = 0;
      session.pinFails = 0;
      session.pinWait = 0;
      return true;
    }
  } catch { /* stay with the on-device session if the network is down and Firebase has no cached user */ }
  let saved = null;
  try { saved = JSON.parse(sessionStorage.getItem(SESSION_KEY) || "null"); } catch { return false; }
  if (!saved?.id || !saved?.key) return false;
  const record = await db.get(saved.id);
  if (!record?.cipher) {
    sessionStorage.removeItem(SESSION_KEY);
    return false;
  }
  try {
    const raw = b64ToBytes(saved.key);
    const key = await crypto.subtle.importKey("raw", raw, "AES-GCM", false, ["encrypt", "decrypt"]);
    const data = normalizeData(await decryptJSON(key, record.cipher));
    await enter(record, key, data, raw, { log: false });
    return true;
  } catch {
    sessionStorage.removeItem(SESSION_KEY);
    clearSession();
    return false;
  }
}

function clearSession() {
  try { sessionStorage.removeItem(SESSION_KEY); } catch { /* ignore */ }
  session.id = null;
  session.username = "";
  session.key = null;
  session.data = null;
  session.entitlement = null;
  session.parentUntil = 0;
  session.pinFails = 0;
  session.pinWait = 0;
  session.cloud = false;
  session.approvedParents = [];
  session.linkedKids = [];
  dirty = false;
}

export async function signUp(username, password) {
  const display = String(username || "").trim();
  const usernameKey = normName(display);
  if (usernameKey.length < 2 || usernameKey.length > 40) throw new Error("Use 2 to 40 characters for the profile name.");
  if (password.length < 8) throw new Error("Use at least 8 characters for the password.");
  if (await db.getByName(usernameKey)) throw new Error("That name is already used on this device.");
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const { key, raw, verifier } = await deriveSecrets(password, salt, ITERATIONS);
  const data = emptyData();
  const cipher = await encryptJSON(key, data);
  const record = {
    id: crypto.randomUUID(),
    username: display,
    usernameKey,
    kdf: { salt: bytesToB64(salt), iterations: ITERATIONS, verifier: bytesToB64(verifier) },
    cipher,
    createdAt: data.createdAt,
    updatedAt: data.updatedAt,
  };
  await db.put(record);
  await enter(record, key, data, raw);
}

export async function importDeviceIntoCloud(username, password) {
  if (!session.cloud) throw new Error("Sign in with email first.");
  const record = await db.getByName(normName(username));
  if (!record) throw new Error("No profile on this device uses that name.");
  const iterations = Number(record.kdf?.iterations) || ITERATIONS;
  const { key, verifier } = await deriveSecrets(password, b64ToBytes(record.kdf.salt), iterations);
  if (!timingEqual(verifier, b64ToBytes(record.kdf.verifier))) throw new Error("That password doesn't match the on-device profile.");
  const data = normalizeData(await decryptJSON(key, record.cipher));
  await replaceData(data);
}

export async function signIn(username, password) {
  const record = await db.getByName(normName(username));
  if (!record) throw new Error("No profile on this device uses that name.");
  const iterations = Number(record.kdf?.iterations) || ITERATIONS;
  const { key, raw, verifier } = await deriveSecrets(password, b64ToBytes(record.kdf.salt), iterations);
  if (!timingEqual(verifier, b64ToBytes(record.kdf.verifier))) {
    throw new Error("That password doesn't match. It can't be reset, because the data is locked on this device.");
  }
  let data;
  try {
    data = normalizeData(await decryptJSON(key, record.cipher));
  } catch {
    throw new Error("The saved data couldn't be unlocked.");
  }
  await enter(record, key, data, raw);
}

export async function createFromBackup(username, password, data) {
  const display = String(username || "").trim();
  const usernameKey = normName(display);
  if (usernameKey.length < 2) throw new Error("Name the restored profile.");
  if (password.length < 8) throw new Error("Choose a password of at least 8 characters for this device.");
  if (await db.getByName(usernameKey)) {
    throw new Error("That name already exists here. Sign in, then import the backup from More.");
  }
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const { key, raw, verifier } = await deriveSecrets(password, salt, ITERATIONS);
  const normalized = normalizeData(data);
  normalized.updatedAt = new Date().toISOString();
  const cipher = await encryptJSON(key, normalized);
  const record = {
    id: crypto.randomUUID(),
    username: display,
    usernameKey,
    kdf: { salt: bytesToB64(salt), iterations: ITERATIONS, verifier: bytesToB64(verifier) },
    cipher,
    createdAt: normalized.createdAt,
    updatedAt: normalized.updatedAt,
  };
  await db.put(record);
  await enter(record, key, normalized, raw);
}

export async function signOut() {
  await flush();
  if (session.cloud) {
    try {
      const { signOutCloud } = await import("./cloud.js");
      await signOutCloud();
    } catch { /* local session still clears */ }
  }
  clearSession();
}

export async function signUpEmail(email, password) {
  const { signUpEmail: create } = await import("./cloud.js");
  const user = await create(email, password);
  await enterCloud(user, emptyData());
}

export async function signInEmail(email, password) {
  const { signInEmail: enter, loadCloudData } = await import("./cloud.js");
  const user = await enter(email, password);
  const cloud = await loadCloudData(user.uid);
  await enterCloud(user, cloud.data, cloud);
}

async function enterCloud(user, data, extra = {}) {
  session.id = user.uid;
  session.username = user.email || "";
  session.cloud = true;
  session.key = { cloud: true };
  session.data = normalizeData(data);
  session.approvedParents = extra.approvedParents || [];
  session.linkedKids = extra.linkedKids || [];
  session.parentUntil = 0;
  dirty = true;
  await flush();
}

export async function deleteCurrent() {
  const id = session.id;
  const cloud = session.cloud;
  if (cloud) {
    try {
      const { signOutCloud } = await import("./cloud.js");
      await signOutCloud();
    } catch { /* still leave the screen */ }
  }
  clearSession();
  if (id && !cloud) await db.remove(id);
}

export function update(mutator) {
  if (!session.data) return;
  mutator(session.data);
  session.data.updatedAt = new Date().toISOString();
  dirty = true;
  queue();
}

export async function replaceData(next) {
  session.data = normalizeData(next);
  session.data.updatedAt = new Date().toISOString();
  session.parentUntil = 0;
  dirty = true;
  await flush();
}

function queue() {
  if (writing) return;
  writing = true;
  flush().finally(() => {
    writing = false;
    if (dirty) queue();
  });
}

export async function flush() {
  if (!dirty || !session.id || !session.data) return;
  if (session.cloud) {
    dirty = false;
    const { saveCloudData } = await import("./cloud.js");
    await saveCloudData(session.id, session.data, {
      approvedParents: session.approvedParents || [],
      linkedKids: session.linkedKids || [],
      email: session.username || "",
    });
    return;
  }
  if (!session.key) return;
  dirty = false;
  const id = session.id;
  const snapshot = structuredClone(session.data);
  const cipher = await encryptJSON(session.key, snapshot);
  if (session.id !== id) return;
  await db.updateCipher(id, cipher, snapshot.updatedAt);
}

export async function listAccounts() {
  return db.list();
}

export function parentUnlocked() {
  return session.parentUntil > Date.now();
}
