import { cookies } from "next/headers";
import { Prisma } from "@prisma/client";

import { createSessionToken, hashPassword, passwordValidationError, SESSION_COOKIE, sessionCookieOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const USERNAME_PATTERN = /^[\p{L}\p{N}._-]+$/u;

export async function POST(request: Request) {
  try {
    const body = await request.json() as { username?: string; password?: string; confirmPassword?: string };
    const username = body.username?.trim() || "";
    const password = body.password || "";

    if (username.length < 3 || username.length > 32) {
      return Response.json({ error: "The username must contain between 3 and 32 characters." }, { status: 400 });
    }
    if (!USERNAME_PATTERN.test(username)) {
      return Response.json({ error: "The username can only contain letters, numbers, dots, underscores and hyphens." }, { status: 400 });
    }
    const validationError = passwordValidationError(password);
    if (validationError) return Response.json({ error: validationError }, { status: 400 });
    if (password !== body.confirmPassword) {
      return Response.json({ error: "The passwords do not match." }, { status: 400 });
    }

    const existing = await prisma.user.findFirst({
      where: { username: { equals: username, mode: "insensitive" } },
      select: { id: true },
    });
    if (existing) return Response.json({ error: "This username is already in use." }, { status: 409 });

    const user = await prisma.user.create({
      data: {
        name: username,
        username,
        passwordHash: hashPassword(password),
        mustChangePassword: false,
      },
    });
    const token = createSessionToken({ userId: user.id, username, mustChangePassword: false });
    (await cookies()).set(SESSION_COOKIE, token, sessionCookieOptions);
    return Response.json({ username }, { status: 201 });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return Response.json({ error: "This username is already in use." }, { status: 409 });
    }
    return Response.json({ error: "The account could not be created. Please try again." }, { status: 500 });
  }
}
