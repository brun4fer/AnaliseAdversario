export type ExportDirectory = FileSystemDirectoryHandle;

type DirectoryPickerWindow = Window & {
  showDirectoryPicker?: (options?: { mode?: "read" | "readwrite" }) => Promise<FileSystemDirectoryHandle>;
  showSaveFilePicker?: (options?: {
    suggestedName?: string;
    types?: Array<{ description?: string; accept: Record<string, string[]> }>;
  }) => Promise<FileSystemFileHandle>;
};

let pickerActive = false;

async function runFilePicker<T>(open: () => Promise<T>) {
  if (pickerActive) throw new DOMException("A file picker is already active.", "AbortError");
  pickerActive = true;
  try {
    return await open();
  } finally {
    pickerActive = false;
  }
}

export async function pickExportDirectory(): Promise<ExportDirectory | null> {
  const picker = (window as DirectoryPickerWindow).showDirectoryPicker;
  if (!picker) return null;
  return runFilePicker(() => picker({ mode: "readwrite" }));
}

export async function pickExportVideoFile(suggestedName: string): Promise<FileSystemWritableFileStream | null> {
  const picker = (window as DirectoryPickerWindow).showSaveFilePicker;
  if (!picker) return null;
  const handle = await runFilePicker(() => picker({
    suggestedName,
    types: [{ description: document.documentElement.lang.startsWith("pt") ? "Vídeo MP4" : "MP4 video", accept: { "video/mp4": [".mp4"] } }],
  }));
  return handle.createWritable();
}

export async function writeBlobToDirectory(directory: ExportDirectory, path: string, blob: Blob) {
  const parts = path.split("/").filter(Boolean);
  if (parts.length === 0) throw new Error("The export file path is empty.");

  let current = directory;
  for (const part of parts.slice(0, -1)) {
    current = await current.getDirectoryHandle(part, { create: true });
  }

  const fileHandle = await current.getFileHandle(parts.at(-1) as string, { create: true });
  const writable = await fileHandle.createWritable();
  try {
    await writable.write(blob);
    await writable.close();
  } catch (error) {
    await writable.abort().catch(() => undefined);
    throw error;
  }
}

export function isExportPickerCancellation(error: unknown) {
  return error instanceof DOMException && error.name === "AbortError";
}
