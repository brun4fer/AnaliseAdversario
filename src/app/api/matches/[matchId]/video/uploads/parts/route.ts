import { handleRouteError, ok } from "@/lib/api-response";
import { requireCurrentUserId } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { presignMultipartParts } from "@/lib/r2";

export async function POST(request: Request, context: { params: Promise<{ matchId: string }> }) {
  try {
    const ownerId = await requireCurrentUserId();
    const { matchId } = await context.params;
    const body = await request.json();
    const partNumbers: number[] = Array.isArray(body.partNumbers) ? [...new Set<number>(body.partNumbers.map(Number))] : [];
    if (!body.uploadId || !partNumbers.length || partNumbers.length > 500 || partNumbers.some((part) => !Number.isInteger(part) || part < 1 || part > 10_000)) {
      return Response.json({ error: "Invalid multipart upload request." }, { status: 400 });
    }
    const video = await prisma.video.findFirst({ where: { matchId, match: { ownerId } }, orderBy: { updatedAt: "desc" } });
    if (!video || video.storageStatus !== "UPLOADING" || !video.storageKey || video.uploadId !== body.uploadId) {
      return Response.json({ error: "The multipart upload is no longer active." }, { status: 400 });
    }
    return ok({ parts: presignMultipartParts(video.storageKey, body.uploadId, partNumbers) });
  } catch (error) { return handleRouteError(error); }
}
