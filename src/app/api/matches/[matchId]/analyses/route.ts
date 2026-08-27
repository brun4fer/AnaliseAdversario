import { created, handleRouteError, readJson } from "@/lib/api-response";
import { saveMatchAnalysis } from "@/lib/data-store";
import type { MatchAnalysisPerspective } from "@/lib/domain";

type Context = {
  params: Promise<{ matchId: string }>;
};

export async function POST(request: Request, context: Context) {
  try {
    const { matchId } = await context.params;
    const body = await readJson<{ perspective?: MatchAnalysisPerspective }>(request);
    if (body.perspective !== "opponent" && body.perspective !== "team") {
      return Response.json({ error: "Invalid analysis perspective." }, { status: 400 });
    }
    return created(await saveMatchAnalysis(matchId, body.perspective));
  } catch (error) {
    return handleRouteError(error);
  }
}
