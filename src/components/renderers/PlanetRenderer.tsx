import { useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { Sphere, Html, Billboard } from '@react-three/drei';
import * as THREE from 'three';
import { Planet } from '../../models/celestialObjects';
import BaseRenderer, { BaseRendererProps, GM_SCALE } from './BaseRenderer';

interface PlanetRendererProps extends Omit<BaseRendererProps, 'object'> {
  object: Planet;
  showAtmosphere?: boolean;
  showOrbitalMarkers?: boolean;
  enhancedAtmosphere?: boolean;
}

// Atmospheric shader for realistic effects
const atmosphereVertexShader = `
  varying vec3 vNormal;
  varying vec3 vWorldPosition;
  
  void main() {
    vNormal = normalize(normalMatrix * normal);
    vec4 worldPosition = modelMatrix * vec4(position, 1.0);
    vWorldPosition = worldPosition.xyz;
    gl_Position = projectionMatrix * viewMatrix * worldPosition;
  }
`;

const atmosphereFragmentShader = `
  uniform vec3 planetColor;
  uniform float enhancedMode;
  varying vec3 vNormal;
  varying vec3 vWorldPosition;
  
  void main() {
    vec3 cameraToPoint = normalize(vWorldPosition - cameraPosition);
    float rimFactor = 1.0 - abs(dot(vNormal, cameraToPoint));
    rimFactor = enhancedMode > 0.5 ? pow(rimFactor, 1.5) : pow(rimFactor, 3.0);
    
    vec3 atmosphereColor = planetColor * 1.2; // Brighter than planet
    vec3 finalColor = atmosphereColor * rimFactor;
    
    float opacity = rimFactor;
    opacity = enhancedMode > 0.5 ? opacity * 0.7 : opacity * 0.4;
    
    gl_FragColor = vec4(finalColor, opacity);
  }
`;

const PlanetRenderer: React.FC<PlanetRendererProps> = ({
  object,
  selected,
  showLabel,
  actualScale,
  onClick,
  showAtmosphere = true,
  showOrbitalMarkers = false,
  enhancedAtmosphere = false,
}) => {
  const planetRef = useRef<THREE.Mesh>(null);
  const atmosphereRef = useRef<THREE.Mesh>(null);
  const materialRef = useRef<THREE.MeshStandardMaterial>(null);
  const atmosphereMaterialRef = useRef<THREE.ShaderMaterial>(null);
  
  // Slow rotation effect for planets
  useFrame(({ clock }) => {
    if (planetRef.current) {
      // Different planets should rotate at different speeds
      const rotationSpeed = 0.02 + (object.name.charCodeAt(object.name.length - 1) % 10) * 0.002;
      planetRef.current.rotation.y = clock.getElapsedTime() * rotationSpeed;
    }
  });
  
  // Calculate sizes
  const planetSize = actualScale 
    ? object.size / GM_SCALE 
    : Math.max(object.size / GM_SCALE * 0.000002, 1.0);
  
  // Calculate atmosphere size based on atmoHeight property
  const hasAtmosphere = object.atmoHeight > 0;
  const atmosphereSize = hasAtmosphere 
    ? planetSize * (1 + (object.atmoHeight / object.size) * (enhancedAtmosphere ? 0.5 : 0.2))
    : planetSize * 1.05; // Minimal atmosphere for planets without explicit atmosphere
  
  // Determine planet color based on its properties
  let planetColor;
  if (object.name === 'stanton1') { // Hurston - polluted industrial
    planetColor = new THREE.Color('#7D6B4B');
  } else if (object.name === 'stanton2') { // Crusader - gas giant
    planetColor = new THREE.Color('#A6C9D8');
  } else if (object.name === 'stanton3') { // ArcCorp - urban
    planetColor = new THREE.Color('#5B5B6A');
  } else if (object.name === 'stanton4') { // Microtech - frozen
    planetColor = new THREE.Color('#FFFFFF');
  } else {
    // Default planet color
    planetColor = new THREE.Color('#3366FF');
  }
  
  // Atmosphere color based on planet color but slightly different
  const atmosphereColor = planetColor.clone().multiplyScalar(1.2);
  
  // Convert position to scene coordinates
  const position = [
    object.position.x / GM_SCALE,
    object.position.y / GM_SCALE,
    object.position.z / GM_SCALE
  ];
  
  // Create orbital markers
  const renderOrbitalMarkers = () => {
    if (!showOrbitalMarkers || !object.orbitalMarkers) return null;
    
    return Object.entries(object.orbitalMarkers).map(([key, markerPos]) => {
      const omPosition = [
        (markerPos.x - object.position.x) / GM_SCALE,
        (markerPos.y - object.position.y) / GM_SCALE, 
        (markerPos.z - object.position.z) / GM_SCALE
      ];
      
      return (
        <group key={key} position={omPosition as [number, number, number]}>
          <Sphere args={[0.1, 16, 16]}>
            <meshBasicMaterial color="#00FFFF" />
          </Sphere>
          <Billboard position={[0, 0.2, 0]}>
            <Html
              transform
              distanceFactor={10}
              style={{
                color: '#00FFFF',
                backgroundColor: 'rgba(0,0,0,0.5)',
                padding: '2px 6px',
                borderRadius: '3px',
                fontSize: '10px',
              }}
            >
              {key.toUpperCase()}
            </Html>
          </Billboard>
        </group>
      );
    });
  };
  
  return (
    <group position={position as [number, number, number]}>
      {/* Planet sphere */}
      <Sphere 
        ref={planetRef} 
        args={[planetSize, 64, 64]} 
        onClick={onClick}
      >
        <meshStandardMaterial
          ref={materialRef}
          color={planetColor}
          roughness={0.7}
          metalness={0.1}
        />
      </Sphere>
      
      {/* Atmosphere layer */}
      {showAtmosphere && hasAtmosphere && (
        <Sphere ref={atmosphereRef} args={[atmosphereSize, 64, 64]}>
          <shaderMaterial 
            ref={atmosphereMaterialRef}
            vertexShader={atmosphereVertexShader}
            fragmentShader={atmosphereFragmentShader}
            uniforms={{
              planetColor: { value: new THREE.Vector3(atmosphereColor.r, atmosphereColor.g, atmosphereColor.b) },
              enhancedMode: { value: enhancedAtmosphere ? 1.0 : 0.0 }
            }}
            transparent={true}
            blending={THREE.AdditiveBlending}
            side={THREE.BackSide}
          />
        </Sphere>
      )}
      
      {/* Orbital markers */}
      {renderOrbitalMarkers()}
      
      {/* Quantum travel markers and selection indicators */}
      <BaseRenderer 
        object={object}
        selected={selected}
        showLabel={showLabel}
        actualScale={actualScale}
        onClick={onClick}
        color={planetColor}
        emissiveIntensity={0.3}
        scaleMultiplier={0.000002}
        minSize={0.01} // Small because we're rendering our own planet
      />
    </group>
  );
};

export default PlanetRenderer; 