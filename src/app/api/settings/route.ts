import { handleRouteError, ok } from "@/lib/api-response";
import { listSettings } from "@/lib/data-store";

export async function GET() {
  try {
    return ok(await listSettings());
  } catch (error) {
    return handleRouteError(error);
  }
}
