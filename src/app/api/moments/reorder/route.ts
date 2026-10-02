import { handleRouteError, noContent, readJson } from "@/lib/api-response";
import { requireAreaUser } from "@/lib/auth";
import { reorderMoments } from "@/lib/data-store";

export async function POST(request: Request) {
  try {
    await requireAreaUser("analysis");
    const body = await readJson<{ momentIds?: string[] }>(request);
    await reorderMoments(Array.isArray(body.momentIds) ? body.momentIds : []);
    return noContent();
  } catch (error) {
    return handleRouteError(error);
  }
}
