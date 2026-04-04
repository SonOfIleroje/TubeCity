"use client";

import { useState } from "react";
import { Box, Plane } from "@react-three/drei";

interface BuildingProps {
  position: [number, number, number];
  height: number;
  width: number;
  color: string;
  onClick: () => void;
  isActive: boolean;
  hasRecentActivity: boolean;
}

export function Building({ position, height, width, color, onClick, isActive, hasRecentActivity }: BuildingProps) {
  const [hover, setHover] = useState(false);

  return (
    <group position={position}>
      <Box
        args={[width, height, width]}
        position={[0, height / 2, 0]}
        onClick={onClick}
        onPointerOver={() => setHover(true)}
        onPointerOut={() => setHover(false)}
      >
        <meshStandardMaterial color={isActive ? "gold" : hover ? "white" : color} />
      </Box>
      {hasRecentActivity && (
        <Box args={[width * 0.8, 0.1, width * 0.8]} position={[0, height - 0.2, 0]}>
          <meshStandardMaterial color="red" emissive="red" />
        </Box>
      )}
    </group>
  );
}
