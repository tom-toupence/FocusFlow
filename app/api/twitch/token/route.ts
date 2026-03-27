import { NextRequest, NextResponse } from "next/server";

const CLIENT_ID = process.env.NEXT_PUBLIC_TWITCH_CLIENT_ID ?? "";
const CLIENT_SECRET = process.env.TWITCH_CLIENT_SECRET ?? "";

const ALLOWED_REDIRECT_ORIGINS = [
  process.env.NEXT_PUBLIC_TWITCH_REDIRECT_URI,
  "http://localhost:3000",
  process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null,
].filter(Boolean);

export async function POST(request: NextRequest) {
  const body = await request.json();

  const params: Record<string, string> = {
    client_id: CLIENT_ID,
    client_secret: CLIENT_SECRET,
  };

  if (body.grant_type === "authorization_code") {
    if (typeof body.code !== "string" || !/^[a-zA-Z0-9_-]{10,60}$/.test(body.code)) {
      return NextResponse.json({ error: "invalid_code" }, { status: 400 });
    }
    if (typeof body.redirect_uri !== "string") {
      return NextResponse.json({ error: "invalid_redirect_uri" }, { status: 400 });
    }
    const origin = new URL(body.redirect_uri).origin;
    if (!ALLOWED_REDIRECT_ORIGINS.some((allowed) => allowed && (allowed === body.redirect_uri || allowed.startsWith(origin)))) {
      return NextResponse.json({ error: "invalid_redirect_uri" }, { status: 400 });
    }
    if (typeof body.code_verifier !== "string" || !/^[a-zA-Z0-9_-]{43,128}$/.test(body.code_verifier)) {
      return NextResponse.json({ error: "invalid_code_verifier" }, { status: 400 });
    }
    params.grant_type = "authorization_code";
    params.code = body.code;
    params.redirect_uri = body.redirect_uri;
    params.code_verifier = body.code_verifier;
  } else if (body.grant_type === "refresh_token") {
    if (typeof body.refresh_token !== "string" || body.refresh_token.length < 10) {
      return NextResponse.json({ error: "invalid_refresh_token" }, { status: 400 });
    }
    params.grant_type = "refresh_token";
    params.refresh_token = body.refresh_token;
  } else {
    return NextResponse.json({ error: "invalid_grant_type" }, { status: 400 });
  }

  const res = await fetch("https://id.twitch.tv/oauth2/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(params),
  });

  const data = await res.json();

  if (!res.ok) {
    return NextResponse.json(data, { status: res.status });
  }

  return NextResponse.json(data);
}
