import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { generateCityLayout } from "@/lib/youtube";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET() {
  try {
    // Fetch ALL channels from your table
    const { data: channels, error } = await supabase
      .from("youtube_channels")
      .select("*")
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
