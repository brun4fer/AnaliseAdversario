import { createHmac, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { cookies } from "next/headers";
import { accessAreaDetails, areaPasswordsEnabled, globalAccessDefaultPassword, type AccessArea } from "@/lib/access-areas";

export const SESSION_COOKIE = "analise_session";
const temporaryUsers = [
  { username: "Paulo", password: "Paulo2026!" },
  { username: "Simao", password: "Simao2026!" },
] as const;

function secret() {
  return process.env.AUTH_SECRET || "dev-only-change-this-auth-secret";
}

export function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  return `${salt}:${scryptSync(password, salt, 64).toString("hex")}`;
}

export function verifyPassword(password: string, stored: string) {
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  const actual = scryptSync(password, salt, 64);
  const expected = Buffer.from(hash, "hex");
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export function passwordValidationError(password: string) {
  if (password.length < 8 || !/[A-Z]/.test(password) || !/[a-z]/.test(password) || !/\d/.test(password)) {
    return "The password must contain at least 8 characters, including uppercase, lowercase and a number.";
  }
  return null;
}

export async function ensureInitialUsers() {
  for (const entry of temporaryUsers) {
    const found = await prisma.user.findFirst({ where: { username: { equals: entry.username, mode: "insensitive" } } });
    if (!found) {
      await prisma.user.create({ data: { name: entry.username, username: entry.username, passwordHash: hashPassword(entry.password), mustChangePassword: true } });
    }
  }
}

export class AreaAccessError extends Error {
  status = 403;
  constructor(message = "Enter the password for this area to continue.") { super(message); this.name = "AreaAccessError"; }
}

export type SessionPayload = { userId: string; username: string; mustChangePassword: boolean; access?: { globalVersion?: number; areaVersions?: Partial<Record<AccessArea, number>> }; exp: number };

export function createSessionToken(payload: Omit<SessionPayload, "exp">) {
  const data = Buffer.from(JSON.stringify({ ...payload, exp: Date.now() + 1000 * 60 * 60 * 24 * 7 })).toString("base64url");
  const signature = createHmac("sha256", secret()).update(data).digest("base64url");
  return `${data}.${signature}`;
}

export function readSessionToken(token?: string | null): SessionPayload | null {
  if (!token) return null;
  const [data, signature] = token.split(".");
  if (!data || !signature) return null;
  const expected = createHmac("sha256", secret()).update(data).digest("base64url");
  if (signature.length !== expected.length || !timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) return null;
  try {
    const payload = JSON.parse(Buffer.from(data, "base64url").toString()) as SessionPayload;
    return payload.exp > Date.now() ? payload : null;
  } catch { return null; }
}

export async function requireCurrentUserId() {
  const session = readSessionToken((await cookies()).get(SESSION_COOKIE)?.value);
  if (!session) throw new Error("Invalid or expired session.");
  return session.userId;
}

export async function currentSession() {
  return readSessionToken((await cookies()).get(SESSION_COOKIE)?.value);
}

export async function requireCurrentAccount() {
  const session = await currentSession();
  if (!session) throw new Error("Invalid or expired session.");
  const user = await prisma.user.findUnique({ where: { id: session.userId } });
  if (!user) throw new Error("The signed-in user no longer exists.");
  return { user, session };
}

export async function requireCurrentUser() {
  return (await requireCurrentAccount()).user;
}

type CurrentAccount = Awaited<ReturnType<typeof requireCurrentAccount>>;
function areaPassword(account: CurrentAccount, area: AccessArea) {
  switch (area) {
    case "dashboard": return [account.user.dashboardAccessPasswordHash, account.user.dashboardAccessPasswordVersion] as const;
    case "newMatch": return [account.user.newMatchAccessPasswordHash, account.user.newMatchAccessPasswordVersion] as const;
    case "reports": return [account.user.reportsAccessPasswordHash, account.user.reportsAccessPasswordVersion] as const;
    case "maintenance": return [account.user.maintenanceAccessPasswordHash, account.user.maintenanceAccessPasswordVersion] as const;
    case "settings": return [account.user.settingsAccessPasswordHash, account.user.settingsAccessPasswordVersion] as const;
    case "analysis": return [account.user.analysisAccessPasswordHash, account.user.analysisAccessPasswordVersion] as const;
  }
}
export function areaAccessVersion(account: CurrentAccount, area: AccessArea) { return areaPassword(account, area)[1]; }
export function verifyAreaPassword(account: CurrentAccount, area: AccessArea, password: string) { const stored = areaPassword(account, area)[0]; return stored ? verifyPassword(password, stored) : password === accessAreaDetails[area].defaultPassword; }
export function verifyGlobalAccessPassword(account: CurrentAccount, password: string) { const stored = account.user.globalAccessPasswordHash; return stored ? verifyPassword(password, stored) : password === globalAccessDefaultPassword; }
export function hasAreaAccess(account: CurrentAccount, area: AccessArea) { return !areaPasswordsEnabled || account.session.access?.globalVersion === account.user.globalAccessPasswordVersion || account.session.access?.areaVersions?.[area] === areaAccessVersion(account, area); }
export async function requireAreaUser(area: AccessArea | AccessArea[]) { const account = await requireCurrentAccount(); const areas = Array.isArray(area) ? area : [area]; if (!areas.some((item) => hasAreaAccess(account, item))) throw new AreaAccessError(); return account; }
export async function requireGlobalAccessUser() { const account = await requireCurrentAccount(); if (account.session.access?.globalVersion !== account.user.globalAccessPasswordVersion) throw new AreaAccessError("Enter the global password to manage access passwords."); return account; }
export function validateAccessPassword(password: string) { if (password.length < 4) throw new Error("The password must contain at least 4 characters."); }

export const sessionCookieOptions = { httpOnly: true, sameSite: "lax" as const, secure: process.env.NODE_ENV === "production", path: "/", maxAge: 60 * 60 * 24 * 7 };
