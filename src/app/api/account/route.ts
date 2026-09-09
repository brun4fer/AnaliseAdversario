import { accessAreas } from "@/lib/access-areas";
import { handleRouteError, ok } from "@/lib/api-response";
import { hasAreaAccess, requireCurrentAccount } from "@/lib/auth";

export async function GET() {
  try {
    const account = await requireCurrentAccount();
    return ok({
      id: account.user.id,
      name: account.user.name,
      username: account.user.username,
      accessControl: {
        globalUnlocked: account.session.access?.globalVersion === account.user.globalAccessPasswordVersion,
        unlockedAreas: accessAreas.filter((area) => hasAreaAccess(account, area)),
      },
    });
  } catch (error) { return handleRouteError(error); }
}
