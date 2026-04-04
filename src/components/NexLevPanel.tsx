"use client";
import { useState, useMemo } from "react";

// ─── TYPES ───────────────────────────────────────────────────
interface Channel {
  handle: string;
  channel_name: string | null;
  subscriber_count: number;
  video_count: number;
  recent_upload_count_30d: number;
  category: string | null;
  is_verified: boolean;
  niche: string;
  litPct: number;
  districtId: string;
  total_view_count?: number;
}

interface Props {
  channels: Channel[];
  onSelectChannel: (handle: string) => void;
  onClose: () => void;
}

// ─── CPM / RPM TABLE (realistic 2026 YouTube data) ───────────
const NICHE_RPM: Record<string, { rpm: number; cpm: number; competition: "Low"|"Medium"|"High"; automation: boolean }> = {
  finance:       { rpm: 12, cpm: 22, competition: "Medium", automation: true },
  tech:          { rpm: 8,  cpm: 15, competition: "High",   automation: true },
  education:     { rpm: 7,  cpm: 14, competition: "Low",    automation: true },
  science:       { rpm: 7,  cpm: 13, competition: "Low",    automation: true },
  entertainment: { rpm: 3,  cpm: 8,  competition: "High",   automation: true },
  gaming:        { rpm: 2,  cpm: 6,  competition: "High",   automation: false },
  music:         { rpm: 2,  cpm: 5,  competition: "High",   automation: false },
  lifestyle:     { rpm: 4,  cpm: 10, competition: "Medium", automation: true },
  news:          { rpm: 5,  cpm: 11, competition: "Medium", automation: true },
  comedy:        { rpm: 3,  cpm: 7,  competition: "Medium", automation: false },
  pets:          { rpm: 3,  cpm: 8,  competition: "Low",    automation: true },
  faith:         { rpm: 4,  cpm: 9,  competition: "Low",    automation: true },
};

function fmt(n: number): string {
  if (n >= 1e9) return (n / 1e9).toFixed(1) + "B";
  if (n >= 1e6) return (n / 1e6).toFixed(1) + "M";
  if (n >= 1e3) return (n / 1e3).toFixed(1) + "K";
  return String(n);
}

function getOutlierScore(ch: Channel): number {
  const subs = ch.subscriber_count || 1;
  const uploads = ch.recent_upload_count_30d || 0;
  // Outlier = high activity relative to sub count
  // A channel with 5K subs uploading 20x/month is a bigger outlier than 1M subs uploading 5x
  const activityRatio = (uploads * 4) / Math.log10(Math.max(subs, 100));
  return Math.round(activityRatio * 10) / 10;
}

function getMonthlyRevenueEst(ch: Channel): { low: number; high: number } {
  const subs = ch.subscriber_count || 0;
  const uploads = ch.recent_upload_count_30d || 0;
  const rpm = NICHE_RPM[ch.niche]?.rpm || 3;
  // Estimate: avg 4% view rate, each video gets ~30 days of views
  const avgViewsPerVideo = subs * 0.04;
  const monthlyViews = avgViewsPerVideo * uploads;
  return {
    low: Math.round(monthlyViews * (rpm * 0.7) / 1000),
    high: Math.round(monthlyViews * rpm / 1000),
  };
}

// ─── TABS ────────────────────────────────────────────────────
type Tab = "outliers" | "niches" | "faceless" | "empire";

const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: "outliers", label: "Outlier Finder",    icon: "🚀" },
  { id: "niches",   label: "Niche Intel",       icon: "📊" },
  { id: "faceless", label: "Faceless Niches",   icon: "🎭" },
  { id: "empire",   label: "Empire Stats",      icon: "🏛️" },
];

