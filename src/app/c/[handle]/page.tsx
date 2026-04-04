// src/app/c/[handle]/page.tsx
// Shareable URL: tubecity.io/c/MrBeast
// Loads the city and flies directly to that channel's building

import { Metadata } from "next";
import { redirect } from "next/navigation";

interface Props {
  params: { handle: string };
}

// Generate OG meta tags for social sharing
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const handle = decodeURIComponent(params.handle).replace(/^@/, "");
  
  // Fetch channel data for OG tags
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "https://tubecity.io";
  
  try {
    const res = await fetch(`${baseUrl}/api/channel?handle=${handle}`, {
      next: { revalidate: 3600 }
    });
    const data = await res.json();
    const ch = data.channel;
    
    if (ch) {
      const subs = ch.subscriber_count >= 1e6
        ? (ch.subscriber_count / 1e6).toFixed(1) + "M"
        : ch.subscriber_count >= 1e3
        ? (ch.subscriber_count / 1e3).toFixed(1) + "K"
        : String(ch.subscriber_count);

      return {
        title: `${ch.channel_name || handle} — TubeCity`,
        description: `@${handle} has ${subs} subscribers. See their skyscraper in TubeCity — the world's first 3D YouTube channel city.`,
        openGraph: {
          title: `${ch.channel_name || handle}'s Building in TubeCity`,
          description: `${subs} subscribers · ${ch.video_count || 0} videos · Find them in the city`,
          images: ch.avatar_url ? [{ url: ch.avatar_url, width: 800, height: 800 }] : [],
          type: "website",
          url: `${baseUrl}/c/${handle}`,
        },
        twitter: {
          card: "summary",
          title: `${ch.channel_name || handle} is in TubeCity 🏙️`,
          description: `${subs} subs · Their skyscraper is waiting. Explore the 3D YouTube city.`,
          images: ch.avatar_url ? [ch.avatar_url] : [],
        },
      };
    }
  } catch {}

  return {
    title: `${handle} — TubeCity`,
    description: `Find @${handle}'s skyscraper in TubeCity — the world's first 3D YouTube channel city.`,
  };
}

export default function ChannelPage({ params }: Props) {
  const handle = decodeURIComponent(params.handle).replace(/^@/, "");
  // Redirect to home with the handle as a query param
  // The home page will auto-search and fly to the building
  redirect(`/?channel=${handle}`);
}
