import { useRef, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Stars } from '@react-three/drei';
import * as THREE from 'three';
import { getStantonData, getCelestialObjectsByType } from '../services/stantonService';
import { CelestialObject } from '../models/types';

interface CelestialBodyProps {
  object: CelestialObject;
  onSelect: (id: string) => void;
}

const CelestialBody = ({ object, onSelect }: CelestialBodyProps) => {
  const meshRef = useRef<THREE.Mesh>(null);
  const [hovered, setHovered] = useState(false);
  const [clicked, setClicked] = useState(false);

  // Scale factor to make the map more viewable
  const scaleFactor = 1e-8;
  const position = [
    object.position[0] * scaleFactor,
    object.position[1] * scaleFactor,
    object.position[2] * scaleFactor
  ];

  // Scale the size based on the type of celestial object
  let size = object.size * 0.00001;
  if (object.type === 'star') size *= 2;
  else if (object.type === 'planet') size *= 1.5;
  else if (object.type === 'point_of_interest') size *= 0.5;

  // Minimum size to ensure visibility
  size = Math.max(size, 0.2);

  // Simple animation for highlighting
  useFrame(() => {
    if (meshRef.current) {
      meshRef.current.rotation.y += 0.01;
      if (hovered) {
        meshRef.current.scale.x = 1.2;
        meshRef.current.scale.y = 1.2;
        meshRef.current.scale.z = 1.2;
      } else {
        meshRef.current.scale.x = 1;
        meshRef.current.scale.y = 1;
        meshRef.current.scale.z = 1;
      }
    }
  });

  const handleClick = () => {
    setClicked(!clicked);
    onSelect(object.id);
  };

  return (
    <mesh
      ref={meshRef}
      position={position as [number, number, number]}
      onClick={handleClick}
      onPointerOver={() => setHovered(true)}
      onPointerOut={() => setHovered(false)}
    >
      {object.type === 'star' ? (
        <sphereGeometry args={[size, 32, 32]} />
      ) : (
        <sphereGeometry args={[size, 16, 16]} />
      )}
      <meshStandardMaterial
        color={object.color || '#ffffff'}
        emissive={object.type === 'star' ? object.color : undefined}
        emissiveIntensity={object.type === 'star' ? 2 : 0}
        metalness={object.type === 'station' ? 0.8 : 0.2}
        roughness={0.5}
      />
    </mesh>
  );
};

interface StantonMapProps {
  activeFilter?: string;
  onSelectObject?: (id: string) => void;
}

const StantonMap = ({ activeFilter = 'all', onSelectObject = () => {} }: StantonMapProps) => {
  const celestialObjects = getStantonData();
  
  // Filter the objects based on the active filter
  const filteredObjects = (() => {
    if (activeFilter === 'all') return celestialObjects;
    if (activeFilter === 'stars') return getCelestialObjectsByType('star');
    if (activeFilter === 'planets') return getCelestialObjectsByType('planet');
    if (activeFilter === 'moons') return getCelestialObjectsByType('moon');
    if (activeFilter === 'stations') return getCelestialObjectsByType('station');
    if (activeFilter === 'poi') return getCelestialObjectsByType('point_of_interest');
    return celestialObjects;
  })();

  const handleSelect = (id: string) => {
    if (onSelectObject) {
      onSelectObject(id);
    }
  };

  return (
    <div className="w-full h-full bg-sc-dark">
      <Canvas className="w-full h-full" camera={{ position: [0, 0, 15], fov: 60 }}>
        <ambientLight intensity={0.1} />
        <pointLight position={[0, 0, 0]} intensity={2} color="#FFFF00" />
        <Stars radius={100} depth={50} count={5000} factor={4} />
        <OrbitControls enablePan={true} enableZoom={true} enableRotate={true} />
        
        {filteredObjects.map((object) => (
          <CelestialBody key={object.id} object={object} onSelect={handleSelect} />
        ))}
      </Canvas>
    </div>
  );
};

export default StantonMap; 