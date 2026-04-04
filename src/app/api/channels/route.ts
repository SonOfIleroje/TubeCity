import { getSupabaseAdmin } from "@/lib/supabase";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const sb = getSupabaseAdmin();
    const { data, error } = await sb
      .from("channels")
      .select("id, youtube_id, handle, channel_name, subscriber_count, video_count, recent_upload_count_30d, category, is_verified, cached_at, avatar_url")
      .order("subscriber_count", { ascending: false })
      .limit(200);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    const mapped = (data ?? []).map(ch => ({
      id: ch.id,
      handle: (ch.handle ?? ch.youtube_id ?? "").replace(/^@/, ""),
      channel_name: ch.channel_name ?? null,
      subscriber_count: ch.subscriber_count ?? 0,
      video_count: ch.video_count ?? 0,
      recent_upload_count_30d: ch.recent_upload_count_30d ?? 0,
      category: ch.category ?? null,
      is_verified: ch.is_verified ?? false,
      avatar_url: ch.avatar_url ?? null,
      cached_at: ch.cached_at ?? null,
    }));

    return NextResponse.json(mapped);
  } catch (err) {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
