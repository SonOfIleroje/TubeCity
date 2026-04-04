// ─── YouTube Data API v3 ─────────────────────────────────────
export const FETCH_TIMEOUT_MS = 15_000;
const YOUTUBE_API_BASE = "https://www.googleapis.com/youtube/v3";

function ytKey(): string {
  const key = process.env.YOUTUBE_API_KEY;
  if (!key) throw new Error("YOUTUBE_API_KEY is not set");
  return key;
}

export interface YouTubeChannelData {
  youtube_id: string;
  handle: string | null;
  channel_name: string;
  avatar_url: string | null;
  banner_url: string | null;
  description: string | null;
  subscriber_count: number;
  video_count: number;
  total_view_count: number;
  uploads_playlist_id: string | null;
  category: string | null;
  is_verified: boolean;
  published_at: string | null;
  country: string | null;
}

export interface RecentUpload {
  video_id: string;
  title: string;
  published_at: string;
  thumbnail_url: string | null;
}

export interface ChannelWithUploads {
  channel: YouTubeChannelData;
  recent_uploads: RecentUpload[];
}

export class YouTubeFetchError extends Error {
  code: "not_found" | "quota_exceeded" | "invalid_key" | "api_error";
  status: number;
  constructor(code: YouTubeFetchError["code"], message: string, status: number) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

export async function fetchChannelByHandle(handle: string): Promise<YouTubeChannelData> {
  const cleanHandle = handle.startsWith("@") ? handle.slice(1) : handle;
  const url = `${YOUTUBE_API_BASE}/channels?part=statistics,snippet,contentDetails,brandingSettings&forHandle=${encodeURIComponent(cleanHandle)}&key=${ytKey()}`;
  const res = await fetch(url, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });

  if (!res.ok) {
    if (res.status === 403) {
      const body = await res.json().catch(() => null);
      const reason = body?.error?.errors?.[0]?.reason;
      if (reason === "quotaExceeded") throw new YouTubeFetchError("quota_exceeded", "YouTube API daily quota exceeded.", 429);
      throw new YouTubeFetchError("invalid_key", "YouTube API key is invalid or restricted.", 403);
    }
    throw new YouTubeFetchError("api_error", `YouTube API error (${res.status})`, res.status);
  }

  const data = await res.json();
  if (!data.items || data.items.length === 0) throw new YouTubeFetchError("not_found", `Channel @${cleanHandle} not found.`, 404);

  const item = data.items[0];
  const snippet = item.snippet ?? {};
  const stats = item.statistics ?? {};
  const contentDetails = item.contentDetails ?? {};
  const branding = item.brandingSettings ?? {};

  return {
    youtube_id: item.id,
    handle: snippet.customUrl ?? `@${cleanHandle}`,
    channel_name: snippet.title ?? cleanHandle,
    avatar_url: snippet.thumbnails?.high?.url ?? snippet.thumbnails?.default?.url ?? null,
    banner_url: branding.image?.bannerExternalUrl ?? null,
    description: snippet.description ?? null,
    subscriber_count: parseInt(stats.subscriberCount ?? "0", 10),
    video_count: parseInt(stats.videoCount ?? "0", 10),
    total_view_count: parseInt(stats.viewCount ?? "0", 10),
    uploads_playlist_id: contentDetails.relatedPlaylists?.uploads ?? null,
    category: snippet.categoryId ?? null,
    is_verified: false,
    published_at: snippet.publishedAt ?? null,
    country: snippet.country ?? null,
  };
}

export async function fetchChannelById(channelId: string): Promise<YouTubeChannelData> {
  const url = `${YOUTUBE_API_BASE}/channels?part=statistics,snippet,contentDetails,brandingSettings&id=${encodeURIComponent(channelId)}&key=${ytKey()}`;
  const res = await fetch(url, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
  if (!res.ok) {
    if (res.status === 403) throw new YouTubeFetchError("quota_exceeded", "YouTube API daily quota exceeded.", 429);
    throw new YouTubeFetchError("api_error", `YouTube API error (${res.status})`, res.status);
  }
  const data = await res.json();
  if (!data.items || data.items.length === 0) throw new YouTubeFetchError("not_found", `Channel ${channelId} not found.`, 404);

  const item = data.items[0];
  const snippet = item.snippet ?? {};
  const stats = item.statistics ?? {};
  const contentDetails = item.contentDetails ?? {};
  const branding = item.brandingSettings ?? {};

  return {
    youtube_id: item.id, handle: snippet.customUrl ?? null, channel_name: snippet.title ?? "Unknown",
    avatar_url: snippet.thumbnails?.high?.url ?? null, banner_url: branding.image?.bannerExternalUrl ?? null,
    description: snippet.description ?? null, subscriber_count: parseInt(stats.subscriberCount ?? "0", 10),
    video_count: parseInt(stats.videoCount ?? "0", 10), total_view_count: parseInt(stats.viewCount ?? "0", 10),
    uploads_playlist_id: contentDetails.relatedPlaylists?.uploads ?? null, category: snippet.categoryId ?? null,
    is_verified: false, published_at: snippet.publishedAt ?? null, country: snippet.country ?? null,
  };
}

export async function fetchRecentUploads(uploadsPlaylistId: string, maxResults: number = 20): Promise<RecentUpload[]> {
  const url = `${YOUTUBE_API_BASE}/playlistItems?part=snippet,contentDetails&playlistId=${encodeURIComponent(uploadsPlaylistId)}&maxResults=${maxResults}&key=${ytKey()}`;
  const res = await fetch(url, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
  if (!res.ok) return [];
  const data = await res.json();
  return (data.items ?? []).map((item: Record<string, unknown>) => {
    const snippet = item.snippet as Record<string, unknown> ?? {};
    const thumbnails = snippet.thumbnails as Record<string, Record<string, unknown>> ?? {};
    return {
      video_id: (item.contentDetails as Record<string, unknown>)?.videoId ?? (snippet.resourceId as Record<string, unknown>)?.videoId ?? "",
      title: (snippet.title as string) ?? "",
      published_at: (snippet.publishedAt as string) ?? "",
      thumbnail_url: thumbnails.high?.url ?? thumbnails.default?.url ?? null,
    };
  });
}

export async function searchChannels(query: string, maxResults: number = 5): Promise<Array<{ youtube_id: string; channel_name: string; avatar_url: string | null; description: string | null }>> {
  const url = `${YOUTUBE_API_BASE}/search?part=snippet&q=${encodeURIComponent(query)}&type=channel&maxResults=${maxResults}&key=${ytKey()}`;
  const res = await fetch(url, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
  if (!res.ok) return [];
  const data = await res.json();
  return (data.items ?? []).map((item: Record<string, unknown>) => {
    const snippet = item.snippet as Record<string, unknown> ?? {};
    const thumbnails = snippet.thumbnails as Record<string, Record<string, unknown>> ?? {};
    return {
      youtube_id: (item.id as Record<string, unknown>)?.channelId ?? "",
      channel_name: (snippet.title as string) ?? "",
      avatar_url: thumbnails.high?.url ?? null,
      description: (snippet.description as string) ?? null,
    };
  });
}

export async function fetchFullChannelData(handle: string): Promise<ChannelWithUploads> {
  const channel = await fetchChannelByHandle(handle);
  let recent_uploads: RecentUpload[] = [];
  if (channel.uploads_playlist_id) recent_uploads = await fetchRecentUploads(channel.uploads_playlist_id);
  return { channel, recent_uploads };
}
