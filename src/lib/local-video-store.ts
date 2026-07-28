const DATABASE_NAME = "analise-adversario-local-videos";
const STORE_NAME = "match-videos";
const VERSION = 1;

type StoredVideo = { matchId: string; file: File; savedAt: number };

function openDatabase() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    if (typeof indexedDB === "undefined") return reject(new Error("O armazenamento local de vídeos não está disponível neste browser."));
    const request = indexedDB.open(DATABASE_NAME, VERSION);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(STORE_NAME)) database.createObjectStore(STORE_NAME, { keyPath: "matchId" });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error("Não foi possível abrir o armazenamento local."));
  });
}

export async function rememberMatchVideo(matchId: string, file: File) {
  const database = await openDatabase();
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction(STORE_NAME, "readwrite");
      transaction.objectStore(STORE_NAME).put({ matchId, file, savedAt: Date.now() } satisfies StoredVideo);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error || new Error("Não foi possível guardar o vídeo no browser."));
      transaction.onabort = () => reject(transaction.error || new Error("O browser não tem espaço suficiente para guardar o vídeo."));
    });
  } finally { database.close(); }
}

export async function getRememberedMatchVideo(matchId: string) {
  const database = await openDatabase();
  try {
    return await new Promise<File | null>((resolve, reject) => {
      const request = database.transaction(STORE_NAME, "readonly").objectStore(STORE_NAME).get(matchId);
      request.onsuccess = () => resolve((request.result as StoredVideo | undefined)?.file || null);
      request.onerror = () => reject(request.error || new Error("Não foi possível recuperar o vídeo local."));
    });
  } finally { database.close(); }
}
