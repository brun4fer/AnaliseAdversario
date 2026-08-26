import { handleRouteError, ok, readJson } from "@/lib/api-response";
import { requireCurrentUser } from "@/lib/auth";
import { upsertVideoMetadata } from "@/lib/data-store";
import type { VideoMetadataInput } from "@/lib/domain";
import { removeMediaReference } from "@/lib/media-library";
import { mediaPrisma } from "@/lib/media-prisma";
import { abortMediaMultipartUpload, createMediaPlaybackUrl } from "@/lib/media-r2";
import { ensureMediaWorkspace } from "@/lib/media-workspace";
import { prisma } from "@/lib/prisma";
import { abortMultipartUpload, createPlaybackUrl, deleteR2Object } from "@/lib/r2";

type Context = { params: Promise<{ matchId: string }> };

export async function GET(_request: Request, context: Context) {
  try {
    const account = await requireCurrentUser();
    const { matchId } = await context.params;
    const video = await prisma.video.findFirst({ where: { matchId, match: { ownerId: account.id } }, orderBy: { updatedAt: "desc" } });
    if (!video) return Response.json({ error: "This match does not have a video." }, { status: 404 });
    if (video.storageStatus !== "READY") return Response.json({ error: "The video has not been uploaded to Cloudflare R2 yet." }, { status: 404 });
    if (video.mediaAssetId) {
      const { mediaWorkspace } = await ensureMediaWorkspace(account);
      const asset = await mediaPrisma.mediaAsset.findFirst({ where: { id: video.mediaAssetId, mediaWorkspaceId: mediaWorkspace.id, storageStatus: "READY" } });
      if (!asset) return Response.json({ error: "The shared cloud video is no longer available." }, { status: 404 });
      return ok(createMediaPlaybackUrl(asset.storageKey));
    }
    if (!video.storageKey) return Response.json({ error: "The video has not been uploaded to Cloudflare R2 yet." }, { status: 404 });
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
    const account = await requireCurrentUser();
    const { matchId } = await context.params;
    const videos = await prisma.video.findMany({ where: { matchId, match: { ownerId: account.id } } });
    const shared = videos.some((video) => video.mediaAssetId) ? await ensureMediaWorkspace(account) : null;
    for (const video of videos) {
      if (video.mediaAssetId && shared) {
        const asset = await mediaPrisma.mediaAsset.findFirst({ where: { id: video.mediaAssetId, mediaWorkspaceId: shared.mediaWorkspace.id } });
        if (asset?.storageStatus === "UPLOADING" && asset.uploadId) {
          await abortMediaMultipartUpload(asset.storageKey, asset.uploadId).catch(() => undefined);
          await mediaPrisma.mediaAsset.update({ where: { id: asset.id }, data: { storageStatus: "FAILED", uploadId: null } }).catch(() => undefined);
        }
        await removeMediaReference(shared.appId, video.id);
      } else {
        if (video.storageKey && video.uploadId) await abortMultipartUpload(video.storageKey, video.uploadId).catch(() => undefined);
        if (video.storageKey) await deleteR2Object(video.storageKey).catch(() => undefined);
      }
    }
    if (videos.length) await prisma.video.deleteMany({ where: { id: { in: videos.map((video) => video.id) } } });
    return ok({ deleted: true });
  } catch (error) { return handleRouteError(error); }
}
