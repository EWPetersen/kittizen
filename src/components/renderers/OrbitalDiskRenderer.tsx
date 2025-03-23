import React, { useMemo } from 'react';
import * as THREE from 'three';
import { BaseCelestialObject, isPlanet, Star } from '../../models/celestialObjects';

// Scale constants to match the system scale
const SYSTEM_SCALE = 1e9;

interface OrbitalDiskRendererProps {
  centralObject: Star;
  planetaryObjects: BaseCelestialObject[];
  visible?: boolean;
  color?: string;
  opacity?: number;
  size?: number; // Multiplier for disk size
}

const OrbitalDiskRenderer: React.FC<OrbitalDiskRendererProps> = ({
  centralObject,
  planetaryObjects,
  visible = true,
  color = '#225577',
  opacity = 0.1,
  size = 1.2 // Slightly larger than the outermost planet
}) => {
  // Calculate the orbital disk parameters
  const diskParams = useMemo(() => {
    if (!centralObject || !centralObject.position) {
      return null;
    }

    // Find the position of the central object (star)
    const starPosition = new THREE.Vector3(
      centralObject.position.x / SYSTEM_SCALE,
      centralObject.position.y / SYSTEM_SCALE,
      centralObject.position.z / SYSTEM_SCALE
    );

    // Find the furthest planet to determine disk size
    let maxDistance = 0;
    for (const obj of planetaryObjects) {
      if (isPlanet(obj) && obj.position) {
        const planetPos = new THREE.Vector3(
          obj.position.x / SYSTEM_SCALE,
          obj.position.y / SYSTEM_SCALE,
          obj.position.z / SYSTEM_SCALE
        );
        
        const distance = planetPos.distanceTo(starPosition);
        maxDistance = Math.max(maxDistance, distance);
      }
    }

    // Apply size multiplier to ensure disk extends beyond the outermost planet
    const diskRadius = maxDistance * size;

    return {
      position: starPosition,
      radius: diskRadius
    };
  }, [centralObject, planetaryObjects, size]);

  if (!diskParams) {
    return null;
  }

  return (
    <mesh position={diskParams.position} rotation={[Math.PI / 2, 0, 0]} visible={visible}>
      <circleGeometry args={[diskParams.radius, 64]} />
      <meshBasicMaterial 
        color={color} 
        transparent 
        opacity={opacity} 
        side={THREE.DoubleSide}
        depthWrite={false}
      />
    </mesh>
  );
};

export default OrbitalDiskRenderer; 