// Shared niche inference + coloring, used by both the live homepage (src/app/page.tsx)
// and the server-side city layout (src/lib/youtube.ts) so the two never drift apart.
//
// The vocabulary here MUST match src/lib/sponsorship.ts's NICHE_CPM_TABLE — that's the
// vocabulary already partially populated in the production `channels.niche` column
// (finance/health/fitness/food/etc), not the smaller ad-hoc set the homepage used to
// invent locally (which had "gaming"/"comedy"/"faith" — never written to the DB).
//
// YouTube's channel API only exposes a numeric snippet.categoryId (Film & Animation,
// Gaming, News & Politics, ...). That taxonomy doesn't cover most of these niches
// (no finance, business, health, food, beauty, fitness, kids, history bucket), so
// categoryId alone can never fully classify a channel. We use categoryId where it
// maps cleanly, and fall back to keyword matching against the channel name/description
// for everything else. Unclassified channels default to "other", matching what's
// already live in production rather than guessing "entertainment".

const CATEGORY_ID_NICHE: Record<string, string> = {
  "10": "music",
  "15": "pets",
  "19": "travel",
  "20": "gaming",
  "22": "lifestyle",
  "24": "entertainment",
  "25": "news",
  "26": "lifestyle",
  "27": "education",
  "28": "tech",
};

const KEYWORD_NICHE: Array<[string, string[]]> = [
  ["finance", ["financ", "invest", "money", "stock", "crypto", "trading"]],
  ["business", ["business", "entrepreneur", "startup", "marketing"]],
  ["ai_tools", ["ai tool", "artificial intelligence", "chatgpt"]],
  ["tech", ["tech", "software", "coding", "programming", "gadget"]],
  ["health", ["health", "medical", "wellness"]],
  ["fitness", ["fitness", "workout", "gym", "exercise"]],
  ["food", ["food", "cooking", "recipe", "chef", "kitchen"]],
  ["beauty", ["beauty", "makeup", "skincare"]],
  ["travel", ["travel", "destination"]],
  ["education", ["educat", "tutorial", "learn"]],
  ["science", ["scienc"]],
  ["history", ["history", "historical"]],
  ["kids", ["kids", "children", "cartoon", "toy"]],
  ["gaming", ["gaming", "gameplay"]],
  ["music", ["music"]],
  ["pets", ["pet", "animal"]],
  ["news", ["news", "politic"]],
  ["lifestyle", ["lifestyl", "vlog"]],
];

export function inferNiche(category: string | null | undefined, text?: string | null): string {
  const t = (text ?? "").toLowerCase();

  for (const [niche, keywords] of KEYWORD_NICHE) {
    if (keywords.some(k => t.includes(k))) return niche;
  }

  const byCategory = category ? CATEGORY_ID_NICHE[category] : undefined;
  if (byCategory) return byCategory;

  return "other";
}

// Distinguishable-but-still-red-branded palette: every color sits in the same
// hot red/orange/magenta family as the night-city theme, but hue and saturation
// vary enough per niche to tell districts apart at a glance.
export const NICHE_COLORS: Record<string, string> = {
  finance: "#8b1a1a",
  business: "#b33a1e",
  tech: "#c92a2a",
  ai_tools: "#a8327a",
  education: "#a61e4d",
  health: "#cc4b4b",
  gaming: "#ff6b35",
  entertainment: "#e8590c",
  lifestyle: "#e64980",
  food: "#d9480f",
  travel: "#e0446b",
  beauty: "#d6336c",
  fitness: "#ff5252",
  music: "#c2255c",
  kids: "#ff8787",
  pets: "#f08c00",
  news: "#862e2e",
  science: "#b9541a",
  history: "#7a3b2e",
  other: "#cc2200",
};

export function nicheColor(niche: string): string {
  return NICHE_COLORS[niche] ?? NICHE_COLORS.other;
}
