"use client";
import BrandSearch from "@/components/BrandSearch";
import NexLevPanel from "@/components/NexLevPanel";

import { useEffect, useState, useRef, useCallback, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls, Stars } from "@react-three/drei";
import * as THREE from "three";
import { nicheColor } from "@/lib/niche";

// ─── CONFIG ──────────────────────────────────────────────────

const DISTRICTS = [
  { id:"prime",    label:"PRIME DISTRICT",   minSubs:0,          ringR:85,  color:"#ffd700", desc:"Paid Featured Spot" },
  { id:"mega",     label:"MEGACITY CORE",    minSubs:10_000_000, ringR:180, color:"#ff2200", desc:"10M+ Subscribers" },
  { id:"mid",      label:"MID-CITY",         minSubs:1_000_000,  ringR:320, color:"#ff5500", desc:"1M – 10M" },
  { id:"rising",   label:"RISING DISTRICT",  minSubs:100_000,    ringR:460, color:"#ff8800", desc:"100K – 1M" },
  { id:"newcomer", label:"NEWCOMER STRIP",   minSubs:0,          ringR:620, color:"#ffaa00", desc:"Under 100K" },
];

// Keep in sync with src/lib/sponsorship.ts's NICHE_CPM_TABLE — that vocabulary is
// what's already live in the production channels.niche column.
const CPM: Record<string,[number,number]> = {
  finance:[15,30],business:[12,25],tech:[10,20],ai_tools:[12,28],education:[10,18],
  health:[8,18],entertainment:[5,15],gaming:[5,12],music:[5,10],lifestyle:[8,15],
  food:[5,14],travel:[6,18],beauty:[5,15],fitness:[6,16],kids:[3,10],
  news:[8,15],science:[10,18],history:[6,14],pets:[6,12],other:[4,12],
};

const NICHE_SHAPES: Record<string, "box"|"step"|"taper"|"slim"|"wide"> = {
  finance:"step", business:"step", tech:"slim", ai_tools:"slim", gaming:"taper",
  education:"wide", entertainment:"box", music:"slim", lifestyle:"wide",
  health:"wide", food:"wide", travel:"wide", beauty:"slim", fitness:"taper",
  kids:"wide", science:"step", history:"step", news:"box", pets:"wide", other:"box",
};

// ─── HELPERS ─────────────────────────────────────────────────

function fmt(n:number):string {
  if(n>=1e9)return(n/1e9).toFixed(1)+"B";
  if(n>=1e6)return(n/1e6).toFixed(1)+"M";
  if(n>=1e3)return(n/1e3).toFixed(1)+"K";
  return String(n);
}

function calcHeight(subs:number):number {
  if(subs<=0)return 8;
  const log=Math.log10(subs);
  const norm=Math.max(0,Math.min(1,(log-2)/7));
  return 8+Math.pow(norm,0.55)*152;
}

function calcWidth(videos:number):number {
  if(videos<=0)return 10;
  return 10+Math.min(1,Math.log10(Math.max(1,videos))/4)*20;
}

function seededRnd(seed:number):number {
  const s=(seed*16807)%2147483647;
  return(s-1)/2147483646;
}

// ─── WINDOW ATLAS ────────────────────────────────────────────

function createAtlas():THREE.CanvasTexture {
  const SIZE=1024,CELL=8,COLS=SIZE/CELL;
  const canvas=document.createElement("canvas");
  canvas.width=SIZE;canvas.height=SIZE;
  const ctx=canvas.getContext("2d")!;
  const img=ctx.createImageData(SIZE,SIZE);
  const buf=new Uint32Array(img.data.buffer);

  function hexToABGR(hex:string):number {
    const c=new THREE.Color(hex);
    return(255<<24)|(Math.round(c.b*255)<<16)|(Math.round(c.g*255)<<8)|Math.round(c.r*255);
  }
  const faceABGR=hexToABGR("#180000");
  const litColors=["#ff5555","#ff7744","#ffaa88","#ff3333","#ff8866"].map(hexToABGR);
  const offABGR=hexToABGR("#0d0000");

  buf.fill(faceABGR);
  let seed=42;
  const rnd=()=>{seed=(seed*16807)%2147483647;return(seed-1)/2147483646;};
  const BANDS=6;const BROWS=Math.floor((SIZE/CELL)/BANDS);
  const LIT_PCTS=[0.1,0.25,0.4,0.58,0.72,0.88];

  for(let band=0;band<BANDS;band++){
    const litPct=LIT_PCTS[band];
    for(let r=0;r<BROWS;r++){
      const rowY=(band*BROWS+r)*CELL;
      for(let c=0;c<COLS;c++){
        const px=c*CELL;
        const lit=rnd()<litPct;
        const abgr=lit?litColors[Math.floor(rnd()*litColors.length)]:offABGR;
        for(let dy=0;dy<6;dy++){
          const rowOff=(rowY+dy)*SIZE+px;
          for(let dx=0;dx<6;dx++)buf[rowOff+dx]=abgr;
        }
      }
    }
  }
  ctx.putImageData(img,0,0);
  const tex=new THREE.CanvasTexture(canvas);
  tex.flipY=false;tex.wrapS=THREE.RepeatWrapping;tex.wrapT=THREE.RepeatWrapping;
  tex.magFilter=THREE.NearestFilter;tex.minFilter=THREE.NearestFilter;
  tex.colorSpace=THREE.SRGBColorSpace;
  return tex;
}

// ─── TYPES ───────────────────────────────────────────────────

interface ChData {
  id:string;handle:string;channel_name:string|null;
  subscriber_count:number;video_count:number;
  recent_upload_count_30d:number;category:string|null;niche?:string;
  is_verified:boolean;avatar_url:string|null;total_view_count?:number;
}

interface PlacedBld extends ChData {
  x:number;z:number;height:number;width:number;depth:number;
  niche:string;districtId:string;litPct:number;
  floors:number;wPerFloor:number;sWPerFloor:number;
  shape:string;
}

// ─── LAYOUT ENGINE ────────────────────────────────────────────

function layoutCity(channels:ChData[]):PlacedBld[] {
  const result:PlacedBld[]=[];
  const occupied:[number,number,number][]=[];

  function free(x:number,z:number,w:number):boolean {
    return occupied.every(([ox,oz,ow])=>Math.abs(x-ox)>w+ow+8||Math.abs(z-oz)>w+ow+8);
  }

  const sorted=[...channels].sort((a,b)=>b.subscriber_count-a.subscriber_count);

  for(const ch of sorted){
    const subs=ch.subscriber_count??0;
    const niche=ch.niche??"other";
    const h=calcHeight(subs);
    const w=calcWidth(ch.video_count??0);
    const d=w*0.85;
    const litPct=Math.min(1,(ch.recent_upload_count_30d??0)/10);
    const floorH=7;
    const floors=Math.max(3,Math.floor(h/floorH));
    const wPerFloor=Math.max(3,Math.floor(w/5));
    const sWPerFloor=Math.max(3,Math.floor(d/5));
    const shape=NICHE_SHAPES[niche]??"box";

    let dId="newcomer";
    if(subs>=10_000_000)dId="mega";
    else if(subs>=1_000_000)dId="mid";
    else if(subs>=100_000)dId="rising";

    const distIdx=DISTRICTS.findIndex(d=>d.id===dId);
    const prevR=distIdx>0?DISTRICTS[distIdx-1].ringR+12:10;
    const maxR=DISTRICTS[distIdx].ringR-12;

    let bx=0,bz=0,placed=false;
    const hseed=ch.handle.split("").reduce((a,c)=>a+c.charCodeAt(0),0);
    for(let a=0;a<140;a++){
      const angle=seededRnd(hseed+a*997)*Math.PI*2;
      const r=prevR+seededRnd(hseed+a*1301)*(maxR-prevR);
      const tx=Math.cos(angle)*r,tz=Math.sin(angle)*r;
      if(free(tx,tz,w/2)){bx=tx;bz=tz;placed=true;break;}
    }
    if(!placed){
      const angle=seededRnd(hseed)*Math.PI*2;
      const r=maxR+10+seededRnd(hseed+777)*80;
      bx=Math.cos(angle)*r;bz=Math.sin(angle)*r;
    }
    occupied.push([bx,bz,w/2]);
    result.push({...ch,x:bx,z:bz,height:h,width:w,depth:d,niche,districtId:dId,litPct,floors,wPerFloor,sWPerFloor,shape});
  }
  return result;
}

// ─── INSTANCED CITY MESH ─────────────────────────────────────

const _mat4=new THREE.Matrix4();
const _pos3=new THREE.Vector3();
const _quat0=new THREE.Quaternion();
const _scl3=new THREE.Vector3();

