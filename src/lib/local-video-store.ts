const DATABASE_NAME = "analise-adversario-local-videos";
const STORE_NAME = "match-videos";
const VERSION = 1;

type StoredVideo = { matchId: string; file: File; savedAt: number };

// Keeps large files available while navigating between analysis pages in the
// same browser session, even when IndexedDB cannot persist several gigabytes.
const sessionVideos = new Map<string, File>();

function openDatabase() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    if (typeof indexedDB === "undefined") return reject(new Error("Local video storage is not available in this browser."));
    const request = indexedDB.open(DATABASE_NAME, VERSION);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(STORE_NAME)) database.createObjectStore(STORE_NAME, { keyPath: "matchId" });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error("Could not open local storage."));
  });
}

export async function rememberMatchVideo(matchId: string, file: File) {
  sessionVideos.set(matchId, file);
  const database = await openDatabase();
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction(STORE_NAME, "readwrite");
      transaction.objectStore(STORE_NAME).put({ matchId, file, savedAt: Date.now() } satisfies StoredVideo);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error || new Error("Could not save the video in the browser."));
      transaction.onabort = () => reject(transaction.error || new Error("The browser does not have enough space to save the video."));
    });
  } finally { database.close(); }
}

export async function getRememberedMatchVideo(matchId: string) {
  const sessionFile = sessionVideos.get(matchId);
  if (sessionFile) return sessionFile;
  const database = await openDatabase();
  try {
    const file = await new Promise<File | null>((resolve, reject) => {
      const request = database.transaction(STORE_NAME, "readonly").objectStore(STORE_NAME).get(matchId);
      request.onsuccess = () => resolve((request.result as StoredVideo | undefined)?.file || null);
      request.onerror = () => reject(request.error || new Error("Could not restore the local video."));
    });
    if (file) sessionVideos.set(matchId, file);
    return file;
  } finally { database.close(); }
}
