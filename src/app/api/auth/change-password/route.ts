import { cookies } from "next/headers";
import { createSessionToken, hashPassword, passwordValidationError, readSessionToken, SESSION_COOKIE, sessionCookieOptions, verifyPassword } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(request: Request) {
  const jar = await cookies();
  const session = readSessionToken(jar.get(SESSION_COOKIE)?.value);
  if (!session) return Response.json({ error: "Invalid session." }, { status: 401 });
  const body = await request.json() as { currentPassword?: string; newPassword?: string };
  const user = await prisma.user.findUnique({ where: { id: session.userId } });
  if (!user?.passwordHash || !body.currentPassword || !verifyPassword(body.currentPassword, user.passwordHash)) return Response.json({ error: "The current password is incorrect." }, { status: 400 });
  const newPassword = body.newPassword || "";
  const validationError = passwordValidationError(newPassword);
  if (validationError) return Response.json({ error: validationError }, { status: 400 });
  await prisma.user.update({ where: { id: user.id }, data: { passwordHash: hashPassword(newPassword), mustChangePassword: false } });
  jar.set(SESSION_COOKIE, createSessionToken({ userId: user.id, username: user.username!, mustChangePassword: false }), sessionCookieOptions);
  return Response.json({ ok: true });
}
