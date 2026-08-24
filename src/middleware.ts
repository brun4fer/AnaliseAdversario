import { NextRequest, NextResponse } from "next/server";

const COOKIE = "analise_session";
const authPages = ["/login", "/register"];
const publicApiPaths = ["/api/auth/login", "/api/auth/register"];

function decodeSecret(value: string) { return new TextEncoder().encode(value); }
function base64url(bytes: ArrayBuffer) { return btoa(String.fromCharCode(...new Uint8Array(bytes))).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_"); }

async function validSession(token: string | undefined) {
  if (!token) return null;
  const [data, signature] = token.split(".");
  if (!data || !signature) return null;
  const key = await crypto.subtle.importKey("raw", decodeSecret(process.env.AUTH_SECRET || "dev-only-change-this-auth-secret"), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  if (base64url(await crypto.subtle.sign("HMAC", key, decodeSecret(data))) !== signature) return null;
  try {
    const normalized = data.replace(/-/g, "+").replace(/_/g, "/");
    const payload = JSON.parse(atob(normalized)) as { exp: number; mustChangePassword: boolean };
    return payload.exp > Date.now() ? payload : null;
  } catch { return null; }
}

export async function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname;
  if (path.startsWith("/_next") || path.includes(".") || publicApiPaths.includes(path)) return NextResponse.next();
  const session = await validSession(request.cookies.get(COOKIE)?.value);
  if (authPages.includes(path)) {
    if (!session) return NextResponse.next();
    return NextResponse.redirect(new URL(session.mustChangePassword ? "/change-password" : "/", request.url));
  }
  if (!session) {
    if (path.startsWith("/api/")) return NextResponse.json({ error: "Invalid or expired session." }, { status: 401 });
    const url = new URL("/login", request.url); url.searchParams.set("next", path); return NextResponse.redirect(url);
  }
  if (session.mustChangePassword && path !== "/change-password" && path !== "/api/auth/change-password" && path !== "/api/auth/logout") {
    if (path.startsWith("/api/")) return NextResponse.json({ error: "You must change your password before continuing." }, { status: 403 });
    return NextResponse.redirect(new URL("/change-password", request.url));
  }
  return NextResponse.next();
}

export const config = { matcher: ["/((?!_next/static|_next/image|favicon.ico|manifest.webmanifest|sw.js).*)"] };
