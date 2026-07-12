import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { generateCityLayout } from "@/lib/youtube";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET() {
  try {
    // Fetch ALL channels from the real cache table (see src/app/api/channel/route.ts,
    // which is what actually writes rows here). This used to point at "youtube_channels",
    // a separate 10-row table nothing in the app writes to — "channels" is the live,
    // actively-written table with 146+ rows.
    const { data: channels, error } = await supabase
      .from("channels")
      .select("id, youtube_id, handle, channel_name, avatar_url, description, subscriber_count, video_count, recent_upload_count_30d, category, niche, is_verified")
      .order("subscriber_count", { ascending: false });

    if (error) throw error;

    // Generate city layout using your YouTube engine
    const buildings = generateCityLayout(channels || []);

    return NextResponse.json({ buildings, totalChannels: channels?.length || 0 });
  } catch (err: any) {
    console.error("API error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
