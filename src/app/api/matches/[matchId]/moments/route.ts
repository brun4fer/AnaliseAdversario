import { created, handleRouteError, readJson } from "@/lib/api-response";
import { createMoment } from "@/lib/data-store";
import type { CreateMomentInput } from "@/lib/domain";

type Context = {
  params: Promise<{ matchId: string }>;
};

export async function POST(request: Request, context: Context) {
  try {
    const { matchId } = await context.params;
    const body = await readJson<Omit<CreateMomentInput, "matchId">>(request);
    return created(await createMoment({ ...body, matchId }));
  } catch (error) {
    return handleRouteError(error);
  }
}
