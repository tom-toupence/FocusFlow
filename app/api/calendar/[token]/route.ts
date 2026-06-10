import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { blocksToICS } from "@/lib/ics";

// Public ICS subscription feed: calendar apps (iPhone, Google Calendar…) poll
// this URL with the user's secret token and stay in sync automatically.
// Reads use the SERVICE ROLE key (server only — never expose it client-side),
// since calendar apps are not authenticated Supabase users.

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  if (!SUPABASE_URL || !SERVICE_KEY) {
    return NextResponse.json({ error: "calendar_feed_not_configured" }, { status: 503 });
  }

  const { token } = await params;
  if (!/^[a-zA-Z0-9-]{16,64}$/.test(token)) {
    return NextResponse.json({ error: "bad_token" }, { status: 400 });
  }

  const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { persistSession: false },
  });

  const { data: feed } = await admin
    .from("calendar_feeds")
    .select("user_id")
    .eq("token", token)
    .single();
  if (!feed) return NextResponse.json({ error: "unknown_token" }, { status: 404 });

  const { data: rows, error } = await admin
    .from("plan_blocks")
    .select("id, date, start_min, duration_min, label, done")
    .eq("user_id", feed.user_id)
    .order("date");
  if (error) return NextResponse.json({ error: "db_error" }, { status: 502 });

  const ics = blocksToICS(
    (rows ?? []).map((r) => ({
      id: r.id,
      date: r.date,
      startMin: r.start_min,
      durationMin: r.duration_min,
      label: r.label ?? "",
      done: r.done ?? false,
    }))
  );

  return new NextResponse(ics, {
    status: 200,
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": 'inline; filename="focusflow.ics"',
      "Cache-Control": "no-store",
    },
  });
}
