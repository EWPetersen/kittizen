import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Sphere, Ring, Text3D, Html, Billboard } from '@react-three/drei';
import * as THREE from 'three';
import { LagrangePoint } from '../../models/celestialObjects';
import BaseRenderer, { BaseRendererProps, GM_SCALE } from './BaseRenderer';

interface LagrangePointRendererProps extends Omit<BaseRendererProps, 'object'> {
  object: LagrangePoint;
}

const LagrangePointRenderer: React.FC<LagrangePointRendererProps> = ({
  object,
  selected,
  showLabel,
  actualScale,
  onClick,
}) => {
  const markerRef = useRef<THREE.Mesh>(null);
  const ring1Ref = useRef<THREE.Mesh>(null);
  const ring2Ref = useRef<THREE.Mesh>(null);
  
  // Animation for Lagrange points to make them more visible
  useFrame(({ clock }) => {
    if (ring1Ref.current) {
      ring1Ref.current.rotation.z = clock.getElapsedTime() * 0.3;
    }
    
    if (ring2Ref.current) {
      ring2Ref.current.rotation.x = clock.getElapsedTime() * 0.2;
    }
    
    if (markerRef.current) {
      // Subtle pulsing for the central marker
      const pulse = Math.sin(clock.getElapsedTime() * 2) * 0.05 + 1;
      markerRef.current.scale.setScalar(pulse);
    }
  });
  
  // Calculate sizes
  const markerSize = actualScale 
    ? object.size / GM_SCALE 
    : Math.max(object.size / GM_SCALE * 0.00003, 0.2);
  
  const ringSize = markerSize * 2.5;
  
  // Lagrange point color - purple
  const lagrangeColor = new THREE.Color('#9900FF');
  
  // Extract L-point number from name (L1, L2, etc.)
  const lPointNumber = object.display_name;
  
  // Convert position to scene coordinates
  const position = [
    object.position.x / GM_SCALE,
    object.position.y / GM_SCALE,
    object.position.z / GM_SCALE
  ];
  
  return (
    <group position={position as [number, number, number]}>
      {/* Outer rings to make Lagrange points more visible */}
      <Ring 
        ref={ring1Ref}
        args={[ringSize * 0.8, ringSize, 32]} 
        rotation={[Math.PI/2, 0, 0]}
      >
        <meshBasicMaterial 
          color={lagrangeColor} 
          transparent={true} 
          opacity={0.4}
          side={THREE.DoubleSide}
        />
      </Ring>
      
      <Ring 
        ref={ring2Ref}
        args={[ringSize * 0.9, ringSize * 0.7, 32]} 
        rotation={[0, Math.PI/2, 0]}
      >
        <meshBasicMaterial 
          color={lagrangeColor} 
          transparent={true} 
          opacity={0.3}
          side={THREE.DoubleSide}
        />
      </Ring>
      
      {/* Central marker */}
      <Sphere ref={markerRef} args={[markerSize, 16, 16]} onClick={onClick}>
        <meshBasicMaterial
          color={lagrangeColor}
          transparent={true}
          opacity={0.8}
        />
      </Sphere>
      
      {/* L-point number indicator - visible even when labels are off */}
      <Billboard position={[0, markerSize * 1.5, 0]}>
        <Html
          transform
          distanceFactor={10}
          style={{
            color: '#9900FF',
            backgroundColor: 'rgba(0,0,0,0.7)',
            padding: '1px 6px',
            borderRadius: '50%',
            fontSize: '10px',
            fontWeight: 'bold',
            width: '18px',
            height: '18px',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
          }}
        >
          {lPointNumber}
        </Html>
      </Billboard>
      
      {/* Base renderer for selection effects */}
      <BaseRenderer 
        object={object}
        selected={selected}
        showLabel={showLabel}
        actualScale={actualScale}
        onClick={onClick}
        color={lagrangeColor}
        emissiveIntensity={0.5}
        scaleMultiplier={0.00003}
        minSize={0.01} // Small because we're rendering our own marker
      />
    </group>
  );
};

export default LagrangePointRenderer; 