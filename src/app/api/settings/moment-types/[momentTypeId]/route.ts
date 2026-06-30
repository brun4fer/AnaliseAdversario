import { handleRouteError, noContent, ok, readJson } from "@/lib/api-response";
import { deleteMomentType, updateMomentType } from "@/lib/data-store";
import type { MomentTypeRecord } from "@/lib/domain";

type Context = {
  params: Promise<{ momentTypeId: string }>;
};

export async function PATCH(request: Request, context: Context) {
  try {
    const { momentTypeId } = await context.params;
    const body = await readJson<Partial<Pick<MomentTypeRecord, "name" | "code" | "color" | "defaultShortcut">>>(request);
    return ok(await updateMomentType(momentTypeId, body));
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function DELETE(_request: Request, context: Context) {
  try {
    const { momentTypeId } = await context.params;
    await deleteMomentType(momentTypeId);
    return noContent();
  } catch (error) {
    return handleRouteError(error);
  }
}
