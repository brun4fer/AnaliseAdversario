import type { Video } from "@prisma/client";

export function serializeVideo(video: Video) {
  return {
    id: video.id,
    matchId: video.matchId,
    fileName: video.fileName,
    fileSize: Number(video.fileSize),
    durationSeconds: video.durationSeconds,
    mimeType: video.mimeType,
    lastModified: video.lastModified?.toISOString() ?? null,
    storageType: video.storageType === "r2" ? "r2" as const : "local" as const,
    storageStatus: video.storageStatus,
    uploadedAt: video.uploadedAt?.toISOString() ?? null,
    createdAt: video.createdAt.toISOString(),
    updatedAt: video.updatedAt.toISOString(),
  };
}
