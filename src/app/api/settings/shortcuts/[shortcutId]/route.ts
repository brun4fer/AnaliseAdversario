import { handleRouteError, ok, readJson } from "@/lib/api-response";
import { updateShortcut } from "@/lib/data-store";

type Context = {
  params: Promise<{ shortcutId: string }>;
};

export async function PATCH(request: Request, context: Context) {
  try {
    const { shortcutId } = await context.params;
    const body = await readJson<{ key: string }>(request);
    return ok(await updateShortcut(shortcutId, body.key));
  } catch (error) {
    return handleRouteError(error);
  }
}
