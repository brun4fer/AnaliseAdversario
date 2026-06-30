import { handleRouteError, noContent, ok, readJson } from "@/lib/api-response";
import { deleteSubMoment, updateSubMoment } from "@/lib/data-store";
import type { UpdateSubMomentInput } from "@/lib/domain";

type Context = {
  params: Promise<{ subMomentId: string }>;
};

export async function PATCH(request: Request, context: Context) {
  try {
    const { subMomentId } = await context.params;
    const body = await readJson<UpdateSubMomentInput>(request);
    return ok(await updateSubMoment(subMomentId, body));
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function DELETE(_request: Request, context: Context) {
  try {
    const { subMomentId } = await context.params;
    await deleteSubMoment(subMomentId);
    return noContent();
  } catch (error) {
    return handleRouteError(error);
  }
}
