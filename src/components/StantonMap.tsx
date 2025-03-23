import { useRef, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Stars, Html } from '@react-three/drei';
import * as THREE from 'three';
import { BaseCelestialObject, StantonSystemMap } from '../models/celestialObjects';

interface CelestialBodyProps {
  object: BaseCelestialObject;
  onSelect: (name: string) => void;
}

const CelestialBody = ({ object, onSelect }: CelestialBodyProps) => {
  const meshRef = useRef<THREE.Mesh>(null);
  const [hovered, setHovered] = useState(false);
  const [clicked, setClicked] = useState(false);

  // Ensure position data exists to prevent errors
  if (!object.position || typeof object.position.x !== 'number') {
    console.error('Invalid position data for object:', object.name);
    return null; // Skip rendering this object
  }

  // Scale factor to make the map more viewable
  const scaleFactor = 1e-8;
  const position = [
    object.position.x * scaleFactor,
    object.position.y * scaleFactor,
    object.position.z * scaleFactor
  ];

  // Scale the size based on the type of celestial object
  let size = object.size * 0.00001;
  if (object.type === 'Star') size *= 2;
  else if (object.type === 'Planet') size *= 1.5;
  else if (object.type === 'JumpPoint' || object.type === 'LagrangePoint') size *= 0.5;
  
  // Minimum size to ensure visibility
  size = Math.max(size, 0.2);

  // Color based on object type
  let color = '#ffffff'; // default white
  
  switch (object.type) {
    case 'Star':
      color = '#ffcc00'; // Yellow for stars
      break;
    case 'Planet':
      color = '#3366ff'; // Blue for planets
      break;
    case 'Moon':
      color = '#cccccc'; // Gray for moons
      break;
    case 'Station':
      color = '#ff6600'; // Orange for stations
      break;
    case 'JumpPoint':
      color = '#00ffcc'; // Cyan for jump points
      break;
    case 'LagrangePoint':
      color = '#9900ff'; // Purple for lagrange points
      break;
    case 'LandingZone':
      color = '#ff3399'; // Pink for landing zones
      break;
    case 'CommArray':
      color = '#33cc33'; // Green for comm arrays
      break;
  }

  // Handle click event
  const handleClick = () => {
    setClicked(!clicked);
    onSelect(object.name);
  };

  // Simple animation on hover
  useFrame(() => {
    if (meshRef.current) {
      if (hovered) {
        meshRef.current.scale.x = meshRef.current.scale.y = meshRef.current.scale.z = 1.5;
      } else {
        meshRef.current.scale.x = meshRef.current.scale.y = meshRef.current.scale.z = 1;
      }
    }
  });

  return (
    <mesh
      ref={meshRef}
      position={[position[0], position[1], position[2]]}
      onClick={handleClick}
      onPointerOver={() => setHovered(true)}
      onPointerOut={() => setHovered(false)}
    >
      <sphereGeometry args={[size, 16, 16]} />
      <meshStandardMaterial color={clicked ? '#ff0000' : color} emissive={color} emissiveIntensity={0.5} />
      {/* Add label for the object when hovered */}
      {hovered && (
        <Html position={[0, size * 1.5, 0]}>
          <div className="label bg-black bg-opacity-70 text-white px-2 py-1 rounded text-xs whitespace-nowrap">
            {object.display_name}
          </div>
        </Html>
      )}
    </mesh>
  );
};

interface StantonMapProps {
  mapData: StantonSystemMap;
  activeFilter?: string;
  onSelectObject?: (name: string) => void;
}

const StantonMap = ({ mapData, activeFilter = 'all', onSelectObject = () => {} }: StantonMapProps) => {
  // Filter celestial objects based on activeFilter
  const objectsToRender = Object.values(mapData).filter(obj => {
    // Skip objects with invalid position data
    if (!obj.position || typeof obj.position.x !== 'number') {
      console.warn(`Skipping object with invalid position data: ${obj.name}`);
      return false;
    }
    
    if (activeFilter === 'all') return true;
    
    switch (activeFilter) {
      case 'planets':
        return obj.type === 'Planet';
      case 'moons':
        return obj.type === 'Moon';
      case 'stations':
        return obj.type === 'Station';
      case 'jumppoints':
        return obj.type === 'JumpPoint';
      case 'lagrangepoints':
        return obj.type === 'LagrangePoint';
      case 'landingzones':
        return obj.type === 'LandingZone';
      case 'commarrays':
        return obj.type === 'CommArray';
      default:
        return true;
    }
  });

  const handleSelect = (name: string) => {
    onSelectObject(name);
  };

  // Use try-catch to handle rendering errors 
  try {
    return (
      <Canvas className="h-full w-full bg-black" camera={{ position: [0, 0, 50], fov: 60 }}>
        <ambientLight intensity={0.1} />
        <pointLight position={[0, 0, 0]} intensity={1} />
        
        {/* Stars background */}
        <Stars radius={100} depth={50} count={5000} factor={4} saturation={0} fade />
        
        {/* Render celestial bodies */}
        {objectsToRender.map((object) => (
          <CelestialBody key={object.name} object={object} onSelect={handleSelect} />
        ))}
        
        <OrbitControls enablePan={true} enableZoom={true} enableRotate={true} />
      </Canvas>
    );
  } catch (error) {
    console.error('Error rendering 3D map:', error);
    return (
      <div className="h-full w-full flex items-center justify-center bg-black text-white">
        <div className="text-center p-4">
          <h3 className="text-xl mb-2">Failed to render 3D map</h3>
          <p className="mb-4">There was an error initializing the map renderer.</p>
          <p className="text-sm text-gray-400">Please try a different filter or refresh the page.</p>
        </div>
      </div>
    );
  }
};

export default StantonMap; 