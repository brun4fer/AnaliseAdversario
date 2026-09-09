import { cookies } from "next/headers";
import { accessAreas, isAccessArea, type AccessArea } from "@/lib/access-areas";
import { handleRouteError, ok, readJson } from "@/lib/api-response";
import { areaAccessVersion, createSessionToken, hashPassword, requireCurrentAccount, requireGlobalAccessUser, SESSION_COOKIE, sessionCookieOptions, validateAccessPassword, verifyAreaPassword, verifyGlobalAccessPassword, verifyPassword, type SessionPayload } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type Account = Awaited<ReturnType<typeof requireCurrentAccount>>;
type AccessState = NonNullable<SessionPayload["access"]>;
function readPassword(value: unknown) { const password = String(value || ""); validateAccessPassword(password); return password; }
function updateFor(area: AccessArea, hash: string) {
  switch (area) {
    case "dashboard": return { dashboardAccessPasswordHash: hash, dashboardAccessPasswordVersion: { increment: 1 } };
    case "newMatch": return { newMatchAccessPasswordHash: hash, newMatchAccessPasswordVersion: { increment: 1 } };
    case "reports": return { reportsAccessPasswordHash: hash, reportsAccessPasswordVersion: { increment: 1 } };
    case "maintenance": return { maintenanceAccessPasswordHash: hash, maintenanceAccessPasswordVersion: { increment: 1 } };
    case "settings": return { settingsAccessPasswordHash: hash, settingsAccessPasswordVersion: { increment: 1 } };
    case "analysis": return { analysisAccessPasswordHash: hash, analysisAccessPasswordVersion: { increment: 1 } };
  }
}
async function setAccessCookie(account: Account, access: AccessState) {
  (await cookies()).set(SESSION_COOKIE, createSessionToken({ userId: account.user.id, username: account.user.username || "", mustChangePassword: account.user.mustChangePassword, access }), sessionCookieOptions);
}
function response(account: Account, access: AccessState) {
  const globalUnlocked = access.globalVersion === account.user.globalAccessPasswordVersion;
  return { globalUnlocked, unlockedAreas: globalUnlocked ? [...accessAreas] : accessAreas.filter((area) => access.areaVersions?.[area] === areaAccessVersion(account, area)) };
}

export async function POST(request: Request) {
  try {
    const account = await requireCurrentAccount();
    const body = await readJson<Record<string, unknown>>(request);
    const action = String(body.action || "unlock");
    if (action === "unlock") {
      if (!isAccessArea(body.area)) throw new Error("Invalid access area.");
      const password = String(body.password || "");
      let access: AccessState;
      if (verifyGlobalAccessPassword(account, password)) access = { ...account.session.access, globalVersion: account.user.globalAccessPasswordVersion };
      else if (verifyAreaPassword(account, body.area, password)) access = { ...account.session.access, areaVersions: { ...account.session.access?.areaVersions, [body.area]: areaAccessVersion(account, body.area) } };
      else throw new Error("Incorrect area or global password.");
      await setAccessCookie(account, access);
      return ok(response(account, access));
    }
    if (action === "unlockGlobal") {
      if (!verifyGlobalAccessPassword(account, String(body.password || ""))) throw new Error("Incorrect global password.");
      const access = { ...account.session.access, globalVersion: account.user.globalAccessPasswordVersion };
      await setAccessCookie(account, access);
      return ok(response(account, access));
    }
    if (action === "resetGlobal") {
      if (!account.user.passwordHash || !verifyPassword(String(body.accountPassword || ""), account.user.passwordHash)) throw new Error("Incorrect sign-in password.");
      const user = await prisma.user.update({ where: { id: account.user.id }, data: { globalAccessPasswordHash: hashPassword(readPassword(body.password)), globalAccessPasswordVersion: { increment: 1 } } });
      const nextAccount = { ...account, user };
      const access = { globalVersion: user.globalAccessPasswordVersion, areaVersions: {} };
      await setAccessCookie(nextAccount, access);
      return ok(response(nextAccount, access));
    }
    throw new Error("Invalid access action.");
  } catch (error) { return handleRouteError(error); }
}

export async function PATCH(request: Request) {
  try {
    const account = await requireGlobalAccessUser();
    const body = await readJson<Record<string, unknown>>(request);
    const target = String(body.target || "");
    const hash = hashPassword(readPassword(body.password));
    if (target === "global") {
      const user = await prisma.user.update({ where: { id: account.user.id }, data: { globalAccessPasswordHash: hash, globalAccessPasswordVersion: { increment: 1 } } });
      const nextAccount = { ...account, user };
      const access = { globalVersion: user.globalAccessPasswordVersion, areaVersions: {} };
      await setAccessCookie(nextAccount, access);
      return ok({ changed: true, ...response(nextAccount, access) });
    }
    if (!isAccessArea(target)) throw new Error("Invalid access area.");
    await prisma.user.update({ where: { id: account.user.id }, data: updateFor(target, hash) });
    await setAccessCookie(account, account.session.access || {});
    return ok({ changed: true, globalUnlocked: true, unlockedAreas: [...accessAreas] });
  } catch (error) { return handleRouteError(error); }
}
