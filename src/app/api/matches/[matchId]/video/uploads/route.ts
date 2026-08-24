import { handleRouteError, ok } from "@/lib/api-response";
import { requireCurrentUserId } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { abortMultipartUpload, createMultipartUpload, listMultipartParts } from "@/lib/r2";
import { serializeVideo } from "@/lib/video";

const MEBIBYTE = 1024 * 1024;
const DEFAULT_PART_SIZE = 64 * MEBIBYTE;
const MAX_FILE_SIZE = 5 * 1024 ** 4 - 5 * 1024 ** 3;

function partSizeFor(fileSize: number) {
  return Math.max(DEFAULT_PART_SIZE, Math.ceil(fileSize / 10_000 / MEBIBYTE) * MEBIBYTE);
}

export async function POST(request: Request, context: { params: Promise<{ matchId: string }> }) {
  let created: { key: string; uploadId: string } | null = null;
  try {
    const ownerId = await requireCurrentUserId();
    const { matchId } = await context.params;
    const body = await request.json();
    const fileName = typeof body.fileName === "string" ? body.fileName.trim() : "";
    const fileSize = Number(body.fileSize);
    const durationSeconds = Number(body.durationSeconds);
    const mimeType = typeof body.mimeType === "string" && body.mimeType.startsWith("video/") ? body.mimeType : "video/mp4";
    const lastModified = body.lastModified ? new Date(body.lastModified) : null;
    if (!fileName || !Number.isSafeInteger(fileSize) || fileSize <= 0 || fileSize > MAX_FILE_SIZE) return Response.json({ error: "Invalid video size." }, { status: 400 });
    if (!Number.isFinite(durationSeconds) || durationSeconds <= 0) return Response.json({ error: "Invalid video duration." }, { status: 400 });
    if (lastModified && Number.isNaN(lastModified.getTime())) return Response.json({ error: "Invalid video modification date." }, { status: 400 });

    const match = await prisma.match.findFirst({ where: { id: matchId, ownerId }, include: { videos: { orderBy: { updatedAt: "desc" }, take: 1 } } });
    if (!match) return Response.json({ error: "Invalid match." }, { status: 400 });
    const existing = match.videos[0] || null;
    const sameFile = existing && existing.fileName === fileName && Number(existing.fileSize) === fileSize && existing.lastModified?.getTime() === lastModified?.getTime();
    const partSize = partSizeFor(fileSize);
    if (sameFile && existing.storageStatus === "READY" && existing.storageKey) return ok({ video: serializeVideo(existing), uploadId: null, partSize, completedParts: [], alreadyReady: true });
    if (sameFile && existing.storageStatus === "UPLOADING" && existing.storageKey && existing.uploadId) {
      try {
        const completedParts = await listMultipartParts(existing.storageKey, existing.uploadId);
        return ok({ video: serializeVideo(existing), uploadId: existing.uploadId, partSize, completedParts, alreadyReady: false });
      } catch { /* The remote multipart session expired; start a new one below. */ }
    }
    if (existing?.storageKey && existing.uploadId) await abortMultipartUpload(existing.storageKey, existing.uploadId).catch(() => undefined);

    const storageKey = `users/${ownerId}/matches/${match.id}/video`;
    const uploadId = await createMultipartUpload(storageKey, mimeType);
    created = { key: storageKey, uploadId };
    const data = {
      fileName,
      fileSize: BigInt(fileSize),
      durationSeconds,
      mimeType,
      lastModified,
      storageType: "r2",
      storageKey,
      storageStatus: "UPLOADING" as const,
      uploadId,
      etag: null,
      uploadedAt: null,
    };
    const video = existing ? await prisma.video.update({ where: { id: existing.id }, data }) : await prisma.video.create({ data: { matchId, ...data } });
    return ok({ video: serializeVideo(video), uploadId, partSize, completedParts: [], alreadyReady: false }, { status: 201 });
  } catch (error) {
    if (created) await abortMultipartUpload(created.key, created.uploadId).catch(() => undefined);
    return handleRouteError(error);
  }
}

export async function DELETE(request: Request, context: { params: Promise<{ matchId: string }> }) {
  try {
    const ownerId = await requireCurrentUserId();
    const { matchId } = await context.params;
    const body = await request.json().catch(() => ({}));
    const video = await prisma.video.findFirst({ where: { matchId, match: { ownerId } }, orderBy: { updatedAt: "desc" } });
    if (!video) return ok({ aborted: true });
    if (video.storageKey && video.uploadId && (!body.uploadId || body.uploadId === video.uploadId)) {
      await abortMultipartUpload(video.storageKey, video.uploadId).catch(() => undefined);
      await prisma.video.update({ where: { id: video.id }, data: { storageStatus: "FAILED", uploadId: null } });
    }
    return ok({ aborted: true });
  } catch (error) { return handleRouteError(error); }
}
