import { handleRouteError, noContent, readJson } from "@/lib/api-response";
import { requireAreaUser } from "@/lib/auth";
import { reorderSubMomentTypes } from "@/lib/data-store";

export async function POST(request: Request) {
  try {
    await requireAreaUser(["analysis", "settings"]);
    const body = await readJson<{ subMomentTypeIds?: string[] }>(request);
    await reorderSubMomentTypes(Array.isArray(body.subMomentTypeIds) ? body.subMomentTypeIds : []);
    return noContent();
  } catch (error) {
    return handleRouteError(error);
  }
}
