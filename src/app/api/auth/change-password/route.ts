import { cookies } from "next/headers";
import { createSessionToken, hashPassword, readSessionToken, SESSION_COOKIE, sessionCookieOptions, verifyPassword } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(request: Request) {
  const jar = await cookies();
  const session = readSessionToken(jar.get(SESSION_COOKIE)?.value);
  if (!session) return Response.json({ error: "Sessão inválida." }, { status: 401 });
  const body = await request.json() as { currentPassword?: string; newPassword?: string };
  const user = await prisma.user.findUnique({ where: { id: session.userId } });
  if (!user?.passwordHash || !body.currentPassword || !verifyPassword(body.currentPassword, user.passwordHash)) return Response.json({ error: "A palavra-passe atual está incorreta." }, { status: 400 });
  if (!body.newPassword || body.newPassword.length < 8 || !/[A-Z]/.test(body.newPassword) || !/[a-z]/.test(body.newPassword) || !/\d/.test(body.newPassword)) return Response.json({ error: "A nova palavra-passe deve ter 8 caracteres, maiúscula, minúscula e número." }, { status: 400 });
  await prisma.user.update({ where: { id: user.id }, data: { passwordHash: hashPassword(body.newPassword), mustChangePassword: false } });
  jar.set(SESSION_COOKIE, createSessionToken({ userId: user.id, username: user.username!, mustChangePassword: false }), sessionCookieOptions);
  return Response.json({ ok: true });
}
