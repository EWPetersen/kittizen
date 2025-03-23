import { useRef, useState, useEffect, useMemo } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { 
  OrbitControls, 
  Stars, 
  Html, 
  Sphere, 
  Text, 
  GizmoHelper, 
  GizmoViewport,
  useHelper,
  Line,
  Billboard
} from '@react-three/drei';
import * as THREE from 'three';
import { 
  BaseCelestialObject, 
  StantonSystemMap, 
  isStar, 
  isPlanet, 
  isMoon, 
  isJumpPoint,
  isLagrangePoint, 
  isStation,
  isCommArray,
  isLandingZone
} from '../models/celestialObjects';

// Conversion factor - 1 Gm = 1,000,000,000 meters
const GM_SCALE = 1e9;

// Object type enum to ensure type safety
enum ObjectType {
  STAR = 'STAR',
  PLANET = 'PLANET',
  MOON = 'MOON',
  JUMP_POINT = 'JUMP_POINT',
  LAGRANGE_POINT = 'LAGRANGE_POINT',
  STATION = 'STATION',
  COMM_ARRAY = 'COMM_ARRAY',
  LANDING_ZONE = 'LANDING_ZONE'
}

// Configuration object for visualizations
const CONFIG = {
  // Scale factors for object sizes for better visualization
  SCALES: {
    [ObjectType.STAR]: 100,
    [ObjectType.PLANET]: 50,
    [ObjectType.MOON]: 30,
    [ObjectType.JUMP_POINT]: 2,
    [ObjectType.LAGRANGE_POINT]: 1,
    [ObjectType.STATION]: 5,
    [ObjectType.COMM_ARRAY]: 3,
    [ObjectType.LANDING_ZONE]: 2,
  },
  // Minimum sizes to ensure visibility
  MIN_SIZES: {
    [ObjectType.STAR]: 2.0,
    [ObjectType.PLANET]: 1.0,
    [ObjectType.MOON]: 0.5,
    [ObjectType.JUMP_POINT]: 0.3,
    [ObjectType.LAGRANGE_POINT]: 0.2,
    [ObjectType.STATION]: 0.3,
    [ObjectType.COMM_ARRAY]: 0.2,
    [ObjectType.LANDING_ZONE]: 0.2,
  },
  // Colors for different object types
  COLORS: {
    [ObjectType.STAR]: new THREE.Color('#FFCC00'),
    [ObjectType.PLANET]: new THREE.Color('#3366FF'),
    [ObjectType.MOON]: new THREE.Color('#CCCCCC'),
    [ObjectType.JUMP_POINT]: new THREE.Color('#00FFCC'),
    [ObjectType.LAGRANGE_POINT]: new THREE.Color('#9900FF'),
    [ObjectType.STATION]: new THREE.Color('#FF6600'),
    [ObjectType.COMM_ARRAY]: new THREE.Color('#33CC33'),
    [ObjectType.LANDING_ZONE]: new THREE.Color('#FF3399'),
  },
  // Emission intensities
  EMISSION: {
    [ObjectType.STAR]: 1.5,
    [ObjectType.PLANET]: 0.5,
    [ObjectType.MOON]: 0.3,
    [ObjectType.JUMP_POINT]: 0.8,
    [ObjectType.LAGRANGE_POINT]: 0.5,
    [ObjectType.STATION]: 0.7,
    [ObjectType.COMM_ARRAY]: 0.6,
    [ObjectType.LANDING_ZONE]: 0.7,
  },
}; 

// Scene grid component
const SceneGrid = () => {
  return (
    <>
      {/* X-Y Plane Grid - represents the primary plane of the system */}
      <gridHelper 
        args={[1000, 100, 0x444444, 0x222222]} 
        position={[0, 0, 0]} 
        rotation={[0, 0, 0]}
      />
      
      {/* Coordinate axes */}
      <axesHelper args={[500]} />
      
      {/* Scale indicator - 1 unit = 1 Gm */}
      <Text 
        position={[500, 10, 0]} 
        color="white" 
        fontSize={10}
        anchorX="left"
      >
        500 Gm
      </Text>
    </>
  );
};

// Atmosphere component for planets with atmosphere
interface AtmosphereProps {
  size: number;
  atmoHeight: number;
  color: THREE.Color;
}

const Atmosphere = ({ size, atmoHeight, color }: AtmosphereProps) => {
  // Only render if there's a significant atmosphere
  if (!atmoHeight || atmoHeight < 100) return null;
  
  const atmoSize = size * (1 + atmoHeight / size * 0.05);
  
  return (
    <Sphere args={[atmoSize, 30, 30]}>
      <meshBasicMaterial 
        color={color}
        transparent={true}
        opacity={0.15}
      />
    </Sphere>
  );
};

// Quantum travel markers for arrivalDistance and obstructionDistance
interface QuantumTravelMarkersProps {
  object: BaseCelestialObject;
}

const QuantumTravelMarkers = ({ object }: QuantumTravelMarkersProps) => {
  // Only render for objects with significant arrival/obstruction radii
  if (object.arrivalRadius <= 0 && object.obstructionRadius <= 0) return null;
  
  // Scale down the actual distances for visualization purposes
  const arrivalScale = 0.01;
  const obstructionScale = 0.01;
  
  const arrivalRadius = object.arrivalRadius * arrivalScale;
  const obstructionRadius = object.obstructionRadius * obstructionScale;
  
  return (
    <>
      {object.arrivalRadius > 0 && (
        <Sphere args={[arrivalRadius, 32, 16]} position={[0, 0, 0]}>
          <meshBasicMaterial color="#00FF00" transparent={true} opacity={0.1} wireframe={true} />
        </Sphere>
      )}
      
      {object.obstructionRadius > 0 && (
        <Sphere args={[obstructionRadius, 32, 16]} position={[0, 0, 0]}>
          <meshBasicMaterial color="#FF0000" transparent={true} opacity={0.1} wireframe={true} />
        </Sphere>
      )}
    </>
  );
};

// Component for celestial objects (star, planets, moons, etc.)
interface CelestialBodyProps {
  object: BaseCelestialObject;
  onSelect: (name: string) => void;
  showLabels: boolean;
  actualScale: boolean;
  selected: boolean;
}