export default function NexLevPanel({ channels, onSelectChannel, onClose }: Props) {
  const [tab, setTab] = useState<Tab>("outliers");
  const [nicheFilter, setNicheFilter] = useState("all");

  // ── OUTLIER CHANNELS: small subs, high activity ──
  const outliers = useMemo(() => {
    return channels
      .map(ch => ({ ...ch, outlierScore: getOutlierScore(ch) }))
      .filter(ch => ch.outlierScore > 2 && ch.subscriber_count < 5_000_000)
      .sort((a, b) => b.outlierScore - a.outlierScore)
      .slice(0, 20);
  }, [channels]);

  // ── NICHE INTEL ──
  const nicheStats = useMemo(() => {
    const map: Record<string, { channels: Channel[]; totalUploads: number }> = {};
    for (const ch of channels) {
      const n = ch.niche || "entertainment";
      if (!map[n]) map[n] = { channels: [], totalUploads: 0 };
      map[n].channels.push(ch);
      map[n].totalUploads += ch.recent_upload_count_30d || 0;
    }
    return Object.entries(map).map(([niche, d]) => {
      const rpm = NICHE_RPM[niche] || NICHE_RPM.entertainment;
      const avgSubs = d.channels.reduce((s, c) => s + c.subscriber_count, 0) / d.channels.length;
      const momentum = d.totalUploads / d.channels.length;
      return { niche, ...rpm, channelCount: d.channels.length, avgSubs, momentum, channels: d.channels };
    }).sort((a, b) => {
      // Score = RPM * momentum / competition penalty
      const compPenalty = { Low: 1, Medium: 1.5, High: 2.5 };
      const scoreA = (a.rpm * a.momentum) / compPenalty[a.competition];
      const scoreB = (b.rpm * b.momentum) / compPenalty[b.competition];
      return scoreB - scoreA;
    });
  }, [channels]);

  // ── FACELESS-FRIENDLY NICHES ──
  const facelessNiches = useMemo(() => {
    return nicheStats.filter(n => n.automation);
  }, [nicheStats]);

  // ── EMPIRE STATS ──
  const empireStats = useMemo(() => {
    const totalSubs = channels.reduce((s, c) => s + c.subscriber_count, 0);
    const totalUploads = channels.reduce((s, c) => s + c.recent_upload_count_30d, 0);
    const activeChannels = channels.filter(c => c.recent_upload_count_30d > 0).length;
    const verifiedChannels = channels.filter(c => c.is_verified).length;
    const topNiche = nicheStats[0]?.niche || "?";
    const totalMonthlyRevEst = channels.reduce((s, c) => {
      const est = getMonthlyRevenueEst(c);
      return s + est.high;
    }, 0);
    return { totalSubs, totalUploads, activeChannels, verifiedChannels, topNiche, totalMonthlyRevEst, totalChannels: channels.length };
  }, [channels, nicheStats]);

  const COMP_COLOR: Record<string, string> = { Low: "#44ff88", Medium: "#ffaa00", High: "#ff4444" };
  const NICHE_EMOJI: Record<string, string> = {
    finance:"💰",tech:"💻",gaming:"🎮",education:"📚",entertainment:"🎬",
    music:"🎵",lifestyle:"✨",science:"🔬",news:"📰",comedy:"😂",pets:"🐾",faith:"✝️",
  };

  return (
    <div style={{ position:"fixed",inset:0,background:"rgba(0,0,0,0.85)",zIndex:80,display:"flex",alignItems:"center",justifyContent:"center",backdropFilter:"blur(8px)" }}>
      <div style={{ background:"rgba(2,0,0,0.99)",border:"1px solid #553300",borderRadius:16,width:"min(960px,96vw)",maxHeight:"90vh",display:"flex",flexDirection:"column",boxShadow:"0 0 100px rgba(255,100,0,0.2)",fontFamily:"'Courier New',monospace",overflow:"hidden" }}>

        {/* ── HEADER ── */}
        <div style={{ padding:"18px 26px",borderBottom:"1px solid #2a0000",display:"flex",alignItems:"center",justifyContent:"space-between",flexShrink:0,background:"rgba(15,3,0,0.8)" }}>
          <div>
            <div style={{ fontSize:9,color:"#ff8800",letterSpacing:5,marginBottom:4 }}>⚡ TUBECITY · TUBEFINDER</div>
            <div style={{ fontSize:22,fontWeight:900,color:"white",letterSpacing:1 }}>Tube<span style={{ color:"#ff4400" }}>Finder</span></div>
            <div style={{ fontSize:11,color:"#aaaaaa",marginTop:2 }}>The NexLev alternative — find outlier channels, winning niches & faceless opportunities</div>
          </div>
          <button onClick={onClose} style={{ background:"none",border:"1px solid #440000",color:"#cc4444",padding:"7px 16px",borderRadius:8,cursor:"pointer",fontSize:12,letterSpacing:1 }}>✕ CLOSE</button>
        </div>

        {/* ── TABS ── */}
        <div style={{ display:"flex",borderBottom:"1px solid #1a0000",flexShrink:0,background:"rgba(8,0,0,0.6)" }}>
          {TABS.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              style={{ flex:1,padding:"12px 8px",border:"none",borderBottom:tab===t.id?"2px solid #ff4400":"2px solid transparent",background:"transparent",color:tab===t.id?"#ff6644":"#aaaaaa",cursor:"pointer",fontFamily:"'Courier New',monospace",fontSize:11,letterSpacing:1,transition:"all 0.15s" }}>
              {t.icon} {t.label.toUpperCase()}
            </button>
          ))}
        </div>

        {/* ── CONTENT ── */}
        <div style={{ flex:1,overflowY:"auto",padding:"16px 20px 24px" }}>

          {/* OUTLIER FINDER */}
          {tab === "outliers" && (
            <div>
              <div style={{ marginBottom:16,padding:"12px 16px",background:"rgba(255,68,0,0.08)",borderRadius:10,border:"1px solid #331100",fontSize:12,color:"#ffcc88",lineHeight:1.7 }}>
                <strong style={{ color:"#ff6644" }}>🚀 Outlier Channels</strong> — These channels are uploading frequently relative to their size.
                Small subs + high upload rate = potential <strong style={{ color:"#ffaa00" }}>breakout niche</strong>. Watch these.
              </div>
              <div style={{ display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(260px,1fr))",gap:10 }}>
                {outliers.map(ch => {
                  const rev = getMonthlyRevenueEst(ch);
                  const rpm = NICHE_RPM[ch.niche] || NICHE_RPM.entertainment;
                  return (
                    <div key={ch.handle}
                      onClick={() => { onSelectChannel(ch.handle); onClose(); }}
                      style={{ background:"rgba(10,2,0,0.9)",border:"1px solid #331100",borderRadius:10,padding:"14px 16px",cursor:"pointer",transition:"all 0.15s" }}
                      onMouseEnter={e => (e.currentTarget as HTMLDivElement).style.borderColor="#ff4400"}
                      onMouseLeave={e => (e.currentTarget as HTMLDivElement).style.borderColor="#331100"}>
                      
                      {/* Outlier score badge */}
                      <div style={{ display:"flex",alignItems:"flex-start",justifyContent:"space-between",marginBottom:10 }}>
                        <div>
                          <div style={{ fontSize:13,fontWeight:700,color:"white",marginBottom:2 }}>{ch.channel_name || ch.handle}</div>
                          <div style={{ fontSize:10,color:"#ffcc66" }}>@{ch.handle}</div>
                        </div>
                        <div style={{ background:"rgba(255,68,0,0.2)",border:"1px solid #ff4400",borderRadius:8,padding:"4px 10px",textAlign:"center" }}>
                          <div style={{ fontSize:16,fontWeight:900,color:"#ff6644" }}>{ch.outlierScore}x</div>
                          <div style={{ fontSize:7,color:"#884422",letterSpacing:1 }}>OUTLIER</div>
                        </div>
                      </div>

                      <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:6,marginBottom:10 }}>
                        {[
                          ["SUBS", fmt(ch.subscriber_count)],
                          ["UPLOADS/MO", String(ch.recent_upload_count_30d || 0)],
                          ["NICHE", (ch.niche || "?").toUpperCase()],
                          ["RPM EST", `$${rpm.rpm}`],
                        ].map(([l, v]) => (
                          <div key={l} style={{ background:"rgba(150,0,0,0.09)",padding:"5px 8px",borderRadius:6,border:"1px solid #180000" }}>
                            <div style={{ fontSize:7,color:"#ff8844",letterSpacing:2 }}>{l}</div>
                            <div style={{ fontSize:12,fontWeight:700,color:"#ffffff" }}>{v}</div>
                          </div>
                        ))}
                      </div>

                      <div style={{ borderTop:"1px solid #1a0000",paddingTop:8,display:"flex",justifyContent:"space-between",alignItems:"center" }}>
                        <div>
                          <div style={{ fontSize:7,color:"#ff8844",letterSpacing:2,marginBottom:1 }}>EST MONTHLY REVENUE</div>
                          <div style={{ fontSize:14,fontWeight:900,color:"#ff3333" }}>${fmt(rev.low)} – ${fmt(rev.high)}</div>
                        </div>
                        <div style={{ fontSize:9,background:COMP_COLOR[rpm.competition]+"22",color:COMP_COLOR[rpm.competition],padding:"3px 8px",borderRadius:8,border:`1px solid ${COMP_COLOR[rpm.competition]}44` }}>
                          {rpm.competition.toUpperCase()} COMP
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* NICHE INTEL */}
          {tab === "niches" && (
            <div>
              <div style={{ marginBottom:16,padding:"12px 16px",background:"rgba(255,200,0,0.06)",borderRadius:10,border:"1px solid #332200",fontSize:12,color:"#ffcc88",lineHeight:1.7 }}>
                <strong style={{ color:"#ffcc44" }}>📊 Niche Intelligence</strong> — Ranked by <strong>Opportunity Score</strong> = RPM × momentum ÷ competition.
                Green competition = easier to rank. Higher RPM = more ad money per 1000 views.
              </div>
              {nicheStats.map((n, i) => {
                const maxMomentum = Math.max(...nicheStats.map(x => x.momentum), 1);
                const barW = Math.round((n.momentum / maxMomentum) * 100);
                return (
                  <div key={n.niche} style={{ background:"rgba(8,0,0,0.85)",border:`1px solid ${i<3?"#443300":"#1a0000"}`,borderRadius:10,padding:"14px 18px",marginBottom:8,display:"flex",gap:16,alignItems:"center" }}>
                    <div style={{ fontSize:28,width:40,textAlign:"center",flexShrink:0 }}>{NICHE_EMOJI[n.niche] || "📺"}</div>
                    <div style={{ flex:1,minWidth:0 }}>
                      <div style={{ display:"flex",alignItems:"center",gap:8,marginBottom:6 }}>
                        <span style={{ fontSize:14,fontWeight:900,color:"white",textTransform:"uppercase",letterSpacing:1 }}>{n.niche}</span>
                        {i < 3 && <span style={{ fontSize:9,background:"#664400",color:"#ffaa00",padding:"2px 8px",borderRadius:8,letterSpacing:2 }}>🔥 TOP PICK</span>}
                        {n.automation && <span style={{ fontSize:9,background:"rgba(0,150,100,0.2)",color:"#44cc88",padding:"2px 8px",borderRadius:8,letterSpacing:2,border:"1px solid #114422" }}>🎭 FACELESS OK</span>}
                      </div>
                      <div style={{ height:5,background:"#1a0000",borderRadius:3,overflow:"hidden",marginBottom:8 }}>
                        <div style={{ height:"100%",width:`${barW}%`,background:i<3?"linear-gradient(to right,#ff4400,#ffaa00)":"#cc2200",borderRadius:3 }}/>
                      </div>
                      <div style={{ display:"flex",gap:14,flexWrap:"wrap",fontSize:10 }}>
                        <span style={{ color:"#ffffff" }}>{n.channelCount} channels tracked</span>
                        <span style={{ color:"#bbbbbb" }}>{(n.avgSubs/1000).toFixed(0)}K avg subs</span>
                        <span style={{ color:"#ffaa44" }}>{n.momentum.toFixed(1)} uploads/mo avg</span>
                      </div>
                    </div>
                    <div style={{ display:"flex",gap:10,flexShrink:0 }}>
                      <div style={{ textAlign:"center",background:"rgba(150,0,0,0.1)",padding:"8px 14px",borderRadius:8,border:"1px solid #220000" }}>
                        <div style={{ fontSize:7,color:"#ff8844",letterSpacing:2,marginBottom:3 }}>RPM</div>
                        <div style={{ fontSize:18,fontWeight:900,color:"#ff3333" }}>${n.rpm}</div>
                      </div>
                      <div style={{ textAlign:"center",background:"rgba(150,0,0,0.1)",padding:"8px 14px",borderRadius:8,border:`1px solid ${COMP_COLOR[n.competition]}33` }}>
                        <div style={{ fontSize:7,color:"#ff8844",letterSpacing:2,marginBottom:3 }}>COMP</div>
                        <div style={{ fontSize:12,fontWeight:700,color:COMP_COLOR[n.competition] }}>{n.competition}</div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* FACELESS NICHES */}
          {tab === "faceless" && (
            <div>
              <div style={{ marginBottom:16,padding:"12px 16px",background:"rgba(0,150,100,0.06)",borderRadius:10,border:"1px solid #114422",fontSize:12,color:"#55ffaa",lineHeight:1.7 }}>
                <strong style={{ color:"#44ff88" }}>🎭 Faceless-Friendly Niches</strong> — These niches can be fully automated with AI voiceover,
                stock footage, and scheduled uploads. No face. No camera. Just systems.
                Sorted by <strong>RPM × low competition</strong>.
              </div>
              <div style={{ display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(280px,1fr))",gap:12 }}>
                {facelessNiches.map((n, i) => (
                  <div key={n.niche} style={{ background:"rgba(8,0,0,0.9)",border:`1px solid ${i<2?"#224433":"#1a0000"}`,borderRadius:12,padding:"18px 20px" }}>
                    <div style={{ display:"flex",alignItems:"center",gap:12,marginBottom:14 }}>
                      <div style={{ fontSize:32 }}>{NICHE_EMOJI[n.niche] || "📺"}</div>
                      <div>
                        <div style={{ fontSize:15,fontWeight:900,color:"white",textTransform:"uppercase",letterSpacing:2 }}>{n.niche}</div>
                        <div style={{ fontSize:10,color:COMP_COLOR[n.competition] }}>{n.competition} Competition</div>
                      </div>
                    </div>
                    <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:12 }}>
                      {[
                        ["RPM", `$${n.rpm}`],
                        ["CPM", `$${n.cpm}`],
                        ["CHANNELS", String(n.channelCount)],
                        ["AVG MOMENTUM", `${n.momentum.toFixed(1)}x`],
                      ].map(([l, v]) => (
                        <div key={l} style={{ background:"rgba(0,80,40,0.12)",padding:"7px 10px",borderRadius:8,border:"1px solid #112211" }}>
                          <div style={{ fontSize:7,color:"#336633",letterSpacing:2 }}>{l}</div>
                          <div style={{ fontSize:14,fontWeight:700,color:"#ffffff" }}>{v}</div>
                        </div>
                      ))}
                    </div>
                    <div style={{ background:"rgba(0,150,80,0.08)",padding:"10px 12px",borderRadius:8,border:"1px solid #113322",fontSize:11,color:"#88ffaa",lineHeight:1.6 }}>
                      💡 {n.niche === "finance" ? "Money, investing, budgeting — evergreen content, highest RPM" :
                          n.niche === "education" ? "Explainers, history, how-to — easy AI voiceover scripts" :
                          n.niche === "science" ? "Discoveries, space, biology — stock footage heaven" :
                          n.niche === "news" ? "Summaries, analysis — high volume, consistent views" :
                          n.niche === "lifestyle" ? "Motivation, productivity — massive audience" :
                          n.niche === "pets" ? "Animal facts, funny clips — compilations work great" :
                          n.niche === "faith" ? "Devotionals, stories — loyal audience, low competition" :
                          "Strong automation potential with AI tools"}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* EMPIRE STATS */}
          {tab === "empire" && (
            <div>
              <div style={{ marginBottom:20,padding:"12px 16px",background:"rgba(255,200,0,0.05)",borderRadius:10,border:"1px solid #332200",fontSize:12,color:"#ffcc88",lineHeight:1.7 }}>
                <strong style={{ color:"#ffd700" }}>🏛️ Empire Overview</strong> — Aggregate view of all {empireStats.totalChannels} channels tracked in TubeCity.
              </div>
              <div style={{ display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(200px,1fr))",gap:12,marginBottom:24 }}>
                {[
                  ["TOTAL CHANNELS", String(empireStats.totalChannels), "#ff4444"],
                  ["TOTAL SUBSCRIBERS", fmt(empireStats.totalSubs), "#ff6644"],
                  ["ACTIVE THIS MONTH", String(empireStats.activeChannels), "#ffaa00"],
                  ["VERIFIED CHANNELS", String(empireStats.verifiedChannels), "#ffd700"],
                  ["TOP NICHE", empireStats.topNiche.toUpperCase(), "#44cc88"],
                  ["TOTAL REV EST/MO", `$${fmt(empireStats.totalMonthlyRevEst)}`, "#ff3333"],
                ].map(([l, v, color]: [string,string,string]) => (
                  <div key={l} style={{ background:"rgba(10,2,0,0.9)",border:"1px solid #220000",borderRadius:12,padding:"18px 20px",textAlign:"center" }}>
                    <div style={{ fontSize:8,color:"#ff8844",letterSpacing:3,marginBottom:8 }}>{l}</div>
                    <div style={{ fontSize:22,fontWeight:900,color }}>{v}</div>
                  </div>
                ))}
              </div>
              <div style={{ padding:"16px 20px",background:"rgba(255,68,0,0.06)",borderRadius:12,border:"1px solid #331100" }}>
                <div style={{ fontSize:11,color:"#ff8844",letterSpacing:2,marginBottom:12 }}>📈 NICHE BREAKDOWN</div>
                {nicheStats.map(n => {
                  const pct = empireStats.totalChannels > 0 ? Math.round((n.channelCount / empireStats.totalChannels) * 100) : 0;
                  return (
                    <div key={n.niche} style={{ display:"flex",alignItems:"center",gap:10,marginBottom:8 }}>
                      <div style={{ width:24,textAlign:"center",fontSize:14 }}>{NICHE_EMOJI[n.niche]||"📺"}</div>
                      <div style={{ width:80,fontSize:10,color:"#bbbbbb",textTransform:"uppercase" }}>{n.niche}</div>
                      <div style={{ flex:1,height:6,background:"#1a0000",borderRadius:3,overflow:"hidden" }}>
                        <div style={{ height:"100%",width:`${pct}%`,background:"#cc2200",borderRadius:3 }}/>
                      </div>
                      <div style={{ width:30,textAlign:"right",fontSize:10,color:"#ffffff" }}>{pct}%</div>
                      <div style={{ width:40,textAlign:"right",fontSize:10,color:"#999999" }}>{n.channelCount}</div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* ── FOOTER ── */}
        <div style={{ padding:"12px 26px",borderTop:"1px solid #1a0000",background:"rgba(10,3,0,0.7)",flexShrink:0,display:"flex",alignItems:"center",justifyContent:"space-between" }}>
          <div style={{ fontSize:11,color:"#cc7700" }}>
            ⚡ TubeFinder Pro — live data, outlier alerts & CSV export — <span style={{ color:"#ff6600",fontWeight:700 }}>coming soon · $29/month</span>
          </div>
          <div style={{ fontSize:9,color:"#777777",letterSpacing:2 }}>TUBEFINDER</div>
        </div>
      </div>
    </div>
  );
}
