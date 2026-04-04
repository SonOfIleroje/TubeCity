import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { fetchFullChannelData, YouTubeFetchError } from "@/lib/youtube-api";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const handle = searchParams.get("handle");
  if (!handle) return NextResponse.json({ error: "handle parameter is required" }, { status: 400 });

  const cleanHandle = handle.startsWith("@") ? handle.slice(1) : handle;
  const sb = getSupabaseAdmin();

  const { data: cached } = await sb.from("channels").select("*, recent_uploads(*)").or(`handle.eq.@${cleanHandle},handle.eq.${cleanHandle}`).single();

  if (cached) {
    const cachedAt = new Date(cached.cached_at ?? cached.created_at);
    const hoursSinceCached = (Date.now() - cachedAt.getTime()) / (1000 * 60 * 60);
    if (hoursSinceCached < 24) {
      return NextResponse.json({ channel: cached, recent_uploads: cached.recent_uploads ?? [], source: "cache" },
        { headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600" } });
    }
  }

  try {
    const { channel, recent_uploads } = await fetchFullChannelData(cleanHandle);
    const thirtyDaysAgo = new Date(); thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const recentCount30d = recent_uploads.filter(u => new Date(u.published_at) >= thirtyDaysAgo).length;

    const channelRow = {
      youtube_id: channel.youtube_id, handle: channel.handle, channel_name: channel.channel_name,
      avatar_url: channel.avatar_url, banner_url: channel.banner_url, description: channel.description,
      subscriber_count: channel.subscriber_count, video_count: channel.video_count,
      total_view_count: channel.total_view_count, uploads_playlist_id: channel.uploads_playlist_id,
      category: channel.category, is_verified: channel.is_verified, published_at: channel.published_at,
      country: channel.country, recent_upload_count_30d: recentCount30d, cached_at: new Date().toISOString(),
    };

    const { data: upserted, error: upsertError } = await sb.from("channels").upsert(channelRow, { onConflict: "youtube_id" }).select("id").single();
    if (upsertError) console.error("Channel upsert error:", upsertError);

    if (upserted?.id && recent_uploads.length > 0) {
      const uploadRows = recent_uploads.map(u => ({ channel_id: upserted.id, video_id: u.video_id, title: u.title, published_at: u.published_at, thumbnail_url: u.thumbnail_url, cached_at: new Date().toISOString() }));
      await sb.from("recent_uploads").upsert(uploadRows, { onConflict: "video_id" });
    }

    return NextResponse.json({ channel: { ...channelRow, id: upserted?.id, recent_upload_count_30d: recentCount30d }, recent_uploads, source: "youtube_api" },
      { headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600" } });
  } catch (err) {
    if (err instanceof YouTubeFetchError) return NextResponse.json({ error: err.message, code: err.code }, { status: err.status });
    console.error("Channel fetch error:", err);
    return NextResponse.json({ error: "Failed to fetch channel data" }, { status: 500 });
  }
}