const CelestialBody = ({ object, onSelect, showLabels, actualScale, selected }: CelestialBodyProps) => {
  const groupRef = useRef<THREE.Group>(null);
  const meshRef = useRef<THREE.Mesh>(null);
  const groupMeshRef = useRef<THREE.Group>(null);
  const [hovered, setHovered] = useState(false);
  const labelRef = useRef<THREE.Group>(null);

  // Scale down the positions to fit the scene
  const positionScale = 1 / GM_SCALE;
  const position = useMemo(() => [
    object.position.x * positionScale,
    object.position.y * positionScale,
    object.position.z * positionScale
  ], [object.position]);

  // Determine the object's type and apply appropriate visual properties
  const objectConfig = useMemo(() => {
    let objectType: ObjectType;

    if (isStar(object)) {
      objectType = ObjectType.STAR;
    } else if (isPlanet(object)) {
      objectType = ObjectType.PLANET;
    } else if (isMoon(object)) {
      objectType = ObjectType.MOON;
    } else if (isJumpPoint(object)) {
      objectType = ObjectType.JUMP_POINT;
    } else if (isLagrangePoint(object)) {
      objectType = ObjectType.LAGRANGE_POINT;
    } else if (isStation(object)) {
      objectType = ObjectType.STATION;
    } else if (isCommArray(object)) {
      objectType = ObjectType.COMM_ARRAY;
    } else if (isLandingZone(object)) {
      objectType = ObjectType.LANDING_ZONE;
    } else {
      objectType = ObjectType.STATION; // Default fallback
    }

    // Get configuration values for this object type
    const scale = CONFIG.SCALES[objectType];
    const minSize = CONFIG.MIN_SIZES[objectType];
    const color = CONFIG.COLORS[objectType];
    const emissive = CONFIG.EMISSION[objectType];

    // Calculate size based on actual size and minimum visibility requirements
    let scaledSize;
    if (actualScale) {
      // Use the real scale (converted from meters to Gm)
      scaledSize = object.size / GM_SCALE;
    } else {
      // Use enhanced visualization scale
      scaledSize = Math.max(object.size * scale * 1e-9, minSize);
    }

    return { objectType, scaledSize, color, emissive };
  }, [object, actualScale]);

  // Special rendering for different types of objects
  const renderSpecialObject = () => {
    const { objectType, scaledSize, color, emissive } = objectConfig;

    if (objectType === ObjectType.STAR) {
      return (
        <Sphere args={[scaledSize, 32, 32]} ref={meshRef}>
          <meshStandardMaterial 
            color={color} 
            emissive={color} 
            emissiveIntensity={emissive}
          />
          {/* Star glow effect */}
          <Sphere args={[scaledSize * 1.2, 32, 32]}>
            <meshBasicMaterial color={color} transparent opacity={0.1} />
          </Sphere>
        </Sphere>
      );
    }
    
    if (objectType === ObjectType.JUMP_POINT) {
      return (
        <group ref={groupMeshRef}>
          {/* Jump point visualization - glowing torus */}
          <mesh rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[scaledSize, scaledSize * 0.3, 16, 50]} />
            <meshStandardMaterial 
              color={color} 
              emissive={color} 
              emissiveIntensity={emissive}
            />
          </mesh>
        </group>
      );
    }
    
    if (objectType === ObjectType.LAGRANGE_POINT) {
      return (
        <group ref={groupMeshRef}>
          {/* Lagrange point - octahedron marker */}
          <mesh>
            <octahedronGeometry args={[scaledSize]} />
            <meshStandardMaterial 
              color={color} 
              emissive={color}
              emissiveIntensity={emissive}
              transparent
              opacity={0.8}
            />
          </mesh>
        </group>
      );
    }
    
    if (objectType === ObjectType.PLANET || objectType === ObjectType.MOON) {
      return (
        <group ref={groupMeshRef}>
          <Sphere args={[scaledSize, 32, 32]}>
            <meshStandardMaterial 
              color={color} 
              emissive={color} 
              emissiveIntensity={emissive * 0.5}
            />
          </Sphere>
          <Atmosphere 
            size={scaledSize} 
            atmoHeight={object.atmoHeight} 
            color={color} 
          />
        </group>
      );
    }
    
    if (objectType === ObjectType.STATION) {
      return (
        <group ref={groupMeshRef}>
          {/* Station - cube with satellite dish look */}
          <mesh>
            <boxGeometry args={[scaledSize, scaledSize * 0.5, scaledSize]} />
            <meshStandardMaterial 
              color={color} 
              emissive={color} 
              emissiveIntensity={emissive}
            />
          </mesh>
          <mesh position={[0, scaledSize * 0.4, 0]} rotation={[Math.PI/4, 0, 0]}>
            <cylinderGeometry args={[scaledSize * 0.3, scaledSize * 0.4, scaledSize * 0.1, 16]} />
            <meshStandardMaterial 
              color={color} 
              emissive={color} 
              emissiveIntensity={emissive}
            />
          </mesh>
        </group>
      );
    }
    
    // Default for other types (CommArray, LandingZone, etc.)
    return (
      <mesh ref={meshRef}>
        <sphereGeometry args={[scaledSize, 16, 16]} />
        <meshStandardMaterial 
          color={color} 
          emissive={color} 
          emissiveIntensity={emissive}
        />
      </mesh>
    );
  };

  // Update label position to face camera and handle pulse effect
  useFrame(({ camera }) => {
    if (labelRef.current) {
      labelRef.current.lookAt(camera.position);
    }
    
    // Pulse effect for hovered or selected objects
    if (hovered || selected) {
      const pulseScale = 1 + Math.sin(Date.now() * 0.005) * 0.1;
      
      if (meshRef.current) {
        meshRef.current.scale.set(pulseScale, pulseScale, pulseScale);
      }
      
      if (groupMeshRef.current) {
        groupMeshRef.current.scale.set(pulseScale, pulseScale, pulseScale);
      }
    } else {
      if (meshRef.current) {
        meshRef.current.scale.set(1, 1, 1);
      }
      
      if (groupMeshRef.current) {
        groupMeshRef.current.scale.set(1, 1, 1);
      }
    }
  });

  // Handler for clicking on objects
  const handleClick = () => {
    onSelect(object.name);
  };

  // Return the complete object with event handlers
  return (
    <group 
      ref={groupRef}
      position={[position[0], position[1], position[2]]}
      onClick={handleClick}
      onPointerOver={() => setHovered(true)}
      onPointerOut={() => setHovered(false)}
    >
      {renderSpecialObject()}
      
      {/* Quantum travel markers */}
      <QuantumTravelMarkers object={object} />
      
      {/* Object label */}
      {(showLabels || hovered || selected) && (
        <Billboard ref={labelRef} position={[0, objectConfig.scaledSize * 1.5, 0]}>
          <Text 
            color={selected ? "#FFFFFF" : hovered ? "#FFFF00" : "#AAAAAA"}
            fontSize={0.5}
            anchorX="center"
            anchorY="bottom"
          >
            {object.display_name}
          </Text>
        </Billboard>
      )}
    </group>
  );
};

