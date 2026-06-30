import { created, handleRouteError, readJson } from "@/lib/api-response";
import { createSubMomentType } from "@/lib/data-store";
import type { SubMomentTypeRecord } from "@/lib/domain";

export async function POST(request: Request) {
  try {
    const body = await readJson<
      Pick<SubMomentTypeRecord, "name" | "code" | "requiresFieldLocation" | "requiresGoalLocation">
    >(request);
    return created(await createSubMomentType(body));
  } catch (error) {
    return handleRouteError(error);
  }
}
