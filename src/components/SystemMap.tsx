import { useState, useEffect, useRef, useMemo } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { OrbitControls, Stars, PerspectiveCamera } from '@react-three/drei';
import * as THREE from 'three';
import { 
  StantonSystemMap, 
  BaseCelestialObject,
  Star,
  Planet,
  Moon,
  JumpPoint,
  LagrangePoint,
  Station,
  LandingZone,
  CelestialObjectType
} from '../models/celestialObjects';
import ObjectManager from './ObjectManager';
import ObjectDetails from './ObjectDetails';
import './SystemMap.css';

// Distance scale for the visualization
const GM_SCALE = 1e9;

// Define types for the filter states
interface VisibilityFilters {
  stars: boolean;
  planets: boolean;
  moons: boolean;
  jumpPoints: boolean;
  lagrangePoints: boolean;
  stations: boolean;
  landingZones: boolean;
}

interface CameraController {
  targetObject?: string;
  resetView: () => void;
}

interface SystemMapData {
  [key: string]: {
    name: string;
    display_name: string;
    type: string;
    parent: string;
    position: {
      x: number;
      y: number;
      z: number;
    };
    rotation: {
      w: number;
      x: number;
      y: number;
      z: number;
    };
    size: number;
    arrivalRadius: number;
    obstructionRadius: number;
    atmoHeight: number;
    system_entity_name: string;
    orbitalMarkers?: {
      om1: { x: number; y: number; z: number };
      om2: { x: number; y: number; z: number };
      om3: { x: number; y: number; z: number };
      om4: { x: number; y: number; z: number };
      om5: { x: number; y: number; z: number };
      om6: { x: number; y: number; z: number };
    };
  };
}

