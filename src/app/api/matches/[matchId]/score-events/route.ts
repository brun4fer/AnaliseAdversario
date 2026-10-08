import { handleRouteError, noContent, ok, readJson } from "@/lib/api-response";
import { requireAreaUser } from "@/lib/auth";
import { createMatchScoreEvent, deleteMatchScoreEvent } from "@/lib/data-store";

type Context = { params: Promise<{ matchId: string }> };

export async function POST(request: Request, context: Context) {
  try {
    await requireAreaUser("analysis");
    const { matchId } = await context.params;
    const body = await readJson<{ timeSeconds: number; homeScore: number; awayScore: number }>(request);
    return ok(await createMatchScoreEvent(matchId, body));
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function DELETE(request: Request, context: Context) {
  try {
    await requireAreaUser("analysis");
    const { matchId } = await context.params;
    const { searchParams } = new URL(request.url);
    const eventId = searchParams.get("eventId");
    if (!eventId) return Response.json({ error: "Score change is required." }, { status: 400 });
    await deleteMatchScoreEvent(matchId, eventId);
    return noContent();
  } catch (error) {
    return handleRouteError(error);
  }
}