function InstancedCity({
  buildings,atlas,focusHandle,onBuildingClick,onHoverChange,
}:{
  buildings:PlacedBld[];
  atlas:THREE.CanvasTexture;
  focusHandle:string|null;
  onBuildingClick:(b:PlacedBld)=>void;
  onHoverChange:(b:PlacedBld|null,sx:number,sy:number)=>void;
}) {
  const meshRef=useRef<THREE.InstancedMesh>(null);
  const {gl,camera}=useThree();
  const count=buildings.length;

  const geo=useMemo(()=>new THREE.BoxGeometry(1,1,1),[]);

  const mat=useMemo(()=>new THREE.ShaderMaterial({
    uniforms:{
      uAtlas:{value:atlas},
      uFaceColor:{value:new THREE.Color("#180000")},
      uRoofColor:{value:new THREE.Color("#2a0808")},
      uFogColor:{value:new THREE.Color("#060000")},
      uFogNear:{value:180},uFogFar:{value:1200},
      uFocused:{value:-1.0},uTime:{value:0},
      uAmbient:{value:0.55},
    },
    vertexShader:`
      attribute vec4 aUvF;attribute vec4 aUvS;
      attribute float aRise;attribute vec3 aTint;
      varying vec2 vUv;varying vec3 vNorm;
      varying vec4 vUvF;varying vec4 vUvS;
      varying vec3 vViewPos;varying float vId;varying vec3 vTint;
      void main(){
        vUv=uv;vNorm=normalize(mat3(instanceMatrix)*normal);
        vUvF=aUvF;vUvS=aUvS;vTint=aTint;
        vec3 lp=position;
        lp.y=lp.y*aRise+(aRise-1.0)*0.5;
        vec4 mv=modelViewMatrix*instanceMatrix*vec4(lp,1.0);
        vViewPos=mv.xyz;vId=float(gl_InstanceID);
        gl_Position=projectionMatrix*mv;
      }
    `,
    fragmentShader:`
      uniform sampler2D uAtlas;
      uniform vec3 uFaceColor,uRoofColor,uFogColor;
      uniform float uFogNear,uFogFar,uFocused,uTime,uAmbient;
      varying vec2 vUv;varying vec3 vNorm;
      varying vec4 vUvF,vUvS;varying vec3 vViewPos;
      varying float vId;varying vec3 vTint;
      void main(){
        float fogD=length(vViewPos);
        if(fogD>uFogFar)discard;
        vec3 absN=abs(vNorm);
        float isRoof=step(0.5,absN.y);
        bool isFB=absN.z>absN.x;
        vec4 uvP=isFB?vUvF:vUvS;
        vec2 aUv=uvP.xy+vUv*uvP.zw;
        vec3 wall=texture2D(uAtlas,aUv).rgb;
        wall=mix(wall,vTint,0.35);
        vec3 em=wall*2.0;
        vec3 wf=wall*uAmbient+em;
        vec3 rf=uRoofColor*(0.6+1.4);
        vec3 col=mix(wf,rf,isRoof);
        float isFoc=step(abs(vId-uFocused),0.5);
        float hasFoc=step(0.0,uFocused);
        float pulse=1.0+0.2*sin(uTime*3.0);
        float dimF=mix(1.0,mix(0.4,1.0,isFoc)*mix(pulse,1.0,1.0-isFoc),hasFoc);
        col*=dimF;
        float diff=max(dot(vNorm,normalize(vec3(0.4,1.0,0.6))),0.0)*0.35+0.65;
        col*=diff;
        float ff=smoothstep(uFogNear,uFogFar,fogD);
        col=mix(col,uFogColor,ff);
        gl_FragColor=vec4(col,1.0);
      }
    `,
  }),[atlas]);

  const riseData=useMemo(()=>new Float32Array(count).fill(0),[count]);
  const risingRef=useRef<{idx:number;start:number}[]>([]);
  const riseInit=useRef(false);
  const attrReady=useRef(false);

  const {uvF,uvS,tint}=useMemo(()=>{
    const ACOLS=128;const BANDS=6;const BROWS=Math.floor(128/BANDS);
    const uvFd=new Float32Array(count*4);
    const uvSd=new Float32Array(count*4);
    const tintd=new Float32Array(count*3);
    const c=new THREE.Color();
    for(let i=0;i<count;i++){
      const b=buildings[i];
      const seed=b.handle.split("").reduce((a,x)=>a+x.charCodeAt(0),0)*137;
      const band=Math.min(5,Math.max(0,Math.round(b.litPct*5)));
      const bRow=band*BROWS;
      uvFd[i*4+0]=(Math.abs(seed)%Math.max(1,ACOLS-b.wPerFloor))/ACOLS;
      uvFd[i*4+1]=bRow/128;uvFd[i*4+2]=b.wPerFloor/ACOLS;uvFd[i*4+3]=b.floors/128;
      uvSd[i*4+0]=(Math.abs(seed+7919)%Math.max(1,ACOLS-b.sWPerFloor))/ACOLS;
      uvSd[i*4+1]=bRow/128;uvSd[i*4+2]=b.sWPerFloor/ACOLS;uvSd[i*4+3]=b.floors/128;
      c.set(nicheColor(b.niche));
      tintd[i*3]=c.r;tintd[i*3+1]=c.g;tintd[i*3+2]=c.b;
    }
    return{uvF:uvFd,uvS:uvSd,tint:tintd};
  },[buildings,count]);

  useEffect(()=>{
    const mesh=meshRef.current;if(!mesh)return;
    attrReady.current=false;

    // Niche shape scaling
    for(let i=0;i<count;i++){
      const b=buildings[i];
      let sx=b.width,sy=b.height,sz=b.depth;
      // Shape variations per niche
      if(b.shape==="step"){ sx*=0.85;sz*=0.85; }
      else if(b.shape==="slim"){ sx*=0.6;sz*=0.6; }
      else if(b.shape==="wide"){ sx*=1.3;sz*=0.75; }
      else if(b.shape==="taper"){ /* handled as normal box, taper via separate mesh */ }

      _pos3.set(b.x,sy/2,b.z);
      _scl3.set(sx,sy,sz);
      _mat4.compose(_pos3,_quat0,_scl3);
      mesh.setMatrixAt(i,_mat4);
    }
    mesh.instanceMatrix.needsUpdate=true;

    let maxD=0,maxH=0;
    for(const b of buildings){const d=Math.sqrt(b.x*b.x+b.z*b.z);if(d>maxD)maxD=d;if(b.height>maxH)maxH=b.height;}
    mesh.boundingSphere=new THREE.Sphere(new THREE.Vector3(0,maxH/2,0),Math.sqrt(maxD*maxD+maxH*maxH)+200);

    // Set all attributes before marking ready
    const riseAttr=new THREE.InstancedBufferAttribute(new Float32Array(count).fill(0),1);
    riseAttr.setUsage(THREE.DynamicDrawUsage);
    mesh.geometry.setAttribute("aUvF",new THREE.InstancedBufferAttribute(uvF,4));
    mesh.geometry.setAttribute("aUvS",new THREE.InstancedBufferAttribute(uvS,4));
    mesh.geometry.setAttribute("aRise",riseAttr);
    mesh.geometry.setAttribute("aTint",new THREE.InstancedBufferAttribute(tint,3));
    mesh.count=count;

    attrReady.current=true;
    riseInit.current=false;
    risingRef.current=[];
  },[buildings,count,uvF,uvS,tint]);

  useEffect(()=>{
    if(!mat.uniforms)return;
    if(!focusHandle){mat.uniforms.uFocused.value=-1;return;}
    const idx=buildings.findIndex(b=>b.handle.toLowerCase()===focusHandle.toLowerCase());
    mat.uniforms.uFocused.value=idx>=0?idx:-1;
  },[focusHandle,buildings,mat]);

  useFrame(({clock})=>{
    if(mat.uniforms)mat.uniforms.uTime.value=clock.elapsedTime;
    const mesh=meshRef.current;
    if(!mesh||!attrReady.current)return;

    const now=clock.elapsedTime;
    if(!riseInit.current){
      riseInit.current=true;
      const stagger=Math.min(0.005,3.5/Math.max(1,count));
      risingRef.current=buildings.map((_,i)=>({idx:i,start:now+i*stagger}));
    }
    if(risingRef.current.length===0)return;

    const rAttr=mesh.geometry.getAttribute("aRise") as THREE.InstancedBufferAttribute|undefined;
    if(!rAttr||!rAttr.array)return; // guard against uninitialised attr

    const arr=rAttr.array as Float32Array;
    const next:{idx:number;start:number}[]=[];
    let changed=false;
    for(const s of risingRef.current){
      const el=now-s.start;
      if(el<0){next.push(s);continue;}
      const t=Math.min(1,el/0.9);
      arr[s.idx]=1-(1-t)**3;
      changed=true;
      if(t<1)next.push(s);
    }
    risingRef.current=next;
    if(changed)rAttr.needsUpdate=true;
  });

  // Raycasting
  const raycaster=useMemo(()=>new THREE.Raycaster(),[]);
  const ndc=useMemo(()=>new THREE.Vector2(),[]);

  useEffect(()=>{
    const canvas=gl.domElement;
    const toNDC=(cx:number,cy:number)=>{
      const r=canvas.getBoundingClientRect();
      ndc.x=((cx-r.left)/r.width)*2-1;
      ndc.y=-((cy-r.top)/r.height)*2+1;
    };
    const cast=(cx:number,cy:number)=>{
      const mesh=meshRef.current;if(!mesh)return null;
      toNDC(cx,cy);raycaster.setFromCamera(ndc,camera);
      const hits:THREE.Intersection[]=[];mesh.raycast(raycaster,hits);
      if(hits.length){hits.sort((a,b)=>a.distance-b.distance);return hits[0].instanceId??null;}
      return null;
    };
    const tapRef={t:0,id:-1,x:0,y:0};
    const onDown=(e:PointerEvent)=>{
      const id=cast(e.clientX,e.clientY);
      if(id!==null&&id<buildings.length)Object.assign(tapRef,{t:performance.now(),id,x:e.clientX,y:e.clientY});
    };
    const onUp=(e:PointerEvent)=>{
      if(tapRef.id<0)return;
      if(performance.now()-tapRef.t>400){tapRef.id=-1;return;}
      const dx=e.clientX-tapRef.x,dy=e.clientY-tapRef.y;
      if(dx*dx+dy*dy<625&&tapRef.id<buildings.length)onBuildingClick(buildings[tapRef.id]);
      tapRef.id=-1;
    };
    let lastMove=0;
    const onMove=(e:PointerEvent)=>{
      const now=performance.now();if(now-lastMove<80)return;lastMove=now;
      const id=cast(e.clientX,e.clientY);
      if(id!==null&&id<buildings.length){
        document.body.style.cursor="pointer";
        onHoverChange(buildings[id],e.clientX,e.clientY);
      }else{
        document.body.style.cursor="auto";
        onHoverChange(null,0,0);
      }
    };
    canvas.addEventListener("pointerdown",onDown);
    window.addEventListener("pointerup",onUp);
    canvas.addEventListener("pointermove",onMove);
    return()=>{
      canvas.removeEventListener("pointerdown",onDown);
      window.removeEventListener("pointerup",onUp);
      canvas.removeEventListener("pointermove",onMove);
      document.body.style.cursor="auto";
    };
  },[gl,camera,buildings,onBuildingClick,onHoverChange,raycaster,ndc]);

  useEffect(()=>()=>{geo.dispose();mat.dispose();},[geo,mat]);
  if(count===0)return null;
  return<instancedMesh ref={meshRef} args={[geo,mat,count]} frustumCulled={false}/>;
}

// ─── NICHE ROOF TOPPERS (separate meshes on top of instanced buildings) ──

function NicheToppers({buildings}:{buildings:PlacedBld[]}){
  return(
    <>
      {buildings.map((b,i)=>{
        const topY=b.height;
        const w=b.width;
        const key=`top-${i}`;
        if(b.shape==="slim"||b.niche==="tech"||b.niche==="music"){
          return(
            <group key={key} position={[b.x,topY,b.z]}>
              <mesh position={[0,6,0]}>
                <cylinderGeometry args={[0.4,0.4,13,6]}/>
                <meshStandardMaterial color="#ff2200" emissive="#ff1100" emissiveIntensity={1.2} metalness={0.95}/>
              </mesh>
              <mesh position={[0,13.5,0]}>
                <sphereGeometry args={[0.8,8,8]}/>
                <meshStandardMaterial color="#ff0000" emissive="#ff0000" emissiveIntensity={3.5}/>
              </mesh>
            </group>
          );
        }
        if(b.shape==="step"||b.niche==="finance"||b.niche==="science"){
          return(
            <group key={key} position={[b.x,topY,b.z]}>
              <mesh position={[0,4,0]}>
                <coneGeometry args={[w*0.45,9,4]}/>
                <meshStandardMaterial color="#cc1100" emissive="#cc1100" emissiveIntensity={0.5} metalness={0.9}/>
              </mesh>
            </group>
          );
        }
        if(b.niche==="gaming"||b.niche==="comedy"||b.niche==="faith"){
          return(
            <group key={key} position={[b.x,topY,b.z]}>
              <mesh position={[0,5,0]}>
                <coneGeometry args={[1.2,11,6]}/>
                <meshStandardMaterial color="#ff3300" emissive="#ff2200" emissiveIntensity={2} metalness={0.95}/>
              </mesh>
            </group>
          );
        }
        if(b.niche==="education"||b.niche==="lifestyle"||b.niche==="pets"){
          return(
            <group key={key} position={[b.x,topY,b.z]}>
              <mesh position={[0,3,0]}>
                <sphereGeometry args={[w*0.35,10,8,0,Math.PI*2,0,Math.PI/2]}/>
                <meshStandardMaterial color="#cc0033" emissive="#cc0022" emissiveIntensity={0.5} metalness={0.8} transparent opacity={0.85}/>
              </mesh>
            </group>
          );
        }
        // Default flat roof slab
        return(
          <mesh key={key} position={[b.x,topY+0.4,b.z]}>
            <boxGeometry args={[w*1.05,0.8,b.depth*1.05]}/>
            <meshStandardMaterial color="#120000" roughness={0.6} metalness={0.5}/>
          </mesh>
        );
      })}
    </>
  );
}

// ─── GROUND + ROADS ──────────────────────────────────────────

function CityGround(){
  const roads=useMemo(()=>{const r:number[]=[];for(let i=-5;i<=5;i++)r.push(i*160);return r;},[]);
  return(
    <group>
      <mesh rotation={[-Math.PI/2,0,0]} position={[0,-1,0]} receiveShadow>
        <planeGeometry args={[2500,2500]}/>
        <meshStandardMaterial color="#0c0000" roughness={0.95}/>
      </mesh>
      {roads.map(z=>(
        <mesh key={`hr${z}`} rotation={[-Math.PI/2,0,0]} position={[0,0,z]}>
          <planeGeometry args={[2500,20]}/>
          <meshStandardMaterial color="#180000" roughness={0.88}/>
        </mesh>
      ))}
      {roads.map(x=>(
        <mesh key={`vr${x}`} rotation={[-Math.PI/2,0,0]} position={[x,0,0]}>
          <planeGeometry args={[20,2500]}/>
          <meshStandardMaterial color="#180000" roughness={0.88}/>
        </mesh>
      ))}
      {/* Road dashes */}
      {roads.map(z=>Array.from({length:40}).map((_,i)=>(
        <mesh key={`hd${z}${i}`} rotation={[-Math.PI/2,0,0]} position={[(i-20)*62,0.2,z]}>
          <planeGeometry args={[24,0.7]}/><meshStandardMaterial color="#3a0000" emissive="#280000" emissiveIntensity={0.5}/>
        </mesh>
      )))}
      {roads.map(x=>Array.from({length:40}).map((_,i)=>(
        <mesh key={`vd${x}${i}`} rotation={[-Math.PI/2,0,0]} position={[x,0.2,(i-20)*62]}>
          <planeGeometry args={[0.7,24]}/><meshStandardMaterial color="#3a0000" emissive="#280000" emissiveIntensity={0.5}/>
        </mesh>
      )))}
      {/* Street lamps with real point lights */}
      {roads.filter((_,i)=>i%2===0).map(z=>
        roads.filter((_,i)=>i%2===0).map(x=>(
          <group key={`lp${x}${z}`} position={[x,0,z+14]}>
            <mesh position={[0,12,0]}>
              <cylinderGeometry args={[0.25,0.35,24,6]}/>
              <meshStandardMaterial color="#1e0000"/>
            </mesh>
            <mesh position={[0,24.5,0]}>
              <boxGeometry args={[1.4,0.7,1.4]}/>
              <meshStandardMaterial color="#ffffff" emissive="#ffcc88" emissiveIntensity={4} toneMapped={false}/>
            </mesh>
          </group>
        ))
      )}
    </group>
  );
}

// ─── DISTRICT RINGS ──────────────────────────────────────────

function DistrictRings(){
  return(
    <group>
      {/* Prime center glow — gold */}
      <mesh rotation={[-Math.PI/2,0,0]} position={[0,0.4,0]}>
        <ringGeometry args={[72,88,64]}/>
        <meshBasicMaterial color="#ffd700" transparent opacity={0.45}/>
      </mesh>
      <mesh rotation={[-Math.PI/2,0,0]} position={[0,0.2,0]}>
        <circleGeometry args={[72,64]}/>
        <meshBasicMaterial color="#ffd700" transparent opacity={0.06}/>
      </mesh>
      {/* District rings */}
      {[180,320,460,620].map((r,i)=>(
        <mesh key={r} rotation={[-Math.PI/2,0,0]} position={[0,0.2,0]}>
          <ringGeometry args={[r-1.5,r+2,64]}/>
          <meshBasicMaterial color={DISTRICTS[i+1]?.color??"#ff8800"} transparent opacity={0.28}/>
        </mesh>
      ))}
    </group>
  );
}

// ─── GOLD BEACON FROM PRIME CENTER ───────────────────────────

function PrimeBeacon(){
  const coneRef=useRef<THREE.Mesh>(null);
  const ringRef=useRef<THREE.Mesh>(null);
  const spireRef=useRef<THREE.Mesh>(null);

  useFrame(({clock})=>{
    const t=clock.elapsedTime;
    if(coneRef.current)(coneRef.current.material as THREE.MeshBasicMaterial).opacity=0.12+Math.sin(t*0.8)*0.06;
    if(ringRef.current)ringRef.current.rotation.y=t*0.4;
    if(spireRef.current)(spireRef.current.material as THREE.MeshStandardMaterial).emissiveIntensity=2+Math.sin(t*1.5)*0.8;
  });

  return(
    <group position={[0,0,0]}>
      {/* Gold sky beam */}
      <mesh ref={coneRef} position={[0,400,0]}>
        <cylinderGeometry args={[80,0,800,16,1,true]}/>
        <meshBasicMaterial color="#ffd700" transparent opacity={0.12} side={THREE.DoubleSide} depthWrite={false}/>
      </mesh>
      {/* Inner bright beam */}
      <mesh position={[0,400,0]}>
        <cylinderGeometry args={[8,0,800,8,1,true]}/>
        <meshBasicMaterial color="#ffee88" transparent opacity={0.25} side={THREE.DoubleSide} depthWrite={false}/>
      </mesh>
      {/* Rotating halo ring */}
      <mesh ref={ringRef} position={[0,2,0]}>
        <torusGeometry args={[50,1.5,8,40]}/>
        <meshStandardMaterial color="#ffd700" emissive="#ffd700" emissiveIntensity={2} metalness={0.9}/>
      </mesh>
      {/* Center spire */}
      <mesh ref={spireRef} position={[0,70,0]}>
        <cylinderGeometry args={[1.8,1.8,140,8]}/>
        <meshStandardMaterial color="#ffd700" emissive="#ffaa00" emissiveIntensity={2} metalness={0.95}/>
      </mesh>
      <mesh position={[0,142,0]}>
        <sphereGeometry args={[5,12,12]}/>
        <meshStandardMaterial color="#ffd700" emissive="#ffd700" emissiveIntensity={4} toneMapped={false}/>
      </mesh>
      {/* Gold point light at top */}
    </group>
  );
}

// ─── PRIME DISTRICT GHOST SLOTS ──────────────────────────────

function PrimeSlots(){
  const slots=useMemo(()=>Array.from({length:8}).map((_,i)=>{
    const a=(i/8)*Math.PI*2;const r=42+seededRnd(i*997)*18;
    return{x:Math.cos(a)*r,z:Math.sin(a)*r};
  }),[]);
  return(
    <group>
      {slots.map((s,i)=>(
        <group key={i} position={[s.x,0,s.z]}>
          <mesh position={[0,18,0]}>
            <boxGeometry args={[16,36,14]}/>
            <meshStandardMaterial color="#120800" roughness={0.2} metalness={0.9} transparent opacity={0.5}/>
          </mesh>
          <mesh position={[0,18,0]}>
            <boxGeometry args={[17,37,15]}/>
            <meshStandardMaterial color="#ffd700" transparent opacity={0.08} wireframe/>
          </mesh>
          <PulseBase i={i}/>
        </group>
      ))}
    </group>
  );
}

function PulseBase({i}:{i:number}){
  const r=useRef<THREE.Mesh>(null);
  useFrame(({clock})=>{
    if(r.current)(r.current.material as THREE.MeshBasicMaterial).opacity=0.2+Math.sin(clock.elapsedTime*1.4+i)*0.18;
  });
  return(
    <mesh ref={r} rotation={[-Math.PI/2,0,0]} position={[0,0.5,0]}>
      <planeGeometry args={[20,18]}/>
      <meshBasicMaterial color="#ffd700" transparent opacity={0.2}/>
    </mesh>
  );
}

// ─── VEHICLES ────────────────────────────────────────────────

interface VDef{sx:number;sz:number;dir:"h"|"v";spd:number;isLorry:boolean;}

function Vehicle({v}:{v:VDef}){
  const ref=useRef<THREE.Group>(null);
  const p=useRef({x:v.sx,z:v.sz});
  const len=v.isLorry?10:5,w=v.isLorry?3.5:2.5;
  const col=["#cc2200","#991100","#bb1100","#dd1100"][Math.abs(Math.round(v.sx+v.sz))%4];

  useFrame((_,dt)=>{
    if(!ref.current)return;
    if(v.dir==="h"){
      p.current.x+=v.spd*dt;
      if(p.current.x>950)p.current.x=-950;
      if(p.current.x<-950)p.current.x=950;
      ref.current.position.set(p.current.x,1.6,v.sz);
      ref.current.rotation.y=v.spd>0?0:Math.PI;
    }else{
      p.current.z+=v.spd*dt;
      if(p.current.z>950)p.current.z=-950;
      if(p.current.z<-950)p.current.z=950;
      ref.current.position.set(v.sx,1.6,p.current.z);
      ref.current.rotation.y=v.spd>0?-Math.PI/2:Math.PI/2;
    }
  });

  return(
    <group ref={ref}>
      <mesh><boxGeometry args={[len,1.7,w]}/><meshStandardMaterial color={v.isLorry?"#880000":col} roughness={0.3} metalness={0.6}/></mesh>
      <mesh position={[v.isLorry?-2.2:0,1.3,0]}><boxGeometry args={[v.isLorry?2.8:len*0.65,1.3,w*0.84]}/><meshStandardMaterial color="#0a0000" metalness={0.85}/></mesh>
      {[-w*0.32,w*0.32].map((lz,i)=>(
        <mesh key={i} position={[len/2+0.08,0,lz]}><boxGeometry args={[0.12,0.32,0.3]}/><meshStandardMaterial color="#fff" emissive="#fff" emissiveIntensity={6} toneMapped={false}/></mesh>
      ))}
      {[-w*0.32,w*0.32].map((lz,i)=>(
        <mesh key={i} position={[-len/2-0.08,0,lz]}><boxGeometry args={[0.12,0.3,0.28]}/><meshStandardMaterial color="#ff0000" emissive="#ff0000" emissiveIntensity={3}/></mesh>
      ))}
      {v.isLorry&&(
        <>
          <mesh position={[0,2.6,w/2+0.12]}><boxGeometry args={[7.5,2.6,0.22]}/><meshStandardMaterial color="#0a0000" emissive="#330000" emissiveIntensity={0.4}/></mesh>

        </>
      )}
    </group>
  );
}

function Vehicles(){
  const vlist=useMemo(()=>{
    const list:VDef[]=[];
    const roads=[-640,-480,-320,-160,0,160,320,480,640];
    roads.forEach((z,i)=>list.push({sx:(seededRnd(i*997+1)-0.5)*1800,sz:z+(seededRnd(i*997+2)-0.5)*7,dir:"h",spd:(12+seededRnd(i*997+3)*12)*(seededRnd(i*997+4)>0.5?1:-1),isLorry:i%3===0}));
    roads.forEach((x,i)=>list.push({sx:x+(seededRnd(i*1301+1)-0.5)*7,sz:(seededRnd(i*1301+2)-0.5)*1800,dir:"v",spd:(12+seededRnd(i*1301+3)*12)*(seededRnd(i*1301+4)>0.5?1:-1),isLorry:i%4===0}));
    return list;
  },[]);
  return<>{vlist.map((v,i)=><Vehicle key={i} v={v}/>)}</>;
}

// ─── ATMOSPHERE ───────────────────────────────────────────────

function Atmosphere(){
  const ref=useRef<THREE.Mesh>(null);
  useFrame(({clock})=>{if(ref.current)(ref.current.material as THREE.MeshBasicMaterial).opacity=0.028+Math.sin(clock.elapsedTime*0.18)*0.01;});
  return(
    <mesh ref={ref} rotation={[-Math.PI/2,0,0]} position={[0,14,0]}>
      <planeGeometry args={[6000,6000]}/>
      <meshBasicMaterial color="#ff0000" transparent opacity={0.028} depthWrite={false}/>
    </mesh>
  );
}

// ─── ORBIT SCENE ─────────────────────────────────────────────

function OrbitScene({target}:{target:[number,number,number]|null}){
  const {camera}=useThree();
  const cRef=useRef<any>(null);
  const sP=useRef(new THREE.Vector3()),eP=useRef(new THREE.Vector3());
  const sT=useRef(new THREE.Vector3()),eT=useRef(new THREE.Vector3());
  const prg=useRef(1);

  useEffect(()=>{camera.position.set(0,300,560);camera.lookAt(0,30,0);},[camera]);

  useEffect(()=>{
    if(!target)return;
    sP.current.copy(camera.position);
    if(cRef.current)sT.current.copy(cRef.current.target);
    const[tx,,tz]=target;const bl=Math.sqrt(tx*tx+tz*tz)||1;
    eP.current.set(tx+(tx/bl)*110,target[1]+90,tz+(tz/bl)*110);
    eT.current.set(tx,target[1]+30,tz);
    prg.current=0;if(cRef.current)cRef.current.autoRotate=false;
  },[target,camera]);

  useFrame((_,dt)=>{
    if(prg.current>=1)return;
    prg.current=Math.min(1,prg.current+dt*0.7);
    const t=1-Math.pow(1-prg.current,3);
    camera.position.lerpVectors(sP.current,eP.current,t);
    if(cRef.current){cRef.current.target.lerpVectors(sT.current,eT.current,t);cRef.current.update();}
  });

  return(
    <OrbitControls ref={cRef} enableDamping dampingFactor={0.06}
      minDistance={40} maxDistance={6000} maxPolarAngle={Math.PI/2.1}
      autoRotate autoRotateSpeed={0.1} target={[0,30,0]}/>
  );
}

// ─── HOVER TOOLTIP ────────────────────────────────────────────

function HoverTooltip({b,sx,sy}:{b:PlacedBld|null;sx:number;sy:number}){
  if(!b)return null;
  const dist=DISTRICTS.find(d=>d.id===b.districtId);
  return(
    <div style={{position:"fixed",left:sx+16,top:sy-12,background:"rgba(3,0,0,0.94)",color:"white",padding:"10px 14px",borderRadius:10,border:"1px solid #440000",fontFamily:"'Courier New',monospace",fontSize:12,pointerEvents:"none",zIndex:60,boxShadow:"0 0 24px rgba(180,0,0,0.45)",backdropFilter:"blur(10px)",maxWidth:220}}>
      {b.avatar_url&&<img src={b.avatar_url} alt="" style={{width:36,height:36,borderRadius:"50%",border:"2px solid #cc0000",display:"block",marginBottom:8}}/>}
      <div style={{fontWeight:700,fontSize:14,marginBottom:2}}>{b.channel_name??b.handle}</div>
      <div style={{color:"#cc4444",marginBottom:5,fontSize:11}}>@{b.handle}</div>
      <div style={{color:"#aaa",fontSize:11,marginBottom:2}}>{fmt(b.subscriber_count)} subscribers</div>
      <div style={{display:"inline-block",background:dist?.color??"#ff4400",color:"#000",padding:"2px 8px",borderRadius:10,fontSize:9,fontWeight:700,letterSpacing:1}}>{dist?.label}</div>
    </div>
  );
}


// ─── CLAIM MODAL ──────────────────────────────────────────────

function ClaimModal({b,onClose}:{b:any;onClose:()=>void}){
  const[email,setEmail]=useState("");
  const[sent,setSent]=useState(false);
  const[loading,setLoading]=useState(false);
  const[err,setErr]=useState("");

  const submit=async()=>{
    if(!email.includes("@")){setErr("Enter a valid email");return;}
    setLoading(true);setErr("");
    try{
      await fetch("/api/claim",{
        method:"POST",
        headers:{"Content-Type":"application/json"},
        body:JSON.stringify({
          email,
          handle:b.handle,
          channel_name:b.channel_name,
          subscriber_count:b.subscriber_count,
          type:"claim"
        })
      });
      setSent(true);
    }catch{setErr("Something went wrong");}
    finally{setLoading(false);}
  };

  return(
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.7)",zIndex:90,display:"flex",alignItems:"center",justifyContent:"center",backdropFilter:"blur(6px)"}}
      onClick={onClose}>
      <div style={{background:"rgba(4,0,0,0.98)",border:"1px solid #886600",borderRadius:14,padding:"28px 30px",width:"min(360px,90vw)",fontFamily:"'Courier New',monospace",boxShadow:"0 0 60px rgba(200,150,0,0.3)"}}
        onClick={e=>e.stopPropagation()}>
        <button onClick={onClose} style={{position:"absolute",top:14,right:16,background:"none",border:"none",color:"#cc0000",fontSize:18,cursor:"pointer"}}>✕</button>

        {!sent?(
          <>
            <div style={{fontSize:10,color:"#ffd700",letterSpacing:3,marginBottom:6}}>⭐ CLAIM YOUR BUILDING</div>
            <div style={{fontSize:18,fontWeight:700,color:"white",marginBottom:4}}>{b.channel_name||b.handle}</div>
            <div style={{fontSize:11,color:"#888",marginBottom:16}}>@{b.handle}</div>

            <div style={{fontSize:11,color:"#ccbbaa",lineHeight:1.7,marginBottom:20}}>
              Claim your building to:<br/>
              • Pin your channel to your exact spot<br/>
              • Customize your building colour & style<br/>
              • Get a shareable <span style={{color:"#ffd700"}}>tubecity.io/c/{b.handle}</span> link<br/>
              • First access to Prime District
            </div>

            <div style={{fontSize:9,color:"#886600",letterSpacing:2,marginBottom:6}}>YOUR EMAIL</div>
            <input
              value={email}
              onChange={e=>setEmail(e.target.value)}
              onKeyDown={e=>e.key==="Enter"&&submit()}
              placeholder="you@example.com"
              style={{width:"100%",background:"rgba(20,10,0,0.8)",border:"1px solid #554400",borderRadius:8,padding:"10px 12px",color:"white",fontSize:13,fontFamily:"'Courier New',monospace",outline:"none",boxSizing:"border-box",marginBottom:8}}
            />
            {err&&<div style={{fontSize:11,color:"#ff4444",marginBottom:8}}>{err}</div>}
            <button onClick={submit} disabled={loading}
              style={{width:"100%",padding:"11px",background:loading?"#2a1400":"#886600",border:"none",borderRadius:8,color:"#ffd700",fontFamily:"'Courier New',monospace",fontSize:12,letterSpacing:2,cursor:loading?"default":"pointer",fontWeight:700}}>
              {loading?"SAVING...":"JOIN WAITLIST →"}
            </button>
            <div style={{fontSize:9,color:"#555",textAlign:"center",marginTop:10}}>No spam. We'll email when claiming goes live.</div>
          </>
        ):(
          <div style={{textAlign:"center",padding:"20px 0"}}>
            <div style={{fontSize:32,marginBottom:12}}>🏙️</div>
            <div style={{fontSize:16,fontWeight:700,color:"#ffd700",marginBottom:8}}>You're on the list!</div>
            <div style={{fontSize:11,color:"#ccbbaa",lineHeight:1.7,marginBottom:16}}>
              We'll email you at <span style={{color:"white"}}>{email}</span> when building claims go live.<br/>
              Your spot in the city is reserved.
            </div>
            <div style={{fontSize:11,color:"#888"}}>Share TubeCity with other creators while you wait:</div>
            <button onClick={()=>{
              navigator.clipboard?.writeText(`${window.location.origin}/c/${b.handle}`).catch(()=>{});
            }} style={{marginTop:10,padding:"8px 20px",background:"rgba(0,80,150,0.2)",border:"1px solid #004488",borderRadius:8,color:"#44aaff",fontFamily:"'Courier New',monospace",fontSize:11,cursor:"pointer"}}>
              🔗 Copy my building link
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── STATS PANEL ─────────────────────────────────────────────

function StatsPanel({b,onClose,onRefresh}:{b:PlacedBld;onClose:()=>void;onRefresh:(h:string)=>void}){
  const dist=DISTRICTS.find(d=>d.id===b.districtId)??DISTRICTS[4];
  const key=Object.keys(CPM).find(k=>b.niche.toLowerCase().includes(k))??"entertainment";
  const[cl,ch]=CPM[key];
  const avg=b.subscriber_count*0.04;
  const low=Math.round(avg*cl/1000),high=Math.round(avg*ch/1000);
  const [refreshing,setRefreshing]=useState(false);

  const doRefresh=async()=>{
    setRefreshing(true);
    await onRefresh(b.handle);
    setRefreshing(false);
  };

  return(
    <div style={{position:"fixed",bottom:56,right:24,background:"rgba(3,0,0,0.97)",color:"white",padding:"22px 26px",borderRadius:14,width:320,backdropFilter:"blur(20px)",border:"1px solid #440000",boxShadow:"0 0 60px rgba(200,0,0,0.5),inset 0 0 40px rgba(60,0,0,0.12)",fontFamily:"'Courier New',monospace",zIndex:50}}>
      <button onClick={onClose} style={{position:"absolute",top:14,right:16,background:"none",border:"none",color:"#cc0000",fontSize:22,cursor:"pointer",lineHeight:1}}>✕</button>

      <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:14}}>
        {b.avatar_url&&<img src={b.avatar_url} alt="" style={{width:44,height:44,borderRadius:"50%",border:"2px solid #cc0000",flexShrink:0}}/>}
        <div>
          <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:3}}>
            <div style={{width:8,height:8,borderRadius:"50%",background:dist.color,boxShadow:`0 0 8px ${dist.color}`}}/>
            <span style={{fontSize:9,color:dist.color,letterSpacing:3}}>{dist.label}</span>
            {b.is_verified&&<span style={{fontSize:11}}>✅</span>}
          </div>
          <div style={{fontSize:9,color:"#550000",letterSpacing:3}}>CHANNEL INTEL</div>
        </div>
      </div>

      <div style={{fontSize:18,fontWeight:700,lineHeight:1.2,marginBottom:3}}>{b.channel_name??b.handle}</div>
      <div style={{fontSize:12,color:"#ffcc44",marginBottom:16}}>@{b.handle}</div>

      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:16}}>
        {[["SUBSCRIBERS",fmt(b.subscriber_count)],["VIDEOS",(b.video_count??0).toLocaleString()],["NICHE",b.niche.toUpperCase()],["UPLOADS/30D",`${b.recent_upload_count_30d??0}`]].map(([l,v])=>(
          <div key={l} style={{background:"rgba(150,0,0,0.09)",padding:"9px 11px",borderRadius:8,border:"1px solid #200000"}}>
            <div style={{fontSize:8,color:"#ff8844",letterSpacing:2,marginBottom:3}}>{l}</div>
            <div style={{fontSize:14,fontWeight:700,color:"#ffffff"}}>{v}</div>
          </div>
        ))}
      </div>

      <div style={{borderTop:"1px solid #250000",paddingTop:14,marginBottom:14}}>
        <div style={{fontSize:9,color:"#ffaa44",letterSpacing:2,marginBottom:8}}>💰 ESTIMATED SPONSOR VALUE</div>
        <div style={{fontSize:26,fontWeight:900,color:"#ff2222"}}>${low.toLocaleString()} – ${high.toLocaleString()}</div>
        <div style={{fontSize:10,color:"#555",marginTop:5}}>per video · {b.niche} CPM · ~{fmt(Math.round(avg))} avg views</div>
      </div>

      <div style={{display:"flex",gap:6,marginBottom:8}}>
        <button onClick={doRefresh} disabled={refreshing} style={{flex:1,padding:"8px",background:refreshing?"rgba(60,0,0,0.4)":"rgba(150,0,0,0.15)",border:"1px solid #440000",borderRadius:8,color:refreshing?"#553333":"#ff4444",fontFamily:"'Courier New',monospace",fontSize:10,letterSpacing:1,cursor:refreshing?"default":"pointer"}}>
          {refreshing?"FETCHING...":"↻ REFRESH"}
        </button>
        <button onClick={()=>{
          const url=`${window.location.origin}/c/${b.handle}`;
          navigator.clipboard?.writeText(url).catch(()=>{});
          setShareCopied(true);
          setTimeout(()=>setShareCopied(false),2500);
        }} style={{flex:1,padding:"8px",background:"rgba(0,80,150,0.15)",border:"1px solid #004488",borderRadius:8,color:"#44aaff",fontFamily:"'Courier New',monospace",fontSize:10,letterSpacing:1,cursor:"pointer"}}>
          {shareCopied?"✓ COPIED!":"🔗 SHARE"}
        </button>
      </div>
      <button onClick={()=>setShowClaim(true)} style={{width:"100%",padding:"9px",background:"rgba(180,130,0,0.15)",border:"1px solid #886600",borderRadius:8,color:"#ffd700",fontFamily:"'Courier New',monospace",fontSize:11,letterSpacing:2,cursor:"pointer",marginBottom:4}}>
        ⭐ CLAIM THIS BUILDING
      </button>
      {showClaim&&<ClaimModal b={b} onClose={()=>setShowClaim(false)}/>}

      {(b.recent_upload_count_30d??0)>5&&<div style={{marginTop:10,fontSize:11,color:"#ff8800"}}>🔥 Very active — {b.recent_upload_count_30d} uploads this month</div>}
    </div>
  );
}

// ─── PRIME BANNER ────────────────────────────────────────────

function PrimeBanner(){
  const[show,setShow]=useState(true);
  if(!show)return null;
  return(
    <div style={{position:"fixed",bottom:56,left:24,background:"rgba(3,0,0,0.97)",color:"white",padding:"20px 24px",borderRadius:14,width:280,border:"1px solid #886600",boxShadow:"0 0 40px rgba(255,200,0,0.2)",fontFamily:"'Courier New',monospace",zIndex:50}}>
      <button onClick={()=>setShow(false)} style={{position:"absolute",top:12,right:14,background:"none",border:"none",color:"#cc0000",fontSize:18,cursor:"pointer"}}>✕</button>
      <div style={{fontSize:10,color:"#ffd700",letterSpacing:3,marginBottom:8}}>⭐ PRIME DISTRICT</div>
      <div style={{fontSize:14,fontWeight:700,marginBottom:8,lineHeight:1.4}}>Own the centre of TubeCity</div>
      <div style={{fontSize:11,color:"#ccbbaa",lineHeight:1.7,marginBottom:14}}>Prime spots sit at the heart of the city — visible to every visitor, regardless of subscriber count.</div>
      <div style={{fontSize:20,fontWeight:900,color:"#ffd700",marginBottom:14}}>$49 / month</div>
      <div style={{padding:"10px",background:"rgba(180,140,0,0.1)",borderRadius:8,border:"1px solid #554400",fontSize:10,color:"#ccaa00",textAlign:"center",letterSpacing:2,cursor:"pointer"}}>
        COMING SOON — JOIN WAITLIST
      </div>
    </div>
  );
}

// ─── SEARCH ──────────────────────────────────────────────────

function Search({onFound}:{onFound:(c:any)=>void}){
  const[q,setQ]=useState("");const[loading,setL]=useState(false);const[err,setE]=useState("");
  const go=async()=>{
    if(!q.trim())return;setL(true);setE("");
    try{const h=q.trim().replace(/^@/,"");const r=await fetch(`/api/channel?handle=${encodeURIComponent(h)}`);const d=await r.json();if(d.channel){onFound(d.channel);setQ("");}else setE("Not found");}
    catch{setE("Error");}finally{setL(false);}
  };
  return(
    <div style={{display:"flex",alignItems:"center",gap:8,background:"rgba(5,0,0,0.92)",padding:"9px 18px",borderRadius:40,border:"1px solid #440000",backdropFilter:"blur(12px)",boxShadow:"0 0 20px rgba(150,0,0,0.25)"}}>
      <span style={{color:"#cc0000",fontSize:14}}>▶</span>
      <input value={q} onChange={e=>setQ(e.target.value)} onKeyDown={e=>e.key==="Enter"&&go()} placeholder="Search @channel to add..."
        style={{background:"transparent",border:"none",outline:"none",color:"white",fontSize:13,width:210,fontFamily:"'Courier New',monospace"}}/>
      <button onClick={go} disabled={loading} style={{background:loading?"#2a0000":"#cc0000",border:"none",color:"white",padding:"5px 16px",borderRadius:20,cursor:"pointer",fontWeight:700,fontSize:11,letterSpacing:1,transition:"background 0.2s"}}>
        {loading?"...":"GO"}
      </button>
      {err&&<span style={{color:"#ff4444",fontSize:11}}>{err}</span>}
    </div>
  );
}

// ─── TICKER ──────────────────────────────────────────────────

const TICKS=["🏙️ TUBE CITY — every YouTube channel is a skyscraper","⭐ PRIME DISTRICT — own the centre spot for $49/month · coming soon","📐 HEIGHT = subscribers  ·  WIDTH = videos  ·  GLOW = recent uploads","🚚 AD SPACE COMING SOON — lorries & billboards carry your brand","💰 Click any building for live sponsorship estimates","🏆 Verified channels get a crown  ·  🔥 Active uploaders glow bright","🔍 Search any @handle to add a channel to the skyline","🌆 MEGACITY = 10M+  ·  MID-CITY = 1M+  ·  RISING = 100K+"];
function Ticker(){
  const[i,setI]=useState(0);const[v,setV]=useState(true);
  useEffect(()=>{const t=setInterval(()=>{setV(false);setTimeout(()=>{setI(x=>(x+1)%TICKS.length);setV(true);},500);},5500);return()=>clearInterval(t);},[]);
  return(
    <div style={{position:"fixed",bottom:0,left:0,right:0,zIndex:40,background:"rgba(2,0,0,0.95)",borderTop:"1px solid #220000",padding:"8px 22px",fontFamily:"'Courier New',monospace",fontSize:12,color:"#dd4444",display:"flex",alignItems:"center",gap:18,backdropFilter:"blur(8px)"}}>
      <span style={{color:"#400000",letterSpacing:2,fontSize:10,whiteSpace:"nowrap",borderRight:"1px solid #280000",paddingRight:18}}>▶ LIVE</span>
      <span style={{transition:"opacity 0.5s",opacity:v?1:0,letterSpacing:0.5}}>{TICKS[i]}</span>
    </div>
  );
}

// ─── LOADING ─────────────────────────────────────────────────

const SKYLINE_HEIGHTS=[47, 58, 2, 10, 83, 70, 7, 4, 53, 22, 56, 40, 25, 2, 54, 13, 63, 41, 11, 32, 92, 47, 18, 14, 56, 3, 64, 18, 30, 18, 54, 13, 68, 21, 9, 56, 90, 21, 19, 33, 48, 29, 61, 3, 25, 37, 43, 38, 63, 3, 2, 76, 78, 0, 10, 48, 31, 50, 48, 20];

function Loading({prg,n}:{prg:number;n:number}){
  const msgs=["FETCHING CHANNELS...","LAYING OUT DISTRICTS...","BUILDING SKYLINE...","WELCOME TO TUBE CITY"];
  const mi=prg<0.3?0:prg<0.65?1:prg<1?2:3;
  prg<0.3?0:prg<0.65?1:prg<1?2:3;  return(
    <div style={{position:"fixed",inset:0,background:"#020000",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",zIndex:100,fontFamily:"'Courier New',monospace"}}>
      <div style={{position:"absolute",bottom:0,left:0,right:0,height:180,overflow:"hidden"}}>
        {SKYLINE_HEIGHTS.map((h,i)=><div key={i} style={{position:"absolute",bottom:0,left:`${i*1.67}%`,width:"1.5%",height:h,background:"#140000",borderTop:"1px solid #260000"}}/>)}</div>
      <div style={{textAlign:"center",zIndex:1}}>
        <div style={{fontSize:56,fontWeight:900,letterSpacing:16,color:"#cc0000",marginBottom:8,textShadow:"0 0 60px rgba(255,0,0,0.55)"}}>TUBE CITY</div>
        <div style={{fontSize:11,color:"#aaaaaa",letterSpacing:4,marginBottom:6}}>
          {n>0?`POPULATING ${n} CHANNELS`:"CONNECTING TO YOUTUBE..."}
        </div>
        <div style={{fontSize:10,color:"#555",letterSpacing:3,marginBottom:36}}>THE WORLD'S FIRST 3D YOUTUBE CHANNEL CITY</div>
        <div style={{width:420,height:2,background:"#140000",borderRadius:2,overflow:"hidden",margin:"0 auto 18px"}}>
          <div style={{height:"100%",background:"linear-gradient(to right,#660000,#ff2200,#ff8800)",width:`${prg*100}%`,transition:"width 0.5s",boxShadow:"0 0 16px #ff2200"}}/>
        </div>
        <div style={{fontSize:10,color:"#555555",letterSpacing:4}}>{msgs[mi]}</div>
      </div>
    </div>
  );
}


// ─── FLY MODE ─────────────────────────────────────────────────
const _flyFwd=new THREE.Vector3();

function FlyScene({onExit,onHud}:{onExit:()=>void;onHud:(spd:number,alt:number)=>void}){
  const{camera}=useThree();
  const keys=useRef<Record<string,boolean>>({});
  const yaw=useRef(0);
  const pos=useRef(new THREE.Vector3(0,120,400));
  const spd=useRef(25);
  const camPos=useRef(new THREE.Vector3(0,140,450));
  const hudT=useRef(0);
  const planeRef=useRef<THREE.Group>(null);

  useEffect(()=>{
    camera.position.set(0,135,455);
    const dn=(e:KeyboardEvent)=>{
      keys.current[e.code]=true;
      if(e.code==="Escape")onExit();
      if(e.code==="Space")e.preventDefault();
    };
    const up=(e:KeyboardEvent)=>{keys.current[e.code]=false;};
    const wh=(e:WheelEvent)=>{spd.current=Math.max(5,Math.min(200,spd.current-e.deltaY*0.04));};
    window.addEventListener("keydown",dn);window.addEventListener("keyup",up);
    window.addEventListener("wheel",wh,{passive:true});
    return()=>{window.removeEventListener("keydown",dn);window.removeEventListener("keyup",up);window.removeEventListener("wheel",wh);};
  },[camera,onExit]);

  useFrame((_,dt)=>{
    const k=keys.current;const d=Math.min(dt,0.05);
    if(k["KeyA"]||k["ArrowLeft"])yaw.current+=2.0*d;
    if(k["KeyD"]||k["ArrowRight"])yaw.current-=2.0*d;
    if(k["KeyW"]||k["ArrowUp"])pos.current.y=Math.min(800,pos.current.y+55*d);
    if(k["KeyS"]||k["ArrowDown"])pos.current.y=Math.max(20,pos.current.y-55*d);
    const boost=k["ShiftLeft"]||k["ShiftRight"];
    const slow=k["AltLeft"]||k["KeyZ"];
    const stop=k["Space"];
    if(stop)spd.current=Math.max(0,spd.current-120*d);
    else if(boost)spd.current=Math.min(200,spd.current+90*d);
    else if(slow)spd.current=Math.max(5,spd.current-60*d);
    else spd.current=Math.max(25,spd.current-8*d);
    _flyFwd.set(-Math.sin(yaw.current),0,-Math.cos(yaw.current));
    pos.current.addScaledVector(_flyFwd,spd.current*d);
    if(Math.abs(pos.current.x)>950)pos.current.x*=-0.98;
    if(Math.abs(pos.current.z)>950)pos.current.z*=-0.98;
    const cd=40+spd.current*0.15;
    const tx=pos.current.x+Math.sin(yaw.current)*cd;
    const tz=pos.current.z+Math.cos(yaw.current)*cd;
    camPos.current.x+=(tx-camPos.current.x)*3.5*d;
    camPos.current.y+=(pos.current.y+16-camPos.current.y)*2.5*d;
    camPos.current.z+=(tz-camPos.current.z)*3.5*d;
    camera.position.copy(camPos.current);
    camera.lookAt(pos.current.x,pos.current.y+2,pos.current.z);
    if(planeRef.current){planeRef.current.position.copy(pos.current);planeRef.current.rotation.y=yaw.current;}
    hudT.current+=d;
    if(hudT.current>0.18){hudT.current=0;onHud(spd.current,pos.current.y);}
  });

  return(
    <group ref={planeRef}>
      <mesh rotation={[0,Math.PI/2,Math.PI/2]}>
        <coneGeometry args={[0.9,6,4]}/>
        <meshStandardMaterial color="#ffcc00" emissive="#ffaa00" emissiveIntensity={1.0} metalness={0.9}/>
      </mesh>
      <mesh position={[-4,0,0.5]} rotation={[0,0,0.25]}>
        <boxGeometry args={[7,0.3,2.5]}/>
        <meshStandardMaterial color="#ff8800" emissive="#ff6600" emissiveIntensity={0.5}/>
      </mesh>
      <mesh position={[4,0,0.5]} rotation={[0,0,-0.25]}>
        <boxGeometry args={[7,0.3,2.5]}/>
        <meshStandardMaterial color="#ff8800" emissive="#ff6600" emissiveIntensity={0.5}/>
      </mesh>
      <mesh position={[0,1.2,2.5]}>
        <boxGeometry args={[0.25,2.5,2]}/>
        <meshStandardMaterial color="#cc4400" emissive="#cc3300" emissiveIntensity={0.4}/>
      </mesh>
    </group>
  );
}

function FlyHUD({speed,altitude,onExit}:{speed:number;altitude:number;onExit:()=>void}){
  return(
    <div style={{position:"fixed",inset:0,pointerEvents:"none",zIndex:45,fontFamily:"'Courier New',monospace"}}>
      <div style={{position:"absolute",top:"50%",left:"50%",transform:"translate(-50%,-50%)",width:28,height:28}}>
        <div style={{position:"absolute",top:"50%",left:0,right:0,height:1,background:"rgba(255,200,0,0.75)"}}/>
        <div style={{position:"absolute",left:"50%",top:0,bottom:0,width:1,background:"rgba(255,200,0,0.75)"}}/>
        <div style={{position:"absolute",top:"50%",left:"50%",width:7,height:7,transform:"translate(-50%,-50%)",border:"1.5px solid rgba(255,210,0,0.9)",borderRadius:"50%"}}/>
      </div>
      <div style={{position:"absolute",bottom:60,left:24,background:"rgba(3,0,0,0.88)",border:"1px solid #886600",borderRadius:10,padding:"12px 18px",color:"#ffcc66"}}>
        <div style={{fontSize:9,letterSpacing:3,color:"#886600",marginBottom:8}}>FLIGHT DATA</div>
        <div style={{fontSize:15,fontWeight:700,marginBottom:4}}>SPD&nbsp;<span style={{color:"#ffd700",fontSize:18}}>{speed}</span><span style={{fontSize:9,color:"#888"}}>&nbsp;km/h</span></div>
        <div style={{fontSize:15,fontWeight:700}}>ALT&nbsp;<span style={{color:"#ffd700",fontSize:18}}>{altitude}</span><span style={{fontSize:9,color:"#888"}}>&nbsp;m</span></div>
      </div>
      <div style={{position:"absolute",bottom:60,right:24,background:"rgba(3,0,0,0.88)",border:"1px solid #440000",borderRadius:10,padding:"12px 18px",color:"#ffffff",fontSize:11,lineHeight:2.0}}>
        <div style={{color:"#ff8844",letterSpacing:2,fontSize:9,marginBottom:6}}>CONTROLS</div>
        <div><span style={{color:"#ffd700"}}>W/S</span> — Climb / Descend</div>
        <div><span style={{color:"#ffd700"}}>A/D</span> — Turn Left / Right</div>
        <div><span style={{color:"#ffd700"}}>SHIFT</span> — Boost</div>
        <div><span style={{color:"#ffd700"}}>SPACE</span> — Full stop</div>
        <div><span style={{color:"#ffd700"}}>Z/ALT</span> — Slow down</div>
        <div style={{marginTop:10,pointerEvents:"auto"}}>
          <button onClick={onExit} style={{width:"100%",background:"#cc0000",border:"none",color:"white",padding:"6px 14px",borderRadius:6,cursor:"pointer",fontFamily:"'Courier New',monospace",fontSize:11,letterSpacing:1}}>ESC · EXIT FLY</button>
        </div>
      </div>
      <div style={{position:"absolute",top:76,left:"50%",transform:"translateX(-50%)",background:"rgba(3,0,0,0.82)",border:"1px solid #ffd70044",borderRadius:20,padding:"5px 22px",color:"#ffd700",fontSize:11,letterSpacing:3}}>✈ FLY MODE</div>
    </div>
  );
}

// ─── MAIN PAGE ────────────────────────────────────────────────

export default function Home(){
  const[channels,setChannels]=useState<ChData[]>([]);
  const[buildings,setBuildings]=useState<PlacedBld[]>([]);
  const[atlas,setAtlas]=useState<THREE.CanvasTexture|null>(null);
  const[loading,setLoading]=useState(true);
  const[prg,setPrg]=useState(0);
  const[showCity,setShowCity]=useState(false);
  const[selBld,setSelBld]=useState<PlacedBld|null>(null);
  const[hoverBld,setHoverBld]=useState<PlacedBld|null>(null);
  const[hoverPos,setHoverPos]=useState({x:0,y:0});
  const[focusHandle,setFocusHandle]=useState<string|null>(null);
  const[focusTgt,setFocusTgt]=useState<[number,number,number]|null>(null);
  const[totalSubs,setTotalSubs]=useState(0);
  const[flyMode,setFlyMode]=useState(false);
  const searchParams=useSearchParams();
  const[flySpeed,setFlySpeed]=useState(0);
  const[flyAlt,setFlyAlt]=useState(0);
  const[showBrand,setShowBrand]=useState(false);
  const[showNexLev,setShowNexLev]=useState(false);

  useEffect(()=>{
    const tick=setInterval(()=>setPrg(p=>Math.min(p+0.05,0.88)),180);
    fetch("/api/channels").then(r=>r.json()).then((data:any[])=>{
      clearInterval(tick);if(!Array.isArray(data))return;
      setChannels(data);setTotalSubs(data.reduce((s,c)=>s+(c.subscriber_count??0),0));
      setPrg(0.94);const laid=layoutCity(data);setBuildings(laid);setPrg(1);
      setTimeout(()=>{setLoading(false);setShowCity(true);},800);
    }).catch(()=>{clearInterval(tick);setLoading(false);});
    return()=>clearInterval(tick);
  },[]);

  useEffect(()=>{if(showCity&&!atlas)setAtlas(createAtlas());},[showCity,atlas]);

  // Auto-fly to channel from URL param e.g. tubecity.io/c/MrBeast → /?channel=MrBeast
  useEffect(()=>{
    if(!showCity||buildings.length===0)return;
    const ch=searchParams?.get("channel");
    if(!ch)return;
    const handle=ch.replace(/^@/,"");
    // Try to find in existing buildings first
    const existing=buildings.find(b=>b.handle.toLowerCase()===handle.toLowerCase());
    if(existing){
      setSelBld(existing);setFocusHandle(existing.handle);
      setFocusTgt([existing.x,existing.height/2,existing.z]);
    }else{
      // Fetch from API and add to city
      fetch(`/api/channel?handle=${encodeURIComponent(handle)}`)
        .then(r=>r.json()).then(data=>{if(data.channel)handleSearch(data.channel);})
        .catch(console.error);
    }
  },[showCity,buildings,searchParams]);

  const handleClick=useCallback((b:PlacedBld)=>{setSelBld(b);setFocusHandle(b.handle);setFocusTgt([b.x,b.height/2,b.z]);},[]);
  const handleHover=useCallback((b:PlacedBld|null,sx:number,sy:number)=>{setHoverBld(b);setHoverPos({x:sx,y:sy});},[]);

  const handleRefresh=useCallback(async(handle:string)=>{
    try{
      const r=await fetch(`/api/channel?handle=${encodeURIComponent(handle)}`);
      const d=await r.json();if(!d.channel)return;
      const fresh=d.channel;
      setChannels(prev=>prev.map(c=>c.handle.toLowerCase()===handle.toLowerCase()?{...c,subscriber_count:fresh.subscriber_count??c.subscriber_count,video_count:fresh.video_count??c.video_count,recent_upload_count_30d:fresh.recent_upload_count_30d??c.recent_upload_count_30d}:c));
    }catch(e){console.error(e);}
  },[]);

  const handleSearch=useCallback((ch:any)=>{
    if(!ch)return;
    const newCh:ChData={id:ch.id??ch.youtube_id,handle:(ch.handle??"").replace(/^@/,""),channel_name:ch.channel_name??null,subscriber_count:ch.subscriber_count??0,video_count:ch.video_count??0,recent_upload_count_30d:ch.recent_upload_count_30d??0,category:ch.category??null,is_verified:ch.is_verified??false,avatar_url:ch.avatar_url??null,total_view_count:ch.total_view_count??0};
    setChannels(prev=>{
      if(prev.find(c=>c.handle.toLowerCase()===newCh.handle.toLowerCase())){
        const b=buildings.find(b=>b.handle.toLowerCase()===newCh.handle.toLowerCase());
        if(b){setSelBld(b);setFocusHandle(b.handle);setFocusTgt([b.x,b.height/2,b.z]);}
        return prev;
      }
      const updated=[...prev,newCh];const laid=layoutCity(updated);setBuildings(laid);
      const found=laid.find(b=>b.handle.toLowerCase()===newCh.handle.toLowerCase());
      if(found){setSelBld(found);setFocusHandle(found.handle);setFocusTgt([found.x,found.height/2,found.z]);}
      return updated;
    });
  },[buildings]);

  // Billboard positions around the city
  return(
    <div style={{width:"100vw",height:"100vh",background:"#020000",overflow:"hidden"}}>
      {loading&&<Loading prg={prg} n={channels.length}/>}

      {showCity&&atlas&&(
        <Canvas camera={{position:[0,300,560],fov:46}} shadows
          gl={{antialias:true,toneMapping:THREE.ACESFilmicToneMapping,toneMappingExposure:0.85}}>
          <fog attach="fog" args={["#060000",800,6000]}/>
          <ambientLight intensity={2.2} color="#cc2211"/>
          <pointLight position={[0,300,0]} intensity={1.4} color="#ff2200"/>
          <pointLight position={[-300,150,300]} intensity={0.6} color="#cc1100"/>
          <pointLight position={[300,150,-300]} intensity={0.55} color="#dd1100"/>
          <directionalLight position={[150,250,100]} intensity={0.7} castShadow color="#cc2200"
            shadow-mapSize-width={2048} shadow-mapSize-height={2048}/>
          <Stars radius={1000} depth={100} count={2000} factor={4} saturation={0} fade speed={0.3}/>
          <Atmosphere/>
          <CityGround/>
          <DistrictRings/>
          <PrimeBeacon/>
          <PrimeSlots/>
          <Vehicles/>
          {buildings.length>0&&(
            <>
              <InstancedCity buildings={buildings} atlas={atlas} focusHandle={focusHandle} onBuildingClick={handleClick} onHoverChange={handleHover}/>
            </>
          )}
          {!flyMode&&<OrbitScene target={focusTgt}/>}
          {flyMode&&<FlyScene onExit={()=>setFlyMode(false)} onHud={(s,a)=>{setFlySpeed(Math.round(s));setFlyAlt(Math.round(a));}}/>}
        </Canvas>
      )}

      {flyMode&&<FlyHUD speed={flySpeed} altitude={flyAlt} onExit={()=>setFlyMode(false)}/>}
      {/* Top bar */}
      {showCity&&(
        <div style={{position:"fixed",top:0,left:0,right:0,zIndex:40,display:"flex",alignItems:"center",justifyContent:"space-between",padding:"12px 22px",background:"linear-gradient(to bottom,rgba(2,0,0,0.97) 0%,transparent 100%)",pointerEvents:"none"}}>
          <div style={{pointerEvents:"auto"}}>
            <div style={{fontSize:22,fontWeight:900,color:"#cc0000",letterSpacing:5,fontFamily:"'Courier New',monospace",textShadow:"0 0 30px rgba(255,0,0,0.5)"}}>TUBE CITY</div>
            <div style={{fontSize:11,color:"#cccccc",letterSpacing:2,fontFamily:"'Courier New',monospace",marginTop:2}}>
              {channels.length} channels · {fmt(totalSubs)} total subscribers
            </div>
          </div>
          <div style={{pointerEvents:"auto"}}><Search onFound={handleSearch}/></div>
          <div style={{display:"flex",gap:8,pointerEvents:"auto"}}>
            <button onClick={()=>setFlyMode(false)} style={{background:"rgba(20,0,0,0.85)",border:"1px solid #440000",color:"#ff6644",padding:"7px 18px",borderRadius:6,cursor:"pointer",fontFamily:"'Courier New',monospace",fontSize:11,letterSpacing:1}}>EXPLORE</button>
            <button onClick={()=>setFlyMode(true)} style={{background:"rgba(20,0,0,0.85)",border:"1px solid #ffd70055",color:"#ffd700",padding:"7px 18px",borderRadius:6,cursor:"pointer",fontFamily:"'Courier New',monospace",fontSize:11,letterSpacing:1}}>✈ FLY</button>
            <button onClick={()=>setShowBrand(true)} style={{background:"rgba(20,8,0,0.85)",border:"1px solid #ffd70055",color:"#ffd700",padding:"7px 18px",borderRadius:6,cursor:"pointer",fontFamily:"'Courier New',monospace",fontSize:11,letterSpacing:1}}>🎯 BRANDS</button>
            <button onClick={()=>setShowNexLev(true)} style={{background:"rgba(20,5,0,0.85)",border:"1px solid #ff440055",color:"#ff8844",padding:"7px 18px",borderRadius:6,cursor:"pointer",fontFamily:"'Courier New',monospace",fontSize:11,letterSpacing:1}}>🔍 TUBEFINDER</button>
          </div>
        </div>
      )}

      <HoverTooltip b={hoverBld} sx={hoverPos.x} sy={hoverPos.y}/>
            {selBld&&!flyMode&&<StatsPanel b={selBld} onClose={()=>{setSelBld(null);setFocusHandle(null);setFocusTgt(null);}} onRefresh={handleRefresh}/>}
            {showCity&&!selBld&&!flyMode&&<PrimeBanner/>}
      {showBrand&&(
        <BrandSearch
          channels={buildings.map(b=>({
            handle:b.handle,channel_name:b.channel_name,
            subscriber_count:b.subscriber_count,video_count:b.video_count,
            recent_upload_count_30d:b.recent_upload_count_30d,
            category:b.category,is_verified:b.is_verified,
            niche:b.niche,litPct:b.litPct,districtId:b.districtId,
          }))}
          onSelectChannel={(handle)=>{
            const b=buildings.find(x=>x.handle.toLowerCase()===handle.toLowerCase());
            if(b){setSelBld(b);setFocusHandle(b.handle);setFocusTgt([b.x,b.height/2,b.z]);}
          }}
          onClose={()=>setShowBrand(false)}
        />
      )}
      {showNexLev&&(
        <NexLevPanel
          channels={buildings.map(b=>({
            handle:b.handle,channel_name:b.channel_name,
            subscriber_count:b.subscriber_count,video_count:b.video_count,
            recent_upload_count_30d:b.recent_upload_count_30d,
            category:b.category,is_verified:b.is_verified,
            niche:b.niche,litPct:b.litPct,districtId:b.districtId,
            total_view_count:b.xp_total,
          }))}
          onSelectChannel={(handle)=>{
            const b=buildings.find(x=>x.handle.toLowerCase()===handle.toLowerCase());
            if(b){setSelBld(b);setFocusHandle(b.handle);setFocusTgt([b.x,b.height/2,b.z]);}
          }}
          onClose={()=>setShowNexLev(false)}
        />
      )}
      {showCity&&<Ticker/>}
    </div>
  );
}