export const SystemMap = ({ systemData }: { systemData: SystemMapData }) => {
  // Debug log for incoming data
  console.log("SystemMap received data:", { 
    dataType: typeof systemData, 
    isObject: systemData !== null && typeof systemData === 'object',
    keyCount: systemData ? Object.keys(systemData).length : 0,
    sampleKeys: systemData ? Object.keys(systemData).slice(0, 5) : []
  });
  
  // Convert system data to the expected format for the components
  const [objectsMap, setObjectsMap] = useState<StantonSystemMap>({});
  
  // Selected object state
  const [selectedObject, setSelectedObject] = useState<string | null>(null);
  
  // Camera control
  const cameraControllerRef = useRef<CameraController | null>(null);
  
  // Visibility filters with default values
  const [filters, setFilters] = useState<VisibilityFilters>({
    stars: true,
    planets: true,
    moons: true,
    jumpPoints: true,
    lagrangePoints: true,
    stations: true,
    landingZones: true
  });

  const [showLabels, setShowLabels] = useState(true);
  const [showOrbitalMarkers, setShowOrbitalMarkers] = useState(true);
  const [actualScale, setActualScale] = useState(false);
  const [enhancedAtmosphere, setEnhancedAtmosphere] = useState(true);

  // Zoom threshold levels for different object types
  const zoomLevels = useMemo(() => ({
    stars: 0, // Always visible
    planets: 0, // Always visible
    moons: 0.3,
    jumpPoints: 0.4,
    lagrangePoints: 0.5,
    stations: 0.6,
    landingZones: 0.7,
    labels: 0.2
  }), []);

  // Process the system data into a map keyed by object names
  useEffect(() => {
    if (systemData) {
      const map: StantonSystemMap = {};
      
      // Process all objects from the flat structure
      Object.entries(systemData).forEach(([key, obj]: [string, any]) => {
        // Add to the map with the correct typing based on the object type
        if (obj.type === 'Star') {
          map[key] = obj as Star;
        } else if (obj.type === 'Planet') {
          map[key] = obj as Planet;
        } else if (obj.type === 'Moon') {
          map[key] = obj as Moon;
        } else if (obj.type === 'JumpPoint') {
          map[key] = obj as JumpPoint;
        } else if (obj.type === 'LagrangePoint') {
          map[key] = obj as LagrangePoint;
        } else if (obj.type === 'Station') {
          map[key] = obj as Station;
        } else if (obj.type === 'LandingZone') {
          map[key] = obj as LandingZone;
        }
      });
      
      setObjectsMap(map);
    }
  }, [systemData]);

  // Handle filter changes
  const toggleFilter = (filterName: keyof VisibilityFilters) => {
    setFilters(prev => ({
      ...prev,
      [filterName]: !prev[filterName]
    }));
  };

  // Handle special toggles
  const toggleLabels = () => setShowLabels(prev => !prev);
  const toggleOrbitalMarkers = () => setShowOrbitalMarkers(prev => !prev);
  const toggleActualScale = () => setActualScale(prev => !prev);
  const toggleEnhancedAtmosphere = () => setEnhancedAtmosphere(prev => !prev);

  // Handle object selection
  const handleObjectSelect = (objectName: string | null) => {
    setSelectedObject(objectName);
    
    // Focus camera on selected object
    if (objectName && cameraControllerRef.current) {
      cameraControllerRef.current.targetObject = objectName;
    }
  };

  // Camera controller component
  const CameraControls = () => {
    const { camera, gl } = useThree();
    const controlsRef = useRef<any>();
    const [zoomLevel, setZoomLevel] = useState(0);
    
    useEffect(() => {
      cameraControllerRef.current = {
        targetObject: undefined,
        resetView: () => {
          if (controlsRef.current) {
            controlsRef.current.reset();
          }
        }
      };
      
      return () => {
        cameraControllerRef.current = null;
      };
    }, []);
    
    useEffect(() => {
      if (cameraControllerRef.current?.targetObject && objectsMap[cameraControllerRef.current.targetObject]) {
        const target = objectsMap[cameraControllerRef.current.targetObject]!;
        const position = new THREE.Vector3(
          target.position.x / GM_SCALE,
          target.position.y / GM_SCALE,
          target.position.z / GM_SCALE
        );
        
        controlsRef.current.target.copy(position);
        
        // Adjust camera position based on object size
        const objectSize = target.size || 1000;  // Default size if size not available
        const distance = objectSize * 3;  // Position camera 3x the object's radius away
        
        const cameraOffset = new THREE.Vector3(distance, distance, distance).normalize().multiplyScalar(distance);
        camera.position.copy(position).add(cameraOffset);
        
        controlsRef.current.update();
      }
    }, [camera, selectedObject, objectsMap]);
    
    return (
      <OrbitControls
        ref={controlsRef}
        args={[camera, gl.domElement]}
        enableDamping
        dampingFactor={0.05}
        rotateSpeed={0.5}
        zoomSpeed={0.5}
        panSpeed={0.5}
        minDistance={0.01}
        maxDistance={2000}
        onChange={() => {
          // Calculate zoom level based on camera distance
          const distance = camera.position.distanceTo(controlsRef.current.target);
          const normalizedZoom = 1 - Math.min(1, Math.max(0, distance / 1000));
          setZoomLevel(normalizedZoom);
        }}
      />
    );
  };

  return (
    <div className="system-map-container">
      <div className="controls-panel">
        <h2>Stanton System Explorer</h2>
        <div className="filter-controls">
          <h3>Visibility Filters</h3>
          <div className="filter-group">
            <label>
              <input
                type="checkbox"
                checked={filters.stars}
                onChange={() => toggleFilter('stars')}
              />
              Stars
            </label>
            <label>
              <input
                type="checkbox"
                checked={filters.planets}
                onChange={() => toggleFilter('planets')}
              />
              Planets
            </label>
            <label>
              <input
                type="checkbox"
                checked={filters.moons}
                onChange={() => toggleFilter('moons')}
              />
              Moons
            </label>
            <label>
              <input
                type="checkbox"
                checked={filters.jumpPoints}
                onChange={() => toggleFilter('jumpPoints')}
              />
              Jump Points
            </label>
            <label>
              <input
                type="checkbox"
                checked={filters.lagrangePoints}
                onChange={() => toggleFilter('lagrangePoints')}
              />
              Lagrange Points
            </label>
            <label>
              <input
                type="checkbox"
                checked={filters.stations}
                onChange={() => toggleFilter('stations')}
              />
              Stations
            </label>
            <label>
              <input
                type="checkbox"
                checked={filters.landingZones}
                onChange={() => toggleFilter('landingZones')}
              />
              Landing Zones
            </label>
          </div>
          <div className="filter-group">
            <label>
              <input
                type="checkbox"
                checked={showOrbitalMarkers}
                onChange={toggleOrbitalMarkers}
              />
              Orbital Markers
            </label>
            <label>
              <input
                type="checkbox"
                checked={showLabels}
                onChange={toggleLabels}
              />
              Labels
            </label>
            <label>
              <input
                type="checkbox"
                checked={actualScale}
                onChange={toggleActualScale}
              />
              Actual Scale
            </label>
            <label>
              <input
                type="checkbox"
                checked={enhancedAtmosphere}
                onChange={toggleEnhancedAtmosphere}
              />
              Enhanced Atmosphere
            </label>
          </div>
        </div>
        <div className="view-controls">
          <h3>View Controls</h3>
          <button onClick={() => cameraControllerRef.current?.resetView()}>
            Reset View
          </button>
          <button onClick={() => handleObjectSelect(null)}>
            Clear Selection
          </button>
        </div>
      </div>
      
      <div className="canvas-container">
        <Canvas
          shadows
          gl={{ alpha: false, antialias: true }}
          camera={{ position: [0, 30, 100], fov: 60 }}
        >
          <fog attach="fog" args={['#000', 100, 1000]} />
          <color attach="background" args={['#000']} />
          
          <CameraControls />
          <Stars radius={200} depth={50} count={5000} factor={4} saturation={0} fade speed={0.5} />
          
          <ambientLight intensity={0.1} />
          <directionalLight
            position={[0, 0, 0]}
            intensity={1}
            castShadow
            shadow-mapSize-width={2048}
            shadow-mapSize-height={2048}
          />
          
          <ObjectManager
            objects={objectsMap}
            selectedObjectName={selectedObject || ''}
            onSelectObject={(name: string) => handleObjectSelect(name)}
            showLabels={showLabels}
            actualScale={actualScale}
            enhancedAtmosphere={enhancedAtmosphere}
            visibilityFilters={filters}
            zoomLevel={0.5} // This will be updated by the CameraControls
          />
        </Canvas>
      </div>
      
      {selectedObject && (
        <ObjectDetails
          selectedObjectName={selectedObject}
          objects={objectsMap}
          onClose={() => setSelectedObject(null)}
          onSelectObject={(name: string) => handleObjectSelect(name)}
        />
      )}
    </div>
  );
};

export default SystemMap; 