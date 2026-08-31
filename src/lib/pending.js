/**
 * The upload currently in flight, kept somewhere it can survive the tab dying.
 *
 * Reading a receipt takes 12-30s, which is long enough that people switch to
 * another app while they wait. iOS Safari suspends a backgrounded tab — and
 * under memory pressure discards it entirely and reloads on return — so the
 * request is killed and, if the page was discarded, even the chosen photo is
 * gone. The upload appeared to just die.
 *
 * So the photo is stashed here *before* the request starts, along with a job
 * id. On return, the app finds the pending job and retries with the same id;
 * the server recognises it and returns the already-parsed result instead of
 * reading the receipt a second time.
 *
 * IndexedDB rather than sessionStorage because this holds a multi-megabyte
 * Blob, which sessionStorage cannot take.
 */

const DB_NAME = "splittowin";
const STORE = "pending-upload";
const KEY = "current";
const MAX_AGE_MS = 10 * 60 * 1000; // a stale job is not worth resuming

function openDb() {
  return new Promise((resolve, reject) => {
    let request;
    try {
      request = indexedDB.open(DB_NAME, 1);
    } catch (err) {
      reject(err);
      return;
    }
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function withStore(mode, fn) {
  // Private browsing, blocked site data, or no IndexedDB at all: the app must
  // still work, just without the ability to resume.
  try {
    const db = await openDb();
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, mode);
      const result = fn(tx.objectStore(STORE));
      tx.oncomplete = () => resolve(result?.result ?? null);
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  } catch {
    return null;
  }
}

export function newJobId() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return `job-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export async function savePending({ jobId, file }) {
  await withStore("readwrite", (store) =>
    store.put({ jobId, file, name: file.name, type: file.type, at: Date.now() }, KEY)
  );
}

export async function loadPending() {
  const record = await withStore("readonly", (store) => store.get(KEY));
  if (!record || !record.file) return null;
  if (Date.now() - (record.at || 0) > MAX_AGE_MS) {
    await clearPending();
    return null;
  }
  return record;
}

export async function clearPending() {
  await withStore("readwrite", (store) => store.delete(KEY));
}
