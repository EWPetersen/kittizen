import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Sphere, Ring, Torus } from '@react-three/drei';
import * as THREE from 'three';
import { JumpPoint } from '../../models/celestialObjects';
import BaseRenderer, { BaseRendererProps, GM_SCALE } from './BaseRenderer';

interface JumpPointRendererProps extends Omit<BaseRendererProps, 'object'> {
  object: JumpPoint;
  showTravelMarkers?: boolean;
}

const JumpPointRenderer: React.FC<JumpPointRendererProps> = ({
  object,
  selected,
  showLabel,
  actualScale,
  onClick,
  showTravelMarkers = true,
}) => {
  const portalRef = useRef<THREE.Mesh>(null);
  const ringRef = useRef<THREE.Mesh>(null);
  const glowRef = useRef<THREE.Mesh>(null);
  
  // Special animation effects for Jump Points
  useFrame(({ clock }) => {
    if (portalRef.current) {
      // Pulsating effect
      const pulse = Math.sin(clock.getElapsedTime() * 1.5) * 0.1 + 0.9;
      portalRef.current.scale.setScalar(pulse);
    }
    
    if (ringRef.current) {
      // Rotation effect
      ringRef.current.rotation.z = clock.getElapsedTime() * 0.2;
    }
    
    if (glowRef.current) {
      // Separate breathing effect for the glow
      const glow = Math.sin(clock.getElapsedTime() * 0.8) * 0.15 + 1.0;
      glowRef.current.scale.setScalar(glow);
    }
  });
  
  // Calculate sizes
  const jumpPointSize = actualScale 
    ? object.size / GM_SCALE 
    : Math.max(object.size / GM_SCALE * 0.00005, 0.3);
  
  const ringSize = jumpPointSize * 1.8;
  const glowSize = jumpPointSize * 2.5;
  
  // Jump point color - blue/teal/cyan for jumps
  const jumpColor = new THREE.Color('#00FFCC');
  
  // Arrival and obstruction radii
  const arrivalRadius = object.arrivalRadius > 0 
    ? Math.max(object.arrivalRadius / GM_SCALE, jumpPointSize * 5) 
    : jumpPointSize * 5;
    
  const obstructionRadius = object.obstructionRadius > 0 
    ? Math.max(object.obstructionRadius / GM_SCALE, jumpPointSize * 2)
    : jumpPointSize * 2;
  
  // Convert position to scene coordinates
  const position = [
    object.position.x / GM_SCALE,
    object.position.y / GM_SCALE,
    object.position.z / GM_SCALE
  ];
  
  return (
    <group position={position as [number, number, number]}>
      {/* Arrival distance indicator */}
      {showTravelMarkers && (
        <Torus 
          args={[arrivalRadius, 0.02, 8, 48]}
          rotation={[Math.PI/2, 0, 0]}
        >
          <meshBasicMaterial 
            color={jumpColor} 
            transparent={true} 
            opacity={0.3} 
          />
        </Torus>
      )}
      
      {/* Obstruction radius indicator */}
      {showTravelMarkers && obstructionRadius < arrivalRadius && (
        <Torus 
          args={[obstructionRadius, 0.03, 8, 36]}
          rotation={[Math.PI/2, 0, 0]}
        >
          <meshBasicMaterial 
            color="#FF3333" 
            transparent={true} 
            opacity={0.4} 
          />
        </Torus>
      )}
      
      {/* Outer glow */}
      <Sphere ref={glowRef} args={[glowSize, 24, 24]}>
        <meshBasicMaterial 
          color={jumpColor} 
          transparent={true} 
          opacity={0.2}
          blending={THREE.AdditiveBlending}
        />
      </Sphere>
      
      {/* Rotating ring */}
      <Ring 
        ref={ringRef}
        args={[ringSize * 0.7, ringSize, 36]} 
        rotation={[Math.PI/2, 0, 0]}
      >
        <meshBasicMaterial 
          color={jumpColor} 
          transparent={true} 
          opacity={0.7}
          side={THREE.DoubleSide}
        />
      </Ring>
      
      {/* Central portal sphere */}
      <Sphere ref={portalRef} args={[jumpPointSize, 32, 32]} onClick={onClick}>
        <meshStandardMaterial
          color={jumpColor}
          emissive={jumpColor}
          emissiveIntensity={1.0}
          roughness={0.3}
          metalness={0.7}
        />
      </Sphere>
      
      {/* Base renderer for labels and selection effects */}
      <BaseRenderer 
        object={object}
        selected={selected}
        showLabel={showLabel}
        actualScale={actualScale}
        onClick={onClick}
        color={jumpColor}
        emissiveIntensity={0.7}
        scaleMultiplier={0.00005}
        minSize={0.01} // Small because we're rendering our own jump point
      />
    </group>
  );
};

export default JumpPointRenderer; 