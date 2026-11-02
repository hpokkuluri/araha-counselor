const DB_NAME = "araha-counselor";
const STORE = "accounts";

function open() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        const store = db.createObjectStore(STORE, { keyPath: "id" });
        store.createIndex("usernameKey", "usernameKey", { unique: true });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function txDone(tx) {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error || new Error("The save was aborted."));
  });
}

export async function list() {
  const db = await open();
  const tx = db.transaction(STORE, "readonly");
  const req = tx.objectStore(STORE).getAll();
  const rows = await new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => reject(req.error);
  });
  db.close();
  return rows
    .map((row) => ({ id: row.id, username: row.username, updatedAt: row.updatedAt, createdAt: row.createdAt }))
    .sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)));
}

export async function getByName(usernameKey) {
  const db = await open();
  const tx = db.transaction(STORE, "readonly");
  const req = tx.objectStore(STORE).index("usernameKey").get(usernameKey);
  const row = await new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result || null);
    req.onerror = () => reject(req.error);
  });
  db.close();
  return row;
}

export async function put(record) {
  const db = await open();
  const tx = db.transaction(STORE, "readwrite");
  tx.objectStore(STORE).put(record);
  await txDone(tx);
  db.close();
}

export async function updateCipher(id, cipher, updatedAt) {
  const db = await open();
  const tx = db.transaction(STORE, "readwrite");
  const store = tx.objectStore(STORE);
  const existing = await new Promise((resolve, reject) => {
    const req = store.get(id);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  if (!existing) {
    db.close();
    return;
  }
  existing.cipher = cipher;
  existing.updatedAt = updatedAt;
  store.put(existing);
  await txDone(tx);
  db.close();
}

export async function remove(id) {
  const db = await open();
  const tx = db.transaction(STORE, "readwrite");
  tx.objectStore(STORE).delete(id);
  await txDone(tx);
  db.close();
}
