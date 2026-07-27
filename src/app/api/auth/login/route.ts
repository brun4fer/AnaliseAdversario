import { cookies } from "next/headers";
import { createSessionToken, ensureInitialUsers, SESSION_COOKIE, sessionCookieOptions, verifyPassword } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(request: Request) {
  const body = await request.json() as { username?: string; password?: string };
  await ensureInitialUsers();
  const user = await prisma.user.findFirst({ where: { username: { equals: body.username?.trim() || "", mode: "insensitive" } } });
  if (!user?.username || !user.passwordHash || !body.password || !verifyPassword(body.password, user.passwordHash)) return Response.json({ error: "Utilizador ou palavra-passe inválidos." }, { status: 401 });
  const token = createSessionToken({ userId: user.id, username: user.username, mustChangePassword: user.mustChangePassword });
  (await cookies()).set(SESSION_COOKIE, token, sessionCookieOptions);
  return Response.json({ username: user.username, mustChangePassword: user.mustChangePassword });
}
