import { handleRouteError, ok } from "@/lib/api-response";
import { requireCurrentUser } from "@/lib/auth";
import { setMediaReference } from "@/lib/media-library";
import { mediaPrisma } from "@/lib/media-prisma";
import { ensureMediaWorkspace } from "@/lib/media-workspace";
import { prisma } from "@/lib/prisma";
import { abortMultipartUpload } from "@/lib/r2";
import { serializeVideo } from "@/lib/video";

export async function POST(request: Request, context: { params: Promise<{ matchId: string }> }) {
  try {
    const account = await requireCurrentUser();
    const { appId, mediaWorkspace } = await ensureMediaWorkspace(account);
    const { matchId } = await context.params;
    const body = await request.json();
    const mediaAssetId = typeof body.mediaAssetId === "string" ? body.mediaAssetId : "";
    if (!mediaAssetId) return Response.json({ error: "Select a video from the cloud library." }, { status: 400 });

    const [match, asset] = await Promise.all([
      prisma.match.findFirst({ where: { id: matchId, ownerId: account.id }, include: { videos: { orderBy: { updatedAt: "desc" }, take: 1 } } }),
      mediaPrisma.mediaAsset.findFirst({ where: { id: mediaAssetId, mediaWorkspaceId: mediaWorkspace.id, storageStatus: "READY" } }),
    ]);
    if (!match) return Response.json({ error: "Invalid match." }, { status: 400 });
    if (!asset) return Response.json({ error: "That cloud video is not available for this account." }, { status: 404 });

    const existing = match.videos[0] || null;
    if (existing?.storageKey && existing.uploadId) await abortMultipartUpload(existing.storageKey, existing.uploadId).catch(() => undefined);
    const data = {
      fileName: asset.fileName,
      fileSize: asset.fileSize,
      durationSeconds: asset.durationSeconds,
      mimeType: asset.mimeType,
      lastModified: asset.lastModified,
      storageType: "r2",
      storageKey: null,
      storageStatus: "READY" as const,
      uploadId: null,
      etag: asset.etag,
      uploadedAt: asset.uploadedAt,
      mediaAssetId: asset.id,
    };
    const video = existing
      ? await prisma.video.update({ where: { id: existing.id }, data })
      : await prisma.video.create({ data: { matchId, ...data } });
    await setMediaReference({ mediaWorkspaceId: mediaWorkspace.id, mediaAssetId: asset.id, appId, externalVideoId: video.id, externalMatchId: match.id });
    return ok({ video: serializeVideo(video) });
  } catch (error) {
    return handleRouteError(error);
  }
}
