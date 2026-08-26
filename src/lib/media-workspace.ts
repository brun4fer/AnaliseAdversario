import { mediaPrisma } from "@/lib/media-prisma";

export type MediaLocalAccount = {
  id: string;
  name: string | null;
  username: string | null;
};

function mediaAppId() {
  const value = process.env.MEDIA_LIBRARY_APP_ID?.trim();
  if (!value) throw new Error("Missing MEDIA_LIBRARY_APP_ID.");
  return value;
}

export async function ensureMediaWorkspace(account: MediaLocalAccount) {
  const appId = mediaAppId();
  const key = { appId_externalWorkspaceId: { appId, externalWorkspaceId: account.id } };
  const existing = await mediaPrisma.mediaAccount.findUnique({ where: key, include: { mediaWorkspace: true } });
  if (existing) return { appId, mediaWorkspace: existing.mediaWorkspace, mediaAccount: existing };

  try {
    const mediaWorkspace = await mediaPrisma.mediaWorkspace.create({
      data: {
        displayName: account.name || account.username || "Opponent Analysis",
        accounts: {
          create: {
            appId,
            externalWorkspaceId: account.id,
            externalUserId: account.id,
            username: account.username,
          },
        },
      },
      include: { accounts: true },
    });
    return { appId, mediaWorkspace, mediaAccount: mediaWorkspace.accounts[0] };
  } catch (error) {
    const created = await mediaPrisma.mediaAccount.findUnique({ where: key, include: { mediaWorkspace: true } });
    if (!created) throw error;
    return { appId, mediaWorkspace: created.mediaWorkspace, mediaAccount: created };
  }
}
