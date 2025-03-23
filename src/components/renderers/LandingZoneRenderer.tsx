import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Sphere, Ring, Cylinder, Billboard, Html } from '@react-three/drei';
import * as THREE from 'three';
import { LandingZone } from '../../models/celestialObjects';
import BaseRenderer, { BaseRendererProps, GM_SCALE } from './BaseRenderer';

interface LandingZoneRendererProps extends Omit<BaseRendererProps, 'object'> {
  object: LandingZone;
  showTravelMarkers?: boolean;
}

const LandingZoneRenderer: React.FC<LandingZoneRendererProps> = ({
  object,
  selected,
  showLabel,
  actualScale,
  onClick,
  showTravelMarkers = true,
}) => {
  const ringRef = useRef<THREE.Mesh>(null);
  const markerRef = useRef<THREE.Group>(null);
  const beamRef = useRef<THREE.Mesh>(null);
  
  // Animations for landing zone markers
  useFrame(({ clock }) => {
    if (ringRef.current) {
      // Rotating ring
      ringRef.current.rotation.z = clock.getElapsedTime() * 0.5;
    }
    
    if (beamRef.current) {
      // Pulsing opacity for the beam
      const alpha = Math.sin(clock.getElapsedTime() * 2) * 0.3 + 0.5;
      if (beamRef.current.material instanceof THREE.MeshBasicMaterial) {
        beamRef.current.material.opacity = alpha;
      }
    }
    
    if (markerRef.current) {
      // Slight hovering effect
      const hover = Math.sin(clock.getElapsedTime() * 1.5) * 0.1;
      markerRef.current.position.y = hover;
    }
  });
  
  // Calculate sizes
  const markerSize = actualScale 
    ? object.size / GM_SCALE 
    : Math.max(object.size / GM_SCALE * 0.00001, 0.2); // Landing zones are small markers
  
  const ringSize = markerSize * 3;
  const beamHeight = markerSize * 10;
  
  // Landing zone color - pink/magenta
  const landingColor = new THREE.Color('#FF3399');
  
  // Arrival radius for quantum travel
  const arrivalRadius = object.arrivalRadius > 0 
    ? Math.max(object.arrivalRadius / GM_SCALE, ringSize * 2) 
    : ringSize * 2;
  
  // Convert position to scene coordinates
  const position = [
    object.position.x / GM_SCALE,
    object.position.y / GM_SCALE,
    object.position.z / GM_SCALE
  ];
  
  // Determine location name from display_name
  const locationName = object.display_name;
  
  return (
    <group position={position as [number, number, number]}>
      {/* Arrival radius indicator */}
      {showTravelMarkers && (
        <Ring args={[arrivalRadius, arrivalRadius + 0.05, 32]} rotation={[Math.PI/2, 0, 0]}>
          <meshBasicMaterial 
            color={landingColor} 
            transparent={true} 
            opacity={0.3}
            side={THREE.DoubleSide}
          />
        </Ring>
      )}
      
      {/* Vertical beam marker */}
      <Cylinder 
        ref={beamRef}
        args={[markerSize * 0.2, markerSize * 0.2, beamHeight, 8]} 
        position={[0, beamHeight/2, 0]}
      >
        <meshBasicMaterial 
          color={landingColor} 
          transparent={true} 
          opacity={0.3}
          blending={THREE.AdditiveBlending}
        />
      </Cylinder>
      
      {/* Rotating ring */}
      <Ring 
        ref={ringRef}
        args={[ringSize * 0.8, ringSize, 32]} 
        rotation={[Math.PI/2, 0, 0]}
      >
        <meshBasicMaterial 
          color={landingColor} 
          transparent={true} 
          opacity={0.7}
          side={THREE.DoubleSide}
        />
      </Ring>
      
      {/* Landing marker */}
      <group ref={markerRef}>
        <Sphere args={[markerSize, 16, 16]} onClick={onClick}>
          <meshStandardMaterial
            color={landingColor}
            emissive={landingColor}
            emissiveIntensity={0.5}
            roughness={0.4}
          />
        </Sphere>
        
        {/* Small surface indicator */}
        <Cylinder 
          args={[markerSize * 1.2, 0, markerSize * 0.8, 4]} 
          position={[0, -markerSize * 0.4, 0]}
          rotation={[Math.PI, 0, 0]}
        >
          <meshBasicMaterial 
            color={landingColor} 
            transparent={true} 
            opacity={0.6}
          />
        </Cylinder>
        
        {/* Additional hover rings */}
        <Ring 
          args={[markerSize * 1.5, markerSize * 1.6, 32]} 
          position={[0, -markerSize * 0.2, 0]}
          rotation={[Math.PI/2, 0, 0]}
        >
          <meshBasicMaterial 
            color={landingColor} 
            transparent={true} 
            opacity={0.4}
            side={THREE.DoubleSide}
          />
        </Ring>
      </group>
      
      {/* Location name with icon */}
      <Billboard position={[0, markerSize * 3, 0]}>
        <Html
          transform
          distanceFactor={10}
          style={{
            color: '#FFFFFF',
            backgroundColor: 'rgba(0,0,0,0.7)',
            padding: '2px 8px',
            borderRadius: '4px',
            fontSize: '12px',
            fontWeight: 'bold',
            display: 'flex',
            alignItems: 'center',
            gap: '5px'
          }}
        >
          <span>🏙️</span>
          <span>{locationName}</span>
        </Html>
      </Billboard>
      
      {/* Base renderer for selection effects */}
      <BaseRenderer 
        object={object}
        selected={selected}
        showLabel={false} // We handle our own label above
        actualScale={actualScale}
        onClick={onClick}
        color={landingColor}
        emissiveIntensity={0.6}
        scaleMultiplier={0.00001}
        minSize={0.01} // Small because we're rendering our own marker
      />
    </group>
  );
};

export default LandingZoneRenderer; 