import { created, handleRouteError, readJson } from "@/lib/api-response";
import { createMomentType } from "@/lib/data-store";
import type { MomentTypeRecord } from "@/lib/domain";

export async function POST(request: Request) {
  try {
    const body = await readJson<Pick<MomentTypeRecord, "name" | "code" | "color" | "defaultShortcut">>(request);
    return created(await createMomentType(body));
  } catch (error) {
    return handleRouteError(error);
  }
}
