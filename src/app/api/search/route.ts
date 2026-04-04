import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { searchChannels } from "@/lib/youtube-api";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q");
  if (!query || query.trim().length < 2) return NextResponse.json({ error: "q parameter required (min 2 chars)" }, { status: 400 });

  const trimmed = query.trim();
  const sb = getSupabaseAdmin();

  if (trimmed.startsWith("@")) {
    return NextResponse.json({ results: [], redirect_handle: trimmed, message: "Use /api/channel?handle=" + trimmed + " for direct lookup" });
  }

  const { data: cachedResults } = await sb.from("channels").select("youtube_id, handle, channel_name, avatar_url, description, subscriber_count").ilike("channel_name", `%${trimmed}%`).order("subscriber_count", { ascending: false }).limit(10);

  if (cachedResults && cachedResults.length >= 3) {
    return NextResponse.json({ results: cachedResults, source: "cache" });
  }

  try {
    const apiResults = await searchChannels(trimmed, 5);
    const seenIds = new Set((cachedResults ?? []).map(r => r.youtube_id));
    const merged = [...(cachedResults ?? []), ...apiResults.filter(r => !seenIds.has(r.youtube_id)).map(r => ({ youtube_id: r.youtube_id, handle: null, channel_name: r.channel_name, avatar_url: r.avatar_url, description: r.description, subscriber_count: null }))];
    return NextResponse.json({ results: merged, source: "mixed" });
  } catch {
    return NextResponse.json({ results: cachedResults ?? [], source: "cache_fallback" });
  }
}
