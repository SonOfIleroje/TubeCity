"use client";
import { useState, useMemo } from "react";

const CPM: Record<string,[number,number]> = {
  finance:[15,30],tech:[10,20],education:[10,18],science:[10,18],
  entertainment:[5,15],gaming:[5,12],music:[5,10],lifestyle:[8,15],
  news:[8,15],comedy:[5,12],pets:[6,12],faith:[6,12],
};

function fmt(n:number):string {
  if(n>=1e9)return(n/1e9).toFixed(1)+"B";
  if(n>=1e6)return(n/1e6).toFixed(1)+"M";
  if(n>=1e3)return(n/1e3).toFixed(1)+"K";
  return String(n);
}

interface Channel {
  handle:string;channel_name:string|null;subscriber_count:number;
  video_count:number;recent_upload_count_30d:number;category:string|null;
  is_verified:boolean;niche:string;litPct:number;districtId:string;
}

interface Props {
  channels:Channel[];
  onSelectChannel:(handle:string)=>void;
  onClose:()=>void;
}

const NICHES=["All Niches","finance","tech","gaming","education","entertainment","music","lifestyle","science","news","comedy","pets","faith"];
const SIZES=["Any Size","Newcomer (< 100K)","Rising (100K–1M)","Mid-City (1M–10M)","Megacity (10M+)"];
const BUDGETS=["Any Budget","$0–$500","$500–$2K","$2K–$10K","$10K+"];
const DIST_COLORS:Record<string,string>={mega:"#ff2200",mid:"#ff5500",rising:"#ff8800",newcomer:"#ffaa00",prime:"#ffd700"};

