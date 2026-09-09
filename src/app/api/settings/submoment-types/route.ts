import { created, handleRouteError, readJson } from "@/lib/api-response";
import { createSubMomentType } from "@/lib/data-store";
import type { SubMomentTypeRecord } from "@/lib/domain";
import { requireAreaUser } from "@/lib/auth";

export async function POST(request: Request) {
  try {
    await requireAreaUser(["settings", "analysis"]);
    const body = await readJson<Pick<SubMomentTypeRecord, "name" | "code">>(request);
    return created(await createSubMomentType(body));
  } catch (error) {
    return handleRouteError(error);
  }
}
