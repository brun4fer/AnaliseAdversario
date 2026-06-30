import { handleRouteError, noContent, ok, readJson } from "@/lib/api-response";
import { deleteMatch, getMatchDetail, updateMatch } from "@/lib/data-store";
import type { UpdateMatchInput } from "@/lib/domain";

type Context = {
  params: Promise<{ matchId: string }>;
};

export async function GET(_request: Request, context: Context) {
  try {
    const { matchId } = await context.params;
    const match = await getMatchDetail(matchId);
    if (!match) {
      return Response.json({ error: "Jogo não encontrado." }, { status: 404 });
    }
    return ok(match);
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function PATCH(request: Request, context: Context) {
  try {
    const { matchId } = await context.params;
    const body = await readJson<UpdateMatchInput>(request);
    return ok(await updateMatch(matchId, body));
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function DELETE(_request: Request, context: Context) {
  try {
    const { matchId } = await context.params;
    await deleteMatch(matchId);
    return noContent();
  } catch (error) {
    return handleRouteError(error);
  }
}
