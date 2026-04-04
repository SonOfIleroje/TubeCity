"use client";
import { useRef, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

interface Vehicle {
  startX: number;
  startZ: number;
  direction: "x" | "z";
  speed: number;
  color: string;
  laneOffset: number;
}

function Vehicle({ startX, startZ, direction, speed, color, laneOffset }: Vehicle) {
  const meshRef = useRef<THREE.Group>(null);
  const pos = useRef({ x: startX, z: startZ });

  useFrame((_, delta) => {
    if (!meshRef.current) return;
    let limit = direction === "x" ? 70 : 50;
    if (direction === "x") {
      pos.current.x += speed * delta;
      if (pos.current.x > limit) pos.current.x = -limit;
      if (pos.current.x < -limit) pos.current.x = limit;
      meshRef.current.position.set(pos.current.x, 0.2, startZ + laneOffset);
    } else {
      pos.current.z += speed * delta;
      if (pos.current.z > limit) pos.current.z = -limit;
      if (pos.current.z < -limit) pos.current.z = limit;
      meshRef.current.position.set(startX + laneOffset, 0.2, pos.current.z);
    }
  });

  return (
    <group ref={meshRef}>
      <mesh castShadow receiveShadow>
        <boxGeometry args={[1.2, 0.4, 0.8]} />
        <meshStandardMaterial color={color} metalness={0.6} roughness={0.3} />
      </mesh>
      <mesh position={[0, 0.3, 0]} castShadow>
        <boxGeometry args={[0.8, 0.2, 0.6]} />
        <meshStandardMaterial color="#222" metalness={0.8} />
      </mesh>
      {/* Headlights */}
      <pointLight position={[0.7, 0.2, 0]} intensity={0.5} color="#ffaa66" />
    </group>
  );
}

export function MovingVehicles() {
  const vehicles = useMemo(() => {
    const cars: Vehicle[] = [];
    // Define road lanes: horizontal roads at Z = -25, -12, 0, 12, 25
    const hRoads = [-25, -12, 0, 12, 25];
    hRoads.forEach(z => {
      // Two lanes per road (offset ±0.5)
      [-0.5, 0.5].forEach(lane => {
        for (let i = 0; i < 3; i++) { // only 3 cars per lane
          cars.push({
            startX: (Math.random() - 0.5) * 140,
            startZ: z,
            direction: "x",
            speed: (Math.random() * 2 + 1.5) * (Math.random() > 0.5 ? 1 : -1),
            color: `hsl(${Math.random() * 40 + 20}, 70%, 55%)`,
            laneOffset: lane,
          });
        }
      });
    });
    // Vertical roads at X = -30, -15, 0, 15, 30
    const vRoads = [-30, -15, 0, 15, 30];
    vRoads.forEach(x => {
      [-0.5, 0.5].forEach(lane => {
        for (let i = 0; i < 3; i++) {
          cars.push({
            startX: x,
            startZ: (Math.random() - 0.5) * 100,
            direction: "z",
            speed: (Math.random() * 2 + 1.5) * (Math.random() > 0.5 ? 1 : -1),
            color: `hsl(${Math.random() * 40 + 20}, 70%, 55%)`,
            laneOffset: lane,
          });
        }
      });
    });
    return cars;
  }, []);

  return (
    <group>
      {vehicles.map((car, i) => (
        <Vehicle key={i} {...car} />
      ))}
    </group>
  );
}
