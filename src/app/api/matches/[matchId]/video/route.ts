import { handleRouteError, ok, readJson } from "@/lib/api-response";
import { upsertVideoMetadata } from "@/lib/data-store";
import type { VideoMetadataInput } from "@/lib/domain";

type Context = {
  params: Promise<{ matchId: string }>;
};

export async function PUT(request: Request, context: Context) {
  try {
    const { matchId } = await context.params;
    const body = await readJson<VideoMetadataInput>(request);
    return ok(await upsertVideoMetadata(matchId, body));
  } catch (error) {
    return handleRouteError(error);
  }
}
