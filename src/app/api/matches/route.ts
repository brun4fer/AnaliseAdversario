import { created, handleRouteError, ok, readJson } from "@/lib/api-response";
import { createMatch, listMatches } from "@/lib/data-store";
import type { CreateMatchInput } from "@/lib/domain";

export async function GET() {
  try {
    return ok(await listMatches());
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(request: Request) {
  try {
    const body = await readJson<CreateMatchInput>(request);
    return created(await createMatch(body));
  } catch (error) {
    return handleRouteError(error);
  }
}
