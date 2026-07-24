import { NextRequest, NextResponse } from "next/server";
import { destroySession } from "@/lib/auth";

export async function POST(request: NextRequest) {
  await destroySession();
  // 303 statt 307: sonst würde der Browser den POST auf /login wiederholen
  return NextResponse.redirect(new URL("/login", request.url), 303);
}
