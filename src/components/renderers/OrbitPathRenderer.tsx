import React, { useMemo } from 'react';
import * as THREE from 'three';
import { Line } from '@react-three/drei';
import { BaseCelestialObject, isPlanet, isMoon } from '../../models/celestialObjects';

// Scale constants to match the system scale
const SYSTEM_SCALE = 1e9;
const ORBIT_SEGMENTS = 64; // Higher number = smoother orbit paths

interface OrbitPathRendererProps {
  object: BaseCelestialObject;
  objectsMap: Record<string, BaseCelestialObject>;
  color?: string;
  visible?: boolean;
  lineWidth?: number;
  dashed?: boolean;
}

const OrbitPathRenderer: React.FC<OrbitPathRendererProps> = ({
  object,
  objectsMap,
  color = '#44aaff',
  visible = true,
  lineWidth = 1,
  dashed = false
}) => {
  // Calculate orbit path points
  const orbitPoints = useMemo(() => {
    // Skip if no position or it's not a planet/moon
    if (!object.position || (!isPlanet(object) && !isMoon(object))) {
      return null;
    }

    // Get parent object
    const parentObject = objectsMap[object.parent];
    if (!parentObject || !parentObject.position) {
      return null;
    }

    // Calculate orbit radius (distance from parent to object)
    const parentPos = new THREE.Vector3(
      parentObject.position.x / SYSTEM_SCALE,
      parentObject.position.y / SYSTEM_SCALE,
      parentObject.position.z / SYSTEM_SCALE
    );
    
    const objectPos = new THREE.Vector3(
      object.position.x / SYSTEM_SCALE,
      object.position.y / SYSTEM_SCALE,
      object.position.z / SYSTEM_SCALE
    );
    
    // Calculate orbit parameters
    const radius = objectPos.distanceTo(parentPos);
    
    // Create orbit circle
    const points = [];
    for (let i = 0; i <= ORBIT_SEGMENTS; i++) {
      const angle = (i / ORBIT_SEGMENTS) * Math.PI * 2;
      
      // For now, assume orbits are in XY plane with some small Z deviation
      // Can be refined with actual orbital mechanics if needed
      const x = parentPos.x + radius * Math.cos(angle);
      const y = parentPos.y + radius * Math.sin(angle);
      
      // Use actual z-height for the object to create slight inclination
      // We'll use a sinusoidal variation that peaks at the object's actual position
      const normalizedI = i / ORBIT_SEGMENTS;
      const zVariation = Math.sin(normalizedI * Math.PI * 2) * (objectPos.z - parentPos.z);
      const z = parentPos.z + zVariation;
      
      points.push(new THREE.Vector3(x, y, z));
    }
    
    return points;
  }, [object, objectsMap]);

  // If no valid orbit path could be calculated, don't render anything
  if (!orbitPoints) {
    return null;
  }

  return (
    <Line
      points={orbitPoints}
      color={color}
      lineWidth={lineWidth}
      dashed={dashed}
      toneMapped={false}
      transparent
      opacity={0.6}
      visible={visible}
    />
  );
};

export default OrbitPathRenderer; 