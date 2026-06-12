import { NextRequest, NextResponse } from "next/server";

export function GET(request: NextRequest) {
  return NextResponse.redirect(
    new URL("/assets/logos/logo_dx-legal.png", request.url),
    308,
  );
}
