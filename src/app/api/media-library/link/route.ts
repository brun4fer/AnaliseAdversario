import { handleRouteError, ok } from "@/lib/api-response";
import { requireCurrentUser } from "@/lib/auth";
import { claimMediaLinkToken, createMediaLinkToken, getMediaLinkStatus } from "@/lib/media-link";

export async function GET() {
  try {
    return ok(await getMediaLinkStatus(await requireCurrentUser()));
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(request: Request) {
  try {
    const account = await requireCurrentUser();
    const body = await request.json();
    if (body.action === "create") return ok(await createMediaLinkToken(account), { status: 201 });
    if (body.action === "claim") return ok(await claimMediaLinkToken(account, typeof body.token === "string" ? body.token : ""));
    return Response.json({ error: "Invalid cloud library linking action." }, { status: 400 });
  } catch (error) {
    return handleRouteError(error);
  }
}
