import { NextRequest, NextResponse } from "next/server";

const SESSION_COOKIE = "ontrack_session";

// Öffentliche Pfade: kein Login nötig, kein Redirect.
const PUBLIC_PREFIXES = [
  "/login",
  "/register",
  "/warten",
  "/d/", // öffentlicher Fundmodus für QR-Scans
  "/manifest.webmanifest",
  "/icon-",
  "/apple-icon",
];

function isPublicPath(pathname: string): boolean {
  return PUBLIC_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (isPublicPath(pathname)) {
    return NextResponse.next();
  }

  const hasSession = request.cookies.has(SESSION_COOKIE);
  if (!hasSession) {
    const loginUrl = new URL("/login", request.url);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|gif|svg|webp|ico)$).*)",
  ],
};
