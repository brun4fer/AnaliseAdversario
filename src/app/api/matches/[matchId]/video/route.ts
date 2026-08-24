import { handleRouteError, ok, readJson } from "@/lib/api-response";
import { requireCurrentUserId } from "@/lib/auth";
import { upsertVideoMetadata } from "@/lib/data-store";
import type { VideoMetadataInput } from "@/lib/domain";
import { prisma } from "@/lib/prisma";
import { abortMultipartUpload, createPlaybackUrl, deleteR2Object } from "@/lib/r2";

type Context = { params: Promise<{ matchId: string }> };

export async function GET(_request: Request, context: Context) {
  try {
    const ownerId = await requireCurrentUserId();
    const { matchId } = await context.params;
    const video = await prisma.video.findFirst({ where: { matchId, match: { ownerId } }, orderBy: { updatedAt: "desc" } });
    if (!video) return Response.json({ error: "This match does not have a video." }, { status: 404 });
    if (video.storageStatus !== "READY" || !video.storageKey) return Response.json({ error: "The video has not been uploaded to Cloudflare R2 yet." }, { status: 404 });
    return ok(createPlaybackUrl(video.storageKey));
  } catch (error) { return handleRouteError(error); }
}

// Retained for older clients that only register local video metadata.
export async function PUT(request: Request, context: Context) {
  try { return ok(await upsertVideoMetadata((await context.params).matchId, await readJson<VideoMetadataInput>(request))); }
  catch (error) { return handleRouteError(error); }
}

export async function DELETE(_request: Request, context: Context) {
  try {
    const ownerId = await requireCurrentUserId();
    const { matchId } = await context.params;
    const videos = await prisma.video.findMany({ where: { matchId, match: { ownerId } } });
    for (const video of videos) {
      if (video.storageKey && video.uploadId) await abortMultipartUpload(video.storageKey, video.uploadId).catch(() => undefined);
      if (video.storageKey) await deleteR2Object(video.storageKey).catch(() => undefined);
    }
    if (videos.length) await prisma.video.deleteMany({ where: { id: { in: videos.map((video) => video.id) } } });
    return ok({ deleted: true });
  } catch (error) { return handleRouteError(error); }
}
