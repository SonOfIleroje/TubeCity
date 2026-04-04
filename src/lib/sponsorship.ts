export interface NicheCPM { niche: string; min_cpm: number; max_cpm: number; avg_cpm: number; }

export const NICHE_CPM_TABLE: NicheCPM[] = [
  { niche: "finance", min_cpm: 15, max_cpm: 30, avg_cpm: 22 },
  { niche: "business", min_cpm: 12, max_cpm: 25, avg_cpm: 18 },
  { niche: "tech", min_cpm: 10, max_cpm: 22, avg_cpm: 15 },
  { niche: "ai_tools", min_cpm: 12, max_cpm: 28, avg_cpm: 20 },
  { niche: "education", min_cpm: 10, max_cpm: 20, avg_cpm: 14 },
  { niche: "health", min_cpm: 8, max_cpm: 18, avg_cpm: 12 },
  { niche: "gaming", min_cpm: 4, max_cpm: 12, avg_cpm: 7 },
  { niche: "entertainment", min_cpm: 3, max_cpm: 10, avg_cpm: 6 },
  { niche: "lifestyle", min_cpm: 6, max_cpm: 16, avg_cpm: 10 },
  { niche: "food", min_cpm: 5, max_cpm: 14, avg_cpm: 9 },
  { niche: "travel", min_cpm: 6, max_cpm: 18, avg_cpm: 11 },
  { niche: "beauty", min_cpm: 5, max_cpm: 15, avg_cpm: 9 },
  { niche: "fitness", min_cpm: 6, max_cpm: 16, avg_cpm: 10 },
  { niche: "music", min_cpm: 2, max_cpm: 8, avg_cpm: 4 },
  { niche: "kids", min_cpm: 3, max_cpm: 10, avg_cpm: 6 },
  { niche: "pets", min_cpm: 4, max_cpm: 12, avg_cpm: 7 },
  { niche: "news", min_cpm: 5, max_cpm: 15, avg_cpm: 9 },
  { niche: "science", min_cpm: 8, max_cpm: 18, avg_cpm: 12 },
  { niche: "history", min_cpm: 6, max_cpm: 14, avg_cpm: 9 },
  { niche: "other", min_cpm: 4, max_cpm: 12, avg_cpm: 7 },
];

export function getNicheCPM(niche: string): NicheCPM {
  return NICHE_CPM_TABLE.find(n => n.niche === niche.toLowerCase()) ?? NICHE_CPM_TABLE.find(n => n.niche === "other")!;
}

export interface SponsorshipEstimate {
  estimated_min: number; estimated_max: number; estimated_avg: number;
  niche_cpm: NicheCPM; avg_views_per_video: number; engagement_multiplier: number;
}

export function estimateSponsorshipValue(
  subscriber_count: number, total_view_count: number, video_count: number,
  niche: string, channel_age_years?: number, recent_uploads_30d?: number,
): SponsorshipEstimate {
  const nicheCpm = getNicheCPM(niche);
  const avg_views = video_count > 0 ? Math.round(total_view_count / video_count) : 0;
  let multiplier = 1.0;

  if (subscriber_count > 0 && avg_views > 0) {
    const ratio = avg_views / subscriber_count;
    if (ratio > 0.3) multiplier += 0.3;
    else if (ratio > 0.15) multiplier += 0.15;
    else if (ratio > 0.05) multiplier += 0.05;
  }
  if (recent_uploads_30d !== undefined) {
    if (recent_uploads_30d >= 12) multiplier += 0.2;
    else if (recent_uploads_30d >= 4) multiplier += 0.1;
    else if (recent_uploads_30d < 1) multiplier -= 0.15;
  }
  if (channel_age_years !== undefined) {
    if (channel_age_years >= 5) multiplier += 0.15;
    else if (channel_age_years >= 2) multiplier += 0.05;
  }
  if (subscriber_count >= 1_000_000) multiplier += 0.25;
  else if (subscriber_count >= 100_000) multiplier += 0.15;
  else if (subscriber_count >= 10_000) multiplier += 0.05;

  const engagement_multiplier = Math.max(0.5, Math.min(2.0, multiplier));
  const base_value = avg_views / 1000;

  return {
    estimated_min: Math.round(base_value * nicheCpm.min_cpm * engagement_multiplier),
    estimated_max: Math.round(base_value * nicheCpm.max_cpm * engagement_multiplier),
    estimated_avg: Math.round(base_value * nicheCpm.avg_cpm * engagement_multiplier),
    niche_cpm: nicheCpm, avg_views_per_video: avg_views,
    engagement_multiplier: Math.round(engagement_multiplier * 100) / 100,
  };
}

export interface DealFairness {
  offer_amount: number; estimated_avg: number;
  verdict: "great_deal" | "fair" | "below_market" | "lowball";
  percentage_of_market: number; recommendation: string;
}

export function evaluateDeal(offer_amount: number, estimate: SponsorshipEstimate): DealFairness {
  const pct = estimate.estimated_avg > 0 ? Math.round((offer_amount / estimate.estimated_avg) * 100) : 0;
  let verdict: DealFairness["verdict"];
  let recommendation: string;
  if (pct >= 120) { verdict = "great_deal"; recommendation = "This is above market rate. Take it!"; }
  else if (pct >= 80) { verdict = "fair"; recommendation = "This is within the normal market range."; }
  else if (pct >= 50) { verdict = "below_market"; recommendation = "Below market rate. Consider negotiating up."; }
  else { verdict = "lowball"; recommendation = "Significantly below market value. Counter-offer or walk away."; }
  return { offer_amount, estimated_avg: estimate.estimated_avg, verdict, percentage_of_market: pct, recommendation };
}
