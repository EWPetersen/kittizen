import { useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { Sphere, Html, Billboard, Text } from '@react-three/drei';
import * as THREE from 'three';
import { BaseCelestialObject } from '../../models/celestialObjects';

export interface BaseRendererProps {
  object: BaseCelestialObject;
  selected: boolean;
  showLabel: boolean;
  actualScale: boolean;
  onClick: () => void;
  color?: THREE.Color;
  emissiveIntensity?: number;
  scaleMultiplier?: number;
  minSize?: number;
}

// Default scale conversion - 1 Gm = 1,000,000,000 meters
export const GM_SCALE = 1e9;

const BaseRenderer: React.FC<BaseRendererProps> = ({
  object,
  selected,
  showLabel,
  actualScale,
  onClick,
  color = new THREE.Color('#FFFFFF'),
  emissiveIntensity = 0.5,
  scaleMultiplier = 1,
  minSize = 0.3,
}) => {
  const ref = useRef<THREE.Mesh>(null);
  const [hovered, setHovered] = useState(false);
  
  // Calculate rendered size based on actual scale or enhanced visualization
  const renderSize = actualScale 
    ? object.size / GM_SCALE // Actual scale (typically very small)
    : Math.max(object.size / GM_SCALE * scaleMultiplier, minSize); // Enhanced scale with minimum size
  
  // Pulse effect for selected objects
  useFrame(({ clock }) => {
    if (ref.current && selected) {
      const pulse = Math.sin(clock.getElapsedTime() * 4) * 0.04 + 1;
      ref.current.scale.setScalar(pulse);
    }
  });
  
  // Position from JSON data converted to scene scale
  const position = [
    object.position.x / GM_SCALE,
    object.position.y / GM_SCALE,
    object.position.z / GM_SCALE
  ];
  
  // Enhanced hover and selection styles
  const baseColor = hovered ? color.clone().multiplyScalar(1.2) : color;
  const outlineSize = selected ? renderSize * 1.15 : renderSize * 1.08;
  
  return (
    <group position={position as [number, number, number]}>
      {/* Selection outline */}
      {(selected || hovered) && (
        <Sphere args={[outlineSize, 32, 32]}>
          <meshBasicMaterial color="#FFFFFF" transparent opacity={0.15} />
        </Sphere>
      )}
      
      {/* Main object sphere */}
      <Sphere 
        ref={ref} 
        args={[renderSize, 32, 32]}
        onClick={onClick}
        onPointerOver={() => setHovered(true)}
        onPointerOut={() => setHovered(false)}
      >
        <meshStandardMaterial 
          color={baseColor} 
          emissive={baseColor} 
          emissiveIntensity={emissiveIntensity} 
          roughness={0.4}
          transparent={true}
          opacity={0.9}
        />
      </Sphere>
      
      {/* Object label */}
      {showLabel && (
        <>
          {/* 3D Text label */}
          <Billboard position={[0, renderSize * 1.3, 0]}>
            <Text
              color={selected ? '#FFFFFF' : '#AAAAAA'}
              fontSize={selected ? 0.25 : 0.15}
              anchorX="center"
              anchorY="middle"
              outlineWidth={0.01}
              outlineColor="#000000"
            >
              {object.display_name}
            </Text>
          </Billboard>
          
          {/* HTML label fallback - will only be visible if 3D text fails */}
          <Html position={[0, renderSize * 1.7, 0]} center>
            <div style={{ 
              backgroundColor: 'rgba(0,0,0,0.6)', 
              padding: '4px 8px', 
              borderRadius: '4px',
              color: selected ? '#FFFFFF' : '#AAAAAA',
              fontFamily: '"Space Mono", monospace',
              fontSize: selected ? '14px' : '12px',
              whiteSpace: 'nowrap',
              pointerEvents: 'none',
              transform: 'translate(-50%, -50%)'
            }}>
              {object.display_name}
            </div>
          </Html>
        </>
      )}
    </group>
  );
};

export default BaseRenderer; 