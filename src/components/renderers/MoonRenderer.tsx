import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Sphere, Html, Billboard } from '@react-three/drei';
import * as THREE from 'three';
import { Moon } from '../../models/celestialObjects';
import BaseRenderer, { BaseRendererProps, GM_SCALE } from './BaseRenderer';

interface MoonRendererProps extends Omit<BaseRendererProps, 'object'> {
  object: Moon;
  showAtmosphere?: boolean;
  showOrbitalMarkers?: boolean;
  enhancedAtmosphere?: boolean;
}

const MoonRenderer: React.FC<MoonRendererProps> = ({
  object,
  selected,
  showLabel,
  actualScale,
  onClick,
  showAtmosphere = true,
  showOrbitalMarkers = false,
  enhancedAtmosphere = false,
}) => {
  const moonRef = useRef<THREE.Mesh>(null);
  const atmosphereRef = useRef<THREE.Mesh>(null);
  
  // Slightly faster rotation than planets
  useFrame(({ clock }) => {
    if (moonRef.current) {
      // Different moons rotate at different speeds
      const rotationSpeed = 0.03 + (object.name.charCodeAt(object.name.length - 1) % 10) * 0.004;
      moonRef.current.rotation.y = clock.getElapsedTime() * rotationSpeed;
    }
  });
  
  // Calculate sizes
  const moonSize = actualScale 
    ? object.size / GM_SCALE 
    : Math.max(object.size / GM_SCALE * 0.000004, 0.5); // Moons need slightly larger scaling than planets
  
  // Calculate atmosphere size based on atmoHeight property
  const hasAtmosphere = object.atmoHeight > 0;
  const atmosphereSize = hasAtmosphere 
    ? moonSize * (1 + (object.atmoHeight / object.size) * (enhancedAtmosphere ? 0.6 : 0.3))
    : moonSize * 1.02; // Very minimal atmosphere for moons without explicit atmosphere
  
  // Determine moon color based on its properties
  let moonColor;
  // Stanton1a - Aberdeen (sulfuric)
  if (object.name === 'stanton1a') {
    moonColor = new THREE.Color('#8A7025');
  }
  // Stanton1b - Magda (rocky)
  else if (object.name === 'stanton1b') {
    moonColor = new THREE.Color('#7A6C63');
  }
  // Stanton1c - Ita (desert)
  else if (object.name === 'stanton1c') {
    moonColor = new THREE.Color('#B59870');
  }
  // Stanton1d - Arial (desert)
  else if (object.name === 'stanton1d') {
    moonColor = new THREE.Color('#AA9585');
  }
  // Stanton2a - Cellin (rocky)
  else if (object.name === 'stanton2a') {
    moonColor = new THREE.Color('#8C8C93');
  }
  // Stanton2b - Daymar (desert)
  else if (object.name === 'stanton2b') {
    moonColor = new THREE.Color('#C4B397');
  }
  // Stanton2c - Yela (icy)
  else if (object.name === 'stanton2c') {
    moonColor = new THREE.Color('#B6C5CC');
  }
  // Stanton3a - Lyria (icy)
  else if (object.name === 'stanton3a') {
    moonColor = new THREE.Color('#98B6D7');
  }
  // Stanton3b - Wala (barren)
  else if (object.name === 'stanton3b') {
    moonColor = new THREE.Color('#525554');
  }
  // Stanton4a - Calliope (barren)
  else if (object.name === 'stanton4a') {
    moonColor = new THREE.Color('#4C4D53');
  }
  // Stanton4b - Clio (icy)
  else if (object.name === 'stanton4b') {
    moonColor = new THREE.Color('#A8D3DB');
  }
  // Stanton4c - Euterpe (barren)
  else if (object.name === 'stanton4c') {
    moonColor = new THREE.Color('#BDBDB3');
  }
  // Default moon color
  else {
    moonColor = new THREE.Color('#CCCCCC');
  }
  
  // Atmosphere color based on moon properties
  const atmosphereColor = hasAtmosphere 
    ? moonColor.clone().multiplyScalar(1.3) // Brighter atmosphere
    : moonColor.clone().multiplyScalar(1.1); // Minimal atmosphere
  
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
          <Sphere args={[0.08, 16, 16]}>
            <meshBasicMaterial color="#00CCFF" />
          </Sphere>
          <Billboard position={[0, 0.15, 0]}>
            <Html
              transform
              distanceFactor={10}
              style={{
                color: '#00CCFF',
                backgroundColor: 'rgba(0,0,0,0.5)',
                padding: '2px 4px',
                borderRadius: '2px',
                fontSize: '8px',
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
      {/* Moon sphere */}
      <Sphere 
        ref={moonRef} 
        args={[moonSize, 32, 32]} 
        onClick={onClick}
      >
        <meshStandardMaterial
          color={moonColor}
          roughness={0.85}
          metalness={0.05}
        />
      </Sphere>
      
      {/* Atmosphere layer */}
      {showAtmosphere && hasAtmosphere && (
        <Sphere ref={atmosphereRef} args={[atmosphereSize, 32, 32]}>
          <meshBasicMaterial
            color={atmosphereColor}
            transparent={true}
            opacity={enhancedAtmosphere ? 0.3 : 0.15}
            side={THREE.BackSide}
          />
        </Sphere>
      )}
      
      {/* Orbital markers */}
      {renderOrbitalMarkers()}
      
      {/* Base renderer for selection indicators and labels */}
      <BaseRenderer 
        object={object}
        selected={selected}
        showLabel={showLabel}
        actualScale={actualScale}
        onClick={onClick}
        color={moonColor}
        emissiveIntensity={0.2}
        scaleMultiplier={0.000004}
        minSize={0.01} // Small because we're rendering our own moon
      />
    </group>
  );
};

export default MoonRenderer; 