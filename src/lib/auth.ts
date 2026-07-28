import { createHmac, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { cookies } from "next/headers";

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

export async function ensureInitialUsers() {
  for (const entry of temporaryUsers) {
    const found = await prisma.user.findFirst({ where: { username: { equals: entry.username, mode: "insensitive" } } });
    if (!found) {
      await prisma.user.create({ data: { name: entry.username, username: entry.username, passwordHash: hashPassword(entry.password), mustChangePassword: true } });
    }
  }
}

export type SessionPayload = { userId: string; username: string; mustChangePassword: boolean; exp: number };

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
  if (!session) throw new Error("Sessão inválida ou expirada.");
  return session.userId;
}

export const sessionCookieOptions = { httpOnly: true, sameSite: "lax" as const, secure: process.env.NODE_ENV === "production", path: "/", maxAge: 60 * 60 * 24 * 7 };
