import { created, handleRouteError, readJson } from "@/lib/api-response";
import { createSubMoment } from "@/lib/data-store";
import type { CreateSubMomentInput } from "@/lib/domain";

type Context = {
  params: Promise<{ momentId: string }>;
};

export async function POST(request: Request, context: Context) {
  try {
    const { momentId } = await context.params;
    const body = await readJson<Omit<CreateSubMomentInput, "momentId">>(request);
    return created(await createSubMoment({ ...body, momentId }));
  } catch (error) {
    return handleRouteError(error);
  }
}