export default function BrandSearch({channels,onSelectChannel,onClose}:Props){
  const[niche,setNiche]=useState("All Niches");
  const[size,setSize]=useState("Any Size");
  const[budget,setBudget]=useState("Any Budget");
  const[keyword,setKeyword]=useState("");
  const[sortBy,setSortBy]=useState<"value"|"subs"|"activity">("value");

  const getCpmHigh=(ch:Channel)=>CPM[Object.keys(CPM).find(k=>ch.niche?.toLowerCase().includes(k))??"entertainment"][1];
  const getCpmLow=(ch:Channel)=>CPM[Object.keys(CPM).find(k=>ch.niche?.toLowerCase().includes(k))??"entertainment"][0];

  const results=useMemo(()=>{
    return channels.filter(ch=>{
      const s=ch.subscriber_count??0;
      if(niche!=="All Niches"&&!ch.niche?.toLowerCase().includes(niche))return false;
      if(size==="Newcomer (< 100K)"&&s>=100000)return false;
      if(size==="Rising (100K–1M)"&&(s<100000||s>=1000000))return false;
      if(size==="Mid-City (1M–10M)"&&(s<1000000||s>=10000000))return false;
      if(size==="Megacity (10M+)"&&s<10000000)return false;
      if(keyword&&!ch.channel_name?.toLowerCase().includes(keyword.toLowerCase())&&!ch.handle?.toLowerCase().includes(keyword.toLowerCase()))return false;
      const estHigh=Math.round(s*0.04*getCpmHigh(ch)/1000);
      if(budget==="$0–$500"&&estHigh>500)return false;
      if(budget==="$500–$2K"&&(estHigh<500||estHigh>2000))return false;
      if(budget==="$2K–$10K"&&(estHigh<2000||estHigh>10000))return false;
      if(budget==="$10K+"&&estHigh<10000)return false;
      return true;
    }).sort((a,b)=>{
      if(sortBy==="subs")return b.subscriber_count-a.subscriber_count;
      if(sortBy==="activity")return(b.recent_upload_count_30d??0)-(a.recent_upload_count_30d??0);
      return(b.subscriber_count*0.04*getCpmHigh(b)/1000)-(a.subscriber_count*0.04*getCpmHigh(a)/1000);
    }).slice(0,30);
  },[channels,niche,size,budget,keyword,sortBy]);

  const sel={background:"rgba(20,0,0,0.9)",border:"1px solid #440000",borderRadius:8,padding:"7px 12px",color:"#ffcc66",fontSize:12,fontFamily:"'Courier New',monospace",cursor:"pointer",outline:"none"} as const;

  return(
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.8)",zIndex:80,display:"flex",alignItems:"center",justifyContent:"center",backdropFilter:"blur(6px)"}}>
      <div style={{background:"rgba(3,0,0,0.98)",border:"1px solid #554400",borderRadius:16,width:"min(920px,96vw)",maxHeight:"88vh",display:"flex",flexDirection:"column",boxShadow:"0 0 80px rgba(200,150,0,0.3)",fontFamily:"'Courier New',monospace",overflow:"hidden"}}>

        {/* Header */}
        <div style={{padding:"20px 26px",borderBottom:"1px solid #330000",display:"flex",alignItems:"center",justifyContent:"space-between",flexShrink:0}}>
          <div>
            <div style={{fontSize:10,color:"#ffd700",letterSpacing:4,marginBottom:4}}>🎯 BRAND DISCOVERY</div>
            <div style={{fontSize:20,fontWeight:900,color:"white"}}>Find Your Perfect Creator</div>
            <div style={{fontSize:11,color:"#888",marginTop:3}}>Filter {channels.length} channels by niche, size & sponsor budget</div>
          </div>
          <button onClick={onClose} style={{background:"none",border:"1px solid #440000",color:"#cc4444",padding:"7px 16px",borderRadius:8,cursor:"pointer",fontSize:12,letterSpacing:1}}>✕ CLOSE</button>
        </div>

        {/* Filters */}
        <div style={{padding:"14px 26px",borderBottom:"1px solid #1a0000",display:"flex",gap:10,flexWrap:"wrap",alignItems:"center",flexShrink:0}}>
          <input value={keyword} onChange={e=>setKeyword(e.target.value)} placeholder="Search channel..."
            style={{background:"rgba(20,0,0,0.8)",border:"1px solid #440000",borderRadius:8,padding:"7px 12px",color:"white",fontSize:12,fontFamily:"'Courier New',monospace",width:160,outline:"none"}}/>
          <select value={niche} onChange={e=>setNiche(e.target.value)} style={sel}>
            {NICHES.map(n=><option key={n} value={n}>{n==="All Niches"?n:n.charAt(0).toUpperCase()+n.slice(1)}</option>)}
          </select>
          <select value={size} onChange={e=>setSize(e.target.value)} style={sel}>
            {SIZES.map(s=><option key={s}>{s}</option>)}
          </select>
          <select value={budget} onChange={e=>setBudget(e.target.value)} style={sel}>
            {BUDGETS.map(b=><option key={b}>{b}</option>)}
          </select>
          <div style={{display:"flex",gap:4,marginLeft:"auto"}}>
            {([["value","💰 Value"],["subs","📊 Subs"],["activity","🔥 Active"]] as const).map(([k,l])=>(
              <button key={k} onClick={()=>setSortBy(k)}
                style={{background:sortBy===k?"#886600":"rgba(20,0,0,0.8)",border:`1px solid ${sortBy===k?"#ffd700":"#440000"}`,color:sortBy===k?"#ffd700":"#666",padding:"6px 12px",borderRadius:8,cursor:"pointer",fontSize:11,fontFamily:"'Courier New',monospace",transition:"all 0.15s"}}>
                {l}
              </button>
            ))}
          </div>
        </div>

        {/* Count */}
        <div style={{padding:"8px 26px",fontSize:10,color:"#555",letterSpacing:2,flexShrink:0,borderBottom:"1px solid #120000"}}>
          {results.length} CHANNELS MATCH · CLICK ANY TO FLY TO IT IN THE CITY
        </div>

        {/* Results */}
        <div style={{overflowY:"auto",padding:"12px 18px 24px",display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(230px,1fr))",gap:10}}>
          {results.length===0?(
            <div style={{gridColumn:"1/-1",textAlign:"center",color:"#444",padding:48,fontSize:13}}>No channels match · try adjusting filters</div>
          ):results.map(ch=>{
            const s=ch.subscriber_count??0;
            const low=Math.round(s*0.04*getCpmLow(ch)/1000);
            const high=Math.round(s*0.04*getCpmHigh(ch)/1000);
            const dc=DIST_COLORS[ch.districtId]??"#ff8800";
            const isMomentum=(ch.litPct??0)>0.7;
            return(
              <div key={ch.handle} onClick={()=>{onSelectChannel(ch.handle);onClose();}}
                style={{background:"rgba(8,0,0,0.85)",border:`1px solid ${isMomentum?"#664400":"#1a0000"}`,borderRadius:10,padding:"12px 14px",cursor:"pointer",transition:"all 0.15s",boxShadow:isMomentum?"0 0 14px rgba(180,120,0,0.18)":"none"}}
                onMouseEnter={e=>{(e.currentTarget as HTMLDivElement).style.background="rgba(22,8,0,0.95)";(e.currentTarget as HTMLDivElement).style.borderColor=dc;}}
                onMouseLeave={e=>{(e.currentTarget as HTMLDivElement).style.background="rgba(8,0,0,0.85)";(e.currentTarget as HTMLDivElement).style.borderColor=isMomentum?"#664400":"#1a0000";}}>
                <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",marginBottom:8}}>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontSize:13,fontWeight:700,color:"white",lineHeight:1.2,marginBottom:1,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>
                      {ch.channel_name??ch.handle}{isMomentum&&" 🔥"}{ch.is_verified&&" ✅"}
                    </div>
                    <div style={{fontSize:10,color:"#ffcc66"}}>@{ch.handle}</div>
                  </div>
                  <div style={{fontSize:9,background:`${dc}18`,color:dc,padding:"2px 7px",borderRadius:8,letterSpacing:1,border:`1px solid ${dc}33`,whiteSpace:"nowrap",marginLeft:6}}>
                    {ch.districtId?.toUpperCase()}
                  </div>
                </div>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:5,marginBottom:8}}>
                  {[["SUBS",fmt(s)],["NICHE",(ch.niche??"?").toUpperCase()]].map(([l,v])=>(
                    <div key={l} style={{background:"rgba(150,0,0,0.09)",padding:"5px 8px",borderRadius:6,border:"1px solid #180000"}}>
                      <div style={{fontSize:7,color:"#885500",letterSpacing:2}}>{l}</div>
                      <div style={{fontSize:12,fontWeight:700,color:"white"}}>{v}</div>
                    </div>
                  ))}
                </div>
                <div style={{borderTop:"1px solid #160000",paddingTop:8,display:"flex",alignItems:"center",justifyContent:"space-between"}}>
                  <div>
                    <div style={{fontSize:7,color:"#885500",letterSpacing:2,marginBottom:1}}>SPONSOR VALUE / VIDEO</div>
                    <div style={{fontSize:15,fontWeight:900,color:"#ff3333"}}>${fmt(low)} – ${fmt(high)}</div>
                  </div>
                  {(ch.recent_upload_count_30d??0)>0&&(
                    <div style={{fontSize:9,color:"#ffaa44",textAlign:"right"}}>{ch.recent_upload_count_30d}<br/><span style={{color:"#554400"}}>uploads/mo</span></div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div style={{padding:"12px 26px",borderTop:"1px solid #1a0000",background:"rgba(15,5,0,0.6)",flexShrink:0,display:"flex",alignItems:"center",justifyContent:"space-between"}}>
          <div style={{fontSize:11,color:"#665500"}}>
            💼 Full contact details & outreach tools — <span style={{color:"#ffd700",fontWeight:700}}>Brand Pro coming soon · $99/month</span>
          </div>
          <div style={{fontSize:9,color:"#333",letterSpacing:2}}>TUBE CITY</div>
        </div>
      </div>
    </div>
  );
}
