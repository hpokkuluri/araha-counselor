import { ITERATIONS, b64ToBytes, bytesToB64, decryptJSON, deriveSecrets, encryptJSON, timingEqual } from "./crypto.js";
import { emptyData, normalizeData, pushActivity } from "./data.js";
import * as db from "./db.js";
import { getEntitlement } from "./entitlement.js";

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
  return Boolean(session.key && session.data && session.id);
}

export function normName(username) {
  return String(username || "").trim().toLowerCase();
}

async function enter(record, key, data) {
  session.id = record.id;
  session.username = record.username;
  session.key = key;
  session.data = data;
  session.parentUntil = 0;
  session.pinFails = 0;
  session.pinWait = 0;
  session.entitlement = await getEntitlement({ id: record.id, username: record.username });
  if (!session.entitlement?.ok) {
    clearSession();
    throw new Error("This profile isn't unlocked for Araha Counselor.");
  }
  pushActivity(data, "session", "Opened Araha Counselor");
  dirty = true;
  await flush();
}

function clearSession() {
  session.id = null;
  session.username = "";
  session.key = null;
  session.data = null;
  session.entitlement = null;
  session.parentUntil = 0;
  session.pinFails = 0;
  session.pinWait = 0;
  dirty = false;
}

export async function signUp(username, password) {
  const display = String(username || "").trim();
  const usernameKey = normName(display);
  if (usernameKey.length < 2 || usernameKey.length > 40) throw new Error("Use 2 to 40 characters for the profile name.");
  if (password.length < 8) throw new Error("Use at least 8 characters for the password.");
  if (await db.getByName(usernameKey)) throw new Error("That name is already used on this device.");
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const { key, verifier } = await deriveSecrets(password, salt, ITERATIONS);
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
  await enter(record, key, data);
}

export async function signIn(username, password) {
  const record = await db.getByName(normName(username));
  if (!record) throw new Error("No profile on this device uses that name.");
  const iterations = Number(record.kdf?.iterations) || ITERATIONS;
  const { key, verifier } = await deriveSecrets(password, b64ToBytes(record.kdf.salt), iterations);
  if (!timingEqual(verifier, b64ToBytes(record.kdf.verifier))) {
    throw new Error("That password doesn't match. It can't be reset, because the data is locked on this device.");
  }
  let data;
  try {
    data = normalizeData(await decryptJSON(key, record.cipher));
  } catch {
    throw new Error("The saved data couldn't be unlocked.");
  }
  await enter(record, key, data);
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
  const { key, verifier } = await deriveSecrets(password, salt, ITERATIONS);
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
  await enter(record, key, normalized);
}

export async function signOut() {
  await flush();
  clearSession();
}

export async function deleteCurrent() {
  const id = session.id;
  clearSession();
  if (id) await db.remove(id);
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
  if (!dirty || !session.key || !session.id || !session.data) return;
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
