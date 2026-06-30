import { handleRouteError, noContent, ok, readJson } from "@/lib/api-response";
import { deleteMoment, updateMoment } from "@/lib/data-store";
import type { UpdateMomentInput } from "@/lib/domain";

type Context = {
  params: Promise<{ momentId: string }>;
};

export async function PATCH(request: Request, context: Context) {
  try {
    const { momentId } = await context.params;
    const body = await readJson<UpdateMomentInput>(request);
    return ok(await updateMoment(momentId, body));
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function DELETE(_request: Request, context: Context) {
  try {
    const { momentId } = await context.params;
    await deleteMoment(momentId);
    return noContent();
  } catch (error) {
    return handleRouteError(error);
  }
}
