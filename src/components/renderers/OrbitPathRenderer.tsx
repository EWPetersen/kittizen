import React, { useMemo } from 'react';
import * as THREE from 'three';
import { Line } from '@react-three/drei';
import { Star, Planet, Moon, BaseCelestialObject } from '../../models/celestialObjects';

// Scale factor for visualization
const SYSTEM_SCALE = 1e9;
// Colors for different orbit types
const ORBIT_COLORS = {
  'Planet': '#4080ff', // Blue for planets
  'Moon': '#40ff80',   // Green for moons
};
// Number of points to use for drawing the orbit
const ORBIT_RESOLUTION = 128;

interface OrbitPathRendererProps {
  parentObject: Star | Planet;
  childObjects: BaseCelestialObject[];
  visible: boolean;
}

/**
 * Renders orbital paths of celestial bodies around their parent.
 * For planets, this creates circular orbits around the parent star.
 * For moons, this creates circular orbits around their parent planet.
 */
const OrbitPathRenderer: React.FC<OrbitPathRendererProps> = ({
  parentObject,
  childObjects,
  visible
}) => {
  // Filter out objects that don't have position data
  const objectsWithPosition = useMemo(() => 
    childObjects.filter(obj => obj.position && obj.type === 'Planet' || obj.type === 'Moon'),
  [childObjects]);

  // Create orbital paths
  const orbitalPaths = useMemo(() => {
    if (!parentObject.position || !visible || objectsWithPosition.length === 0) {
      return [];
    }

    const parentPosition = new THREE.Vector3(
      parentObject.position.x / SYSTEM_SCALE,
      parentObject.position.y / SYSTEM_SCALE,
      parentObject.position.z / SYSTEM_SCALE
    );

    return objectsWithPosition.map(child => {
      if (!child.position) return null;

      // Calculate orbit properties
      const childPosition = new THREE.Vector3(
        child.position.x / SYSTEM_SCALE,
        child.position.y / SYSTEM_SCALE,
        child.position.z / SYSTEM_SCALE
      );

      // Calculate orbit radius (distance from parent to child)
      const orbitRadius = childPosition.distanceTo(parentPosition);
      
      // Create points for a circular orbit
      const points: THREE.Vector3[] = [];
      for (let i = 0; i <= ORBIT_RESOLUTION; i++) {
        const angle = (i / ORBIT_RESOLUTION) * Math.PI * 2;
        
        // Calculate orbit plane normal (approximation based on child position)
        // In a real simulation, this would come from orbital mechanics calculations
        const directionToChild = childPosition.clone().sub(parentPosition).normalize();
        
        // Create a perpendicular vector to define the orbit plane
        // This is a simple approximation that keeps orbits roughly aligned
        // with the system's ecliptic plane, with some variation
        const normal = new THREE.Vector3(0, 1, 0);
        if (Math.abs(directionToChild.y) > 0.9) {
          // If the object is mostly above/below the parent, use a different normal
          normal.set(1, 0, 0);
        }
        
        // Create the orbit point
        const orbitPoint = new THREE.Vector3(
          Math.cos(angle) * orbitRadius,
          0,
          Math.sin(angle) * orbitRadius
        );
        
        // Rotate the orbit to match the approximated plane
        const rotationAxis = directionToChild.clone().cross(new THREE.Vector3(0, 0, 1)).normalize();
        const rotationAngle = Math.acos(directionToChild.dot(new THREE.Vector3(0, 0, 1)));
        
        if (rotationAxis.length() > 0.001) {
          orbitPoint.applyAxisAngle(rotationAxis, rotationAngle);
        }
        
        // Add the parent position to place the orbit in the correct location
        orbitPoint.add(parentPosition);
        points.push(orbitPoint);
      }

      // Get the appropriate color for this object type
      const color = ORBIT_COLORS[child.type as 'Planet' | 'Moon'] || '#ffffff';

      return {
        points,
        color,
        objectName: child.name,
        objectType: child.type
      };
    }).filter(Boolean);
  }, [parentObject, objectsWithPosition, visible]);

  if (!visible || orbitalPaths.length === 0) {
    return null;
  }

  return (
    <>
      {orbitalPaths.map((path, index) => (
        path && (
          <Line
            key={`orbit-${path.objectName}-${index}`}
            points={path.points}
            color={path.color}
            lineWidth={1}
            dashed={path.objectType === 'Moon'} // Dashed lines for moon orbits
            dashSize={0.5}
            gapSize={0.25}
            transparent
            opacity={0.6}
          />
        )
      ))}
    </>
  );
};

export default OrbitPathRenderer; 