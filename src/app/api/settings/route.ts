import { handleRouteError, ok } from "@/lib/api-response";
import { listSettings } from "@/lib/data-store";
import { requireAreaUser } from "@/lib/auth";

export async function GET() {
  try {
    await requireAreaUser(["settings", "reports", "analysis"]);
    return ok(await listSettings());
  } catch (error) {
    return handleRouteError(error);
  }
}
