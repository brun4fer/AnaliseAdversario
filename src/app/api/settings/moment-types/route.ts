import { created, handleRouteError, readJson } from "@/lib/api-response";
import { createMomentType } from "@/lib/data-store";
import type { MomentTypeRecord } from "@/lib/domain";
import { requireAreaUser } from "@/lib/auth";

export async function POST(request: Request) {
  try {
    await requireAreaUser("settings");
    const body = await readJson<Pick<MomentTypeRecord, "name" | "code" | "color" | "defaultShortcut">>(request);
    return created(await createMomentType(body));
  } catch (error) {
    return handleRouteError(error);
  }
}
