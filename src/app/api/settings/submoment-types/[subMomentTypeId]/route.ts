import { handleRouteError, noContent, ok, readJson } from "@/lib/api-response";
import { deleteSubMomentType, updateSubMomentType } from "@/lib/data-store";
import type { SubMomentTypeRecord } from "@/lib/domain";

type Context = {
  params: Promise<{ subMomentTypeId: string }>;
};

export async function PATCH(request: Request, context: Context) {
  try {
    const { subMomentTypeId } = await context.params;
    const body = await readJson<
      Partial<Pick<SubMomentTypeRecord, "name" | "code" | "requiresFieldLocation" | "requiresGoalLocation">>
    >(request);
    return ok(await updateSubMomentType(subMomentTypeId, body));
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function DELETE(_request: Request, context: Context) {
  try {
    const { subMomentTypeId } = await context.params;
    await deleteSubMomentType(subMomentTypeId);
    return noContent();
  } catch (error) {
    return handleRouteError(error);
  }
}
