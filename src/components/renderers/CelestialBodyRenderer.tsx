import React, { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { Text } from '@react-three/drei';
import { BaseCelestialObject, Star, Planet, Moon } from '../../models/celestialObjects';

interface CelestialBodyRendererProps {
  object: Star | Planet | Moon;
  selected: boolean;
  scale: number;
  enhancedAtmosphere: boolean;
  showLabel: boolean;
  onSelect: (objectName: string) => void;
}

// Scale factor for visualization
const SYSTEM_SCALE = 1e9;

const CelestialBodyRenderer: React.FC<CelestialBodyRendererProps> = ({
  object,
  selected,
  scale,
  enhancedAtmosphere,
  showLabel,
  onSelect
}) => {
  const groupRef = useRef<THREE.Group>(null);
  const meshRef = useRef<THREE.Mesh>(null);
  
  // Position in scaled space
  const position = useMemo(() => {
    // Check if object.position exists before accessing its properties
    if (!object.position) {
      console.warn(`Object ${object.name} has no position data`);
      return [0, 0, 0]; // Default position if no data available
    }
    
    return [
      object.position.x / SYSTEM_SCALE,
      object.position.y / SYSTEM_SCALE,
      object.position.z / SYSTEM_SCALE
    ];
  }, [object.name, object.position]);
  
  // Size adjusted for visualization
  const radius = useMemo(() => {
    // Use actual scale if requested, otherwise enhance for visibility
    const baseSize = object.size / SYSTEM_SCALE;
    
    // Different scale factors based on object type
    let scaleFactor = 1;
    if (object.type === 'Star') {
      scaleFactor = scale * 2; // Make stars more visible
    } else if (object.type === 'Planet') {
      scaleFactor = scale * 5; // Enhance planets
    } else if (object.type === 'Moon') {
      scaleFactor = scale * 8; // Enhance moons even more
    }
    
    return baseSize * scaleFactor;
  }, [object.size, object.type, scale]);
  
  // Determine material based on object type
  const [material, atmosphereMaterial] = useMemo(() => {
    // Base parameters
    let color = new THREE.Color(0x888888); // Default gray color
    let emissive = false;
    let roughness = 0.7;
    let metalness = 0.2;
    let atmosphereColor: THREE.Color | null = null;
    let atmosphereOpacity = 0;
    
    // Configure based on celestial body type
    if (object.type === 'Star') {
      color = new THREE.Color(0xffcc66);
      emissive = true;
      roughness = 0.3;
      metalness = 0.8;
      
      // Star glow
      atmosphereColor = new THREE.Color(0xffdd99);
      atmosphereOpacity = 0.3;
    } else if (object.type === 'Planet') {
      // Check for specific planets by name
      if (object.name.includes('hurston')) {
        color = new THREE.Color(0x8b5d3a); // Brownish
        atmosphereColor = new THREE.Color(0xff6633);
        atmosphereOpacity = 0.15;
      } else if (object.name.includes('crusader')) {
        color = new THREE.Color(0xaaccff); // Light blue
        atmosphereColor = new THREE.Color(0xaaddff);
        atmosphereOpacity = 0.2;
      } else if (object.name.includes('microtech')) {
        color = new THREE.Color(0xeeffff); // Icy white/blue
        atmosphereColor = new THREE.Color(0xccffff);
        atmosphereOpacity = 0.15;
      } else if (object.name.includes('arccorp')) {
        color = new THREE.Color(0xcc3333); // Reddish
        atmosphereColor = new THREE.Color(0xff6655);
        atmosphereOpacity = 0.18;
      } else {
        color = new THREE.Color(0x5599bb); // Generic planet blue
        atmosphereColor = new THREE.Color(0x88bbff);
        atmosphereOpacity = 0.15;
      }
    } else if (object.type === 'Moon') {
      // Generic moon appearance
      color = new THREE.Color(0xaaaaaa);
      roughness = 0.9;
      metalness = 0.1;
      
      // Some moons might have thin atmospheres
      if (object.atmoHeight > 0) {
        atmosphereColor = new THREE.Color(0xaabbcc);
        atmosphereOpacity = 0.08;
      }
    }
    
    // Create material based on type
    const mainMaterial = emissive
      ? new THREE.MeshStandardMaterial({
          color,
          emissive: color,
          emissiveIntensity: 1,
          roughness: 0.3,
          metalness: 0.8
        })
      : new THREE.MeshStandardMaterial({
          color,
          roughness,
          metalness
        });
    
    // Create atmosphere material if needed
    let atmMaterial = null;
    if (atmosphereColor && enhancedAtmosphere) {
      atmMaterial = new THREE.MeshBasicMaterial({
        color: atmosphereColor,
        transparent: true,
        opacity: atmosphereOpacity,
        side: THREE.BackSide
      });
    }
    
    return [mainMaterial, atmMaterial];
  }, [object.type, object.name, object.atmoHeight, enhancedAtmosphere]);
  
  // Rotation animation
  useFrame((state, delta) => {
    if (meshRef.current) {
      // Slow rotation for visualization
      meshRef.current.rotation.y += delta * 0.1;
    }
    
    // Highlight pulse effect when selected
    if (selected && groupRef.current) {
      groupRef.current.scale.x = 1 + Math.sin(state.clock.elapsedTime * 2) * 0.02;
      groupRef.current.scale.y = 1 + Math.sin(state.clock.elapsedTime * 2) * 0.02;
      groupRef.current.scale.z = 1 + Math.sin(state.clock.elapsedTime * 2) * 0.02;
    }
  });
  
  // Determine label size and position based on object type
  const labelConfig = useMemo(() => {
    let fontSize = 1;
    let yOffset = 1.5;
    
    if (object.type === 'Star') {
      fontSize = 1.5;
      yOffset = 2.5;
    } else if (object.type === 'Planet') {
      fontSize = 1.2;
      yOffset = 2;
    } else if (object.type === 'Moon') {
      fontSize = 0.8;
      yOffset = 1.5;
    }
    
    return { fontSize, yOffset };
  }, [object.type]);
  
  return (
    <group 
      ref={groupRef}
      position={position as [number, number, number]}
      onClick={() => onSelect(object.name)}
    >
      {/* Main celestial body */}
      <mesh ref={meshRef} castShadow={object.type !== 'Star'} receiveShadow={object.type !== 'Star'}>
        <sphereGeometry args={[radius, 32, 32]} />
        {material && <primitive object={material} />}
      </mesh>
      
      {/* Atmosphere layer */}
      {atmosphereMaterial && (
        <mesh>
          <sphereGeometry args={[radius * 1.05, 32, 32]} />
          <primitive object={atmosphereMaterial} />
        </mesh>
      )}
      
      {/* Selection indicator */}
      {selected && (
        <mesh>
          <ringGeometry args={[radius * 1.2, radius * 1.25, 64]} />
          <meshBasicMaterial color="#ffffff" transparent opacity={0.4} />
        </mesh>
      )}
      
      {/* Label */}
      {showLabel && (
        <Text
          position={[0, radius * labelConfig.yOffset, 0]}
          fontSize={labelConfig.fontSize}
          color={selected ? "#ffffff" : "#c0c0c0"}
          anchorX="center"
          anchorY="middle"
          outlineWidth={0.05}
          outlineColor="#000000"
          fillOpacity={selected ? 1 : 0.8}
        >
          {object.display_name}
        </Text>
      )}
    </group>
  );
};

export default CelestialBodyRenderer; 