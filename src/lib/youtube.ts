import { Channel, CityBuilding, District } from "@/types";

export function generateCityLayout(channels: Channel[]): CityBuilding[] {
  if (!channels.length) return [];

  // Sort by subscribers descending
  const sorted = [...channels].sort((a,b) => b.subscriber_count - a.subscriber_count);
  const total = sorted.length;

  // District assignment by percentile (not fixed numbers)
  const getDistrict = (index: number): District => {
    const pct = index / total;
    if (pct < 0.05) return "megacity";
    if (pct < 0.20) return "midcity";
    if (pct < 0.50) return "rising";
    return "newcomer";
  };

  // Position mapping (grid with gaps for roads)
  const buildings: CityBuilding[] = [];
  let idx = 0;
  for (const ch of sorted) {
    const district = getDistrict(idx);
    let x: number, z: number;
    const spacing = 4.2;
    const roadEvery = 5; // every 5 buildings, a road gap

    switch (district) {
      case "megacity":
        // central area: -20 to +20 on X, -20 to +20 on Z
        x = (idx % 10) * spacing - 45;
        z = Math.floor(idx / 10) * spacing - 20;
        break;
      case "midcity":
        x = (idx % 12) * spacing - 66;
        z = Math.floor(idx / 12) * spacing + 15;
        break;
      case "rising":
        x = (idx % 14) * spacing - 91;
        z = Math.floor(idx / 14) * spacing + 50;
        break;
      default:
        x = (idx % 16) * spacing - 126;
        z = Math.floor(idx / 16) * spacing + 90;
    }

    // Add road gaps
    const col = Math.floor((x + 200) / spacing);
    const row = Math.floor((z + 200) / spacing);
    if (col % roadEvery === 0) x += spacing * 0.6;
    if (row % roadEvery === 0) z += spacing * 0.6;

    buildings.push({
      id: ch.id,
      position: [x, 0, z],
      height: Math.max(1.5, Math.min(18, 1.5 + Math.log10(ch.subscriber_count + 1) * 2.5)),
      width: Math.max(0.8, Math.min(2.5, 0.8 + Math.log10(ch.video_count + 1) * 0.6)),
      depth: Math.max(0.8, Math.min(2.5, 0.8 + Math.log10(ch.video_count + 1) * 0.6)),
      color: nicheColor(ch.niche),
      district,
      hasRecentActivity: ch.last_upload_date ? (Date.now() - new Date(ch.last_upload_date).getTime()) < 30*24*60*60*1000 : false,
      isVerified: ch.subscriber_count > 1000000,
      niche: ch.niche,
      title: ch.title,
      handle: ch.handle,
      subscriber_count: ch.subscriber_count,
      video_count: ch.video_count,
    });
    idx++;
  }
  return buildings;
}

function nicheColor(niche: string): string {
  const n = (niche || "").toLowerCase();
  if (n.includes("finance")) return "#c0392b";
  if (n.includes("tech")) return "#e74c3c";
  if (n.includes("gaming")) return "#ff6b6b";
  if (n.includes("education")) return "#c0392b";
  if (n.includes("music")) return "#e74c3c";
  if (n.includes("entertainment")) return "#ff4757";
  if (n.includes("science")) return "#ff6348";
  return "#e53935";
}
