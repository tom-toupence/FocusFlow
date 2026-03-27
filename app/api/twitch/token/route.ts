import { NextRequest, NextResponse } from "next/server";

const CLIENT_ID = process.env.NEXT_PUBLIC_TWITCH_CLIENT_ID ?? "";
const CLIENT_SECRET = process.env.TWITCH_CLIENT_SECRET ?? "";

export async function POST(request: NextRequest) {
  const body = await request.json();

  const params: Record<string, string> = {
    client_id: CLIENT_ID,
    client_secret: CLIENT_SECRET,
  };

  if (body.grant_type === "authorization_code") {
    params.grant_type = "authorization_code";
    params.code = body.code;
    params.redirect_uri = body.redirect_uri;
  } else if (body.grant_type === "refresh_token") {
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