// Component to handle rendering children objects
interface ChildrenObjectsProps {
  parent: string;
  objects: StantonSystemMap;
  onSelect: (name: string) => void;
  showLabels: boolean;
  actualScale: boolean;
  selectedName: string;
}

const ChildrenObjects = ({ 
  parent, 
  objects, 
  onSelect, 
  showLabels, 
  actualScale, 
  selectedName 
}: ChildrenObjectsProps) => {
  // Filter all objects that have this parent
  const children = useMemo(() => {
    return Object.values(objects).filter(obj => obj.parent === parent);
  }, [objects, parent]);
  
  if (children.length === 0) return null;
  
  return (
    <>
      {children.map((child) => (
        <group key={child.name}>
          <CelestialBody 
            object={child} 
            onSelect={onSelect} 
            showLabels={showLabels} 
            actualScale={actualScale}
            selected={selectedName === child.name}
          />
          <ChildrenObjects 
            parent={child.name} 
            objects={objects} 
            onSelect={onSelect} 
            showLabels={showLabels} 
            actualScale={actualScale}
            selectedName={selectedName}
          />
        </group>
      ))}
    </>
  );
};

interface StantonMapProps {
  mapData: StantonSystemMap;
  activeFilter?: string;
  onSelectObject?: (name: string) => void;
  showLabels?: boolean;
  showGrid?: boolean;
  actualScale?: boolean;
  selectedObjectName?: string;
}

const StantonMap = ({ 
  mapData, 
  activeFilter = 'all', 
  onSelectObject = () => {},
  showLabels = false,
  showGrid = true,
  actualScale = false,
  selectedObjectName = '',
}: StantonMapProps) => {
  const [rootObject, setRootObject] = useState<BaseCelestialObject | null>(null);
  
  // Find the root object (star) when the data changes
  useEffect(() => {
    if (!mapData) return;
    
    // Find the Stanton star as the root object
    const star = Object.values(mapData).find(obj => {
      return obj.type === 'Star' || obj.name.toLowerCase().includes('stantonstar');
    });
    
    if (star) {
      setRootObject(star);
    } else {
      console.error('No star found in the system data');
    }
  }, [mapData]);
  
  // Filter objects based on active filter
  const filteredObjects = useMemo(() => {
    if (!mapData) return [];
    
    return Object.values(mapData).filter(obj => {
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
  }, [mapData, activeFilter]);

  const handleSelect = (name: string) => {
    onSelectObject(name);
  };

  // Use try-catch to handle rendering errors 
  try {
    return (
      <Canvas className="h-full w-full bg-black" camera={{ position: [0, 0, 150], fov: 50 }}>
        {/* Scene lighting */}
        <ambientLight intensity={0.1} />
        
        {/* Star light at the center */}
        {rootObject && (
          <pointLight 
            position={[
              rootObject.position.x / GM_SCALE, 
              rootObject.position.y / GM_SCALE, 
              rootObject.position.z / GM_SCALE
            ]} 
            intensity={2}
            color="#FFCC00" 
            distance={1000}
          />
        )}
        
        {/* Background stars */}
        <Stars radius={500} depth={100} count={10000} factor={5} saturation={0.5} fade />
        
        {/* Grid and helpers */}
        {showGrid && <SceneGrid />}
        
        {/* Gizmo helper for orientation */}
        <GizmoHelper alignment="bottom-right" margin={[80, 80]}>
          <GizmoViewport labelColor="white" axisHeadScale={1} />
        </GizmoHelper>
        
        {/* Render the root object (star) first */}
        {rootObject && (
          <CelestialBody 
            key={rootObject.name} 
            object={rootObject} 
            onSelect={handleSelect} 
            showLabels={showLabels}
            actualScale={actualScale}
            selected={selectedObjectName === rootObject.name}
          />
        )}
        
        {/* Render all child objects recursively in a hierarchical structure */}
        {rootObject && (
          <ChildrenObjects 
            parent={rootObject.name} 
            objects={mapData} 
            onSelect={handleSelect} 
            showLabels={showLabels}
            actualScale={actualScale}
            selectedName={selectedObjectName}
          />
        )}
        
        {/* Camera controls */}
        <OrbitControls 
          enablePan={true} 
          enableZoom={true} 
          enableRotate={true} 
          maxDistance={500}
          minDistance={0.1}
        />
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