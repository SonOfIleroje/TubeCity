"use client";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, Stars } from "@react-three/drei";
import { MovingVehicles } from "@/components/MovingVehicles";
import type { CityBuilding } from "@/types";

// Building3D / CityScene / InstancedBuildings / EffectsLayer all import the
// BuildingColors type from this file — restored here after it was gutted
// down to a stub, which broke the type for every consumer.
export interface BuildingColors {
  windowLit: string[];
  windowOff: string;
  face: string;
  roof: string;
  accent: string;
}

export interface CityTheme {
  name: string;
  sky: [number, string][];
  fogColor: string;
  fogNear: number;
  fogFar: number;
  ambientColor: string;
  ambientIntensity: number;
  sunColor: string;
  sunIntensity: number;
  sunPos: [number, number, number];
  fillColor: string;
  fillIntensity: number;
  fillPos: [number, number, number];
  hemiSky: string;
  hemiGround: string;
  hemiIntensity: number;
  groundColor: string;
  grid1: string;
  grid2: string;
  roadMarkingColor: string;
  sidewalkColor: string;
  building: BuildingColors;
  waterColor: string;
  waterEmissive: string;
  dockColor: string;
}

export const THEMES: CityTheme[] = [
  {
    name: "TubeCity Red",
    sky: [
      [0, "#020000"],
      [0.15, "#080000"],
      [0.3, "#120000"],
      [0.45, "#1c0000"],
      [0.55, "#220000"],
      [0.65, "#1a0000"],
      [0.8, "#0e0000"],
      [1, "#040000"],
    ],
    fogColor: "#0d0000",
    fogNear: 400,
    fogFar: 3500,
    ambientColor: "#b01010",
    ambientIntensity: 0.55,
    sunColor: "#d03030",
    sunIntensity: 0.75,
    sunPos: [300, 120, -200],
    fillColor: "#800000",
    fillIntensity: 0.3,
    fillPos: [-200, 60, 200],
    hemiSky: "#a02020",
    hemiGround: "#200808",
    hemiIntensity: 0.5,
    groundColor: "#1a0000",
    grid1: "#2a0000",
    grid2: "#220000",
    roadMarkingColor: "#880000",
    sidewalkColor: "#2a0808",
    building: {
      windowLit: ["#ff4444", "#ff6666", "#cc2222", "#ff8888", "#ff2222"],
      windowOff: "#100000",
      face: "#180000",
      roof: "#2a0808",
      accent: "#ff2200",
    },
    waterColor: "#0d0000",
    waterEmissive: "#1a0000",
    dockColor: "#2a1010",
  },
];

export const DEFAULT_THEME = THEMES[0];

export default function CityCanvas({ initialBuildings = [] }: { initialBuildings?: CityBuilding[] }) {
  const buildings = initialBuildings;

  return (
    <div style={{ width: "100vw", height: "100vh" }}>
      <Canvas camera={{ position: [0, 20, 40], fov: 50 }}>
        <ambientLight intensity={0.5} />
        <pointLight position={[10, 20, 10]} />
        <Stars />
        {buildings.map((b, i) => (
          <mesh key={b.id || i} position={b.position}>
            <boxGeometry args={[b.width || 1, b.height || 2, b.depth || 1]} />
            <meshStandardMaterial color={b.color || "#cc3333"} />
          </mesh>
        ))}
        <MovingVehicles />
        <OrbitControls />
      </Canvas>
      <div style={{ position: "absolute", bottom: 10, left: 10, color: "white", background: "black", padding: 5 }}>
        {buildings.length} channels
      </div>
    </div>
  );
}
