"use client";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, Stars } from "@react-three/drei";
import { MovingVehicles } from "@/components/MovingVehicles";

export default function CityCanvas({ initialBuildings = [] }) {
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
