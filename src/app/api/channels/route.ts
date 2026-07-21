import { getSupabaseAdmin } from "@/lib/supabase";
import { inferNiche } from "@/lib/niche";
import { NextResponse } from "next/server";

const SELECT_COLS = "id, youtube_id, handle, channel_name, description, subscriber_count, video_count, total_view_count, recent_upload_count_30d, category, niche, is_verified, cached_at, avatar_url";

// Pinned prime spot (see layoutCity in src/app/page.tsx) — its subscriber count
// (32.5K) won't make the top-200 cut once the city has a few hundred channels,
// so it has to be fetched explicitly or it silently disappears from the city.
const PINNED_PRIME_ID = 277;

export async function GET() {
  try {
    const sb = getSupabaseAdmin();
    const { data, error } = await sb
      .from("channels")
      .select(SELECT_COLS)
      .order("subscriber_count", { ascending: false })
      .limit(200);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    let rows = data ?? [];
    if (!rows.some(r => r.id === PINNED_PRIME_ID)) {
      const { data: pinnedRow } = await sb.from("channels").select(SELECT_COLS).eq("id", PINNED_PRIME_ID).maybeSingle();
      if (pinnedRow) rows = [...rows, pinnedRow];
    }

    const mapped = rows.map(ch => ({
      id: ch.id,
      handle: (ch.handle ?? ch.youtube_id ?? "").replace(/^@/, ""),
      channel_name: ch.channel_name ?? null,
      subscriber_count: ch.subscriber_count ?? 0,
      video_count: ch.video_count ?? 0,
      total_view_count: ch.total_view_count ?? 0,
      recent_upload_count_30d: ch.recent_upload_count_30d ?? 0,
      category: ch.category ?? null,
      // Most rows already have a real niche; the ~87% still stuck on "other" get
      // inferred on the fly here rather than left flat until someone backfills them.
      niche: ch.niche && ch.niche !== "other" ? ch.niche : inferNiche(ch.category, `${ch.channel_name ?? ""} ${ch.description ?? ""}`),
      is_verified: ch.is_verified ?? false,
      avatar_url: ch.avatar_url ?? null,
      cached_at: ch.cached_at ?? null,
    }));

    return NextResponse.json(mapped);
  } catch (err) {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
