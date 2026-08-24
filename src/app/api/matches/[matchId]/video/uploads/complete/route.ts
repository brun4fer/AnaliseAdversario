import { handleRouteError, ok } from "@/lib/api-response";
import { requireCurrentUserId } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { completeMultipartUpload } from "@/lib/r2";
import { serializeVideo } from "@/lib/video";

const MEBIBYTE = 1024 * 1024;
function partSizeFor(fileSize: number) {
  return Math.max(64 * MEBIBYTE, Math.ceil(fileSize / 10_000 / MEBIBYTE) * MEBIBYTE);
}

export async function POST(request: Request, context: { params: Promise<{ matchId: string }> }) {
  try {
    const ownerId = await requireCurrentUserId();
    const { matchId } = await context.params;
    const body = await request.json();
    const parts = Array.isArray(body.parts)
      ? body.parts.map((part: { partNumber?: unknown; etag?: unknown }) => ({ partNumber: Number(part.partNumber), etag: typeof part.etag === "string" ? part.etag : "" }))
      : [];
    const video = await prisma.video.findFirst({ where: { matchId, match: { ownerId } }, orderBy: { updatedAt: "desc" } });
    if (!video || video.storageStatus !== "UPLOADING" || !video.storageKey || video.uploadId !== body.uploadId) {
      return Response.json({ error: "The multipart upload is no longer active." }, { status: 400 });
    }
    const expectedParts = Math.ceil(Number(video.fileSize) / partSizeFor(Number(video.fileSize)));
    const unique = new Set(parts.map((part: { partNumber: number }) => part.partNumber));
    if (parts.length !== expectedParts || unique.size !== expectedParts || parts.some((part: { partNumber: number; etag: string }) => !Number.isInteger(part.partNumber) || part.partNumber < 1 || part.partNumber > expectedParts || !part.etag)) {
      return Response.json({ error: "The uploaded video is missing one or more parts." }, { status: 400 });
    }
    const etag = await completeMultipartUpload(video.storageKey, body.uploadId, parts);
    const saved = await prisma.video.update({ where: { id: video.id }, data: { storageStatus: "READY", uploadId: null, etag, uploadedAt: new Date() } });
    return ok({ video: serializeVideo(saved) });
  } catch (error) { return handleRouteError(error); }
}
