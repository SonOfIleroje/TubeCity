// Shapes for the "channels" table (see supabase/migrations/079_channels_baseline.sql,
// a reverse-engineered snapshot of the real production schema) and the city layout
// derived from it.

export type District = "megacity" | "midcity" | "rising" | "newcomer";

export interface Channel {
  id: number;
  youtube_id: string;
  handle: string | null;
  channel_name: string | null;
  avatar_url: string | null;
  description: string | null;
  subscriber_count: number;
  video_count: number;
  recent_upload_count_30d: number;
  category: string | null;
  niche: string | null;
  is_verified: boolean;
}

export interface CityBuilding {
  id: number;
  position: [number, number, number];
  height: number;
  width: number;
  depth: number;
  color: string;
  district: District;
  hasRecentActivity: boolean;
  isVerified: boolean;
  niche: string;
  title: string;
  handle: string | null;
  subscriber_count: number;
  video_count: number;
}
