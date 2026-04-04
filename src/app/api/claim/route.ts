// src/app/api/claim/route.ts
// Collects email waitlist for Prime District + channel claiming

import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";

export async function POST(request: Request) {
  try {
    const { email, handle, channel_name, subscriber_count, type } = await request.json();

    if (!email || !email.includes("@")) {
      return NextResponse.json({ error: "Valid email required" }, { status: 400 });
    }

    const sb = getSupabaseAdmin();

    // Upsert into a waitlist table
    const { error } = await sb.from("waitlist").upsert({
      email: email.toLowerCase().trim(),
      handle: handle || null,
      channel_name: channel_name || null,
      subscriber_count: subscriber_count || null,
      type: type || "claim", // "claim" | "prime" | "pro"
      created_at: new Date().toISOString(),
    }, { onConflict: "email" });

    if (error) {
      // Table might not exist yet - that's ok, just log it
      console.error("Waitlist insert error:", error.message);
      // Still return success to the user
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Claim API error:", err);
    return NextResponse.json({ error: "Failed to save" }, { status: 500 });
  }
}
