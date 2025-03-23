import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { Canvas, useThree, RootState } from '@react-three/fiber';
import { Stars, useTexture } from '@react-three/drei';
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
  CelestialObjectType,
  CommArray,
  isStar,
  isPlanet,
  isMoon
} from '../models/celestialObjects';
import StantonMapControls from './StantonMapControls';
import ControlsHelp from './ControlsHelp';
import CelestialBodyRenderer from './renderers/CelestialBodyRenderer';
import NavigationPointRenderer from './renderers/NavigationPointRenderer';
import OrbitPathRenderer from './renderers/OrbitPathRenderer';
import OrbitalDiskRenderer from './renderers/OrbitalDiskRenderer';
import './SystemMap.css';
import SystemBrowser from './SystemBrowser';
import MiniMap from './MiniMap';
import CameraSystem from './CameraSystem';

// Space background component for a more immersive environment
const SpaceBackground = () => {
  // Create a buffer for particle positions
  const particlePositions = useMemo(() => {
    const positions = new Float32Array(6000);
    for (let i = 0; i < positions.length; i += 3) {
      positions[i] = (Math.random() - 0.5) * 10000;
      positions[i + 1] = (Math.random() - 0.5) * 10000;
      positions[i + 2] = (Math.random() - 0.5) * 10000;
    }
    return positions;
  }, []);
  
  return (
    <>
      {/* Background stars with beautiful twinkle effect */}
      <Stars 
        radius={90000} 
        depth={50} 
        count={5000} 
        factor={4} 
        saturation={0.5} 
        fade
        speed={0.5}
      />
      
      {/* Distant nebula effect using a large sphere with inside-facing normals */}
      <mesh>
        <sphereGeometry args={[50000, 32, 32]} />
        <meshBasicMaterial 
          color="#050510"
          side={THREE.BackSide}
          transparent
          opacity={0.8}
        />
      </mesh>
      
      {/* Ambient dust particles for added depth */}
      <points>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            count={2000}
            array={particlePositions}
            itemSize={3}
          />
        </bufferGeometry>
        <pointsMaterial 
          size={3} 
          color="#556677" 
          transparent 
          opacity={0.2} 
          sizeAttenuation 
        />
      </points>
    </>
  );
};

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
  orbitalDisk: boolean;
  orbitPaths: boolean;
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
  
  // Help overlay state
  const [showHelp, setShowHelp] = useState<boolean>(false);
  
  // Device type detection
  const [deviceType, setDeviceType] = useState<'desktop' | 'mobile' | 'tablet'>('desktop');
  
  // Add visibility filters state
  const [visibilityFilters, setVisibilityFilters] = useState<VisibilityFilters>({
    stars: true,
    planets: true,
    moons: true,
    jumpPoints: true,
    lagrangePoints: true,
    stations: true,
    landingZones: true,
    orbitalDisk: true,
    orbitPaths: true
  });
  
  // Add selected object state
  const [selectedObject, setSelectedObject] = useState<string | null>(null);
  
  // Add enhanced atmosphere state
  const [enhancedAtmosphere, setEnhancedAtmosphere] = useState<boolean>(true);
  
  // Add labels visible state
  const [showLabels, setShowLabels] = useState<boolean>(true);
  
  // Add camera position state
  const [cameraPosition, setCameraPosition] = useState<THREE.Vector3 | null>(null);
  
  // Handle object selection
  const handleSelectObject = useCallback((objectName: string) => {
    setSelectedObject(prev => prev === objectName ? null : objectName);
  }, []);
  
  // Keyboard event handling
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    // Toggle help with ? key or H key
    if (e.key === '?' || e.key === 'h' || e.key === 'H') {
      setShowHelp(prev => !prev);
    }
  }, []);
  
  // Device type detection
  useEffect(() => {
    const handleResize = () => {
      const width = window.innerWidth;
      if (width < 768) {
        setDeviceType('mobile');
      } else if (width < 1024) {
        setDeviceType('tablet');
      } else {
        setDeviceType('desktop');
      }
    };
    
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);
  
  // Keyboard event listeners
  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);
  
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
        } else if (obj.type === 'CommArray') {
          map[key] = obj as CommArray;
        }
      });
      
      setObjectsMap(map);
    }
  }, [systemData]);

  // Find the central star for orbital disk
  const centralStar = useMemo(() => {
    if (!objectsMap || Object.keys(objectsMap).length === 0) {
      return null;
    }
    
    // Find the object with type 'Star'
    return Object.values(objectsMap).find(isStar) as Star || null;
  }, [objectsMap]);
  
  // Find all planets for orbital disk
  const planetaryObjects = useMemo(() => {
    if (!objectsMap || Object.keys(objectsMap).length === 0) {
      return [];
    }
    
    // Filter for all planets
    return Object.values(objectsMap).filter(obj => 
      isPlanet(obj) || isMoon(obj)
    );
  }, [objectsMap]);
  
  // Main rendering function
  const renderCelestialObjects = useCallback(() => {
    if (!objectsMap || Object.keys(objectsMap).length === 0) {
      return null;
    }
    
    return (
      <>
        {/* Render the orbital disk if visible */}
        {centralStar && visibilityFilters.orbitalDisk && (
          <OrbitalDiskRenderer
            centralObject={centralStar}
            planetaryObjects={planetaryObjects}
            visible={visibilityFilters.orbitalDisk}
            color="#225577"
            opacity={0.1}
            size={1.2}
          />
        )}
        
        {/* Render orbit paths for planets and moons if visible */}
        {visibilityFilters.orbitPaths && Object.entries(objectsMap).map(([key, object]) => {
          if ((isPlanet(object) || isMoon(object)) && object.position) {
            return (
              <OrbitPathRenderer
                key={`orbit-${key}`}
                object={object}
                objectsMap={objectsMap}
                visible={visibilityFilters.orbitPaths}
                color={isPlanet(object) ? "#44aaff" : "#55ccff"}
                lineWidth={isPlanet(object) ? 1.0 : 0.5}
                dashed={isMoon(object)}
              />
            );
          }
          return null;
        })}
        
        {/* Render celestial objects */}
        {Object.entries(objectsMap).map(([key, object]) => {
          // Skip objects that should not be visible based on filters
          if (
            (object.type === 'Star' && !visibilityFilters.stars) ||
            (object.type === 'Planet' && !visibilityFilters.planets) ||
            (object.type === 'Moon' && !visibilityFilters.moons) ||
            (object.type === 'JumpPoint' && !visibilityFilters.jumpPoints) ||
            (object.type === 'LagrangePoint' && !visibilityFilters.lagrangePoints) ||
            (object.type === 'Station' && !visibilityFilters.stations) ||
            (object.type === 'LandingZone' && !visibilityFilters.landingZones)
          ) {
            return null;
          }
          
          // Determine if the object is selected
          const isSelected = selectedObject === key;
          
          // Render celestial bodies (stars, planets, moons)
          if (object.type === 'Star' || object.type === 'Planet' || object.type === 'Moon') {
            return (
              <CelestialBodyRenderer
                key={key}
                object={object}
                selected={isSelected}
                scale={1.0}
                enhancedAtmosphere={enhancedAtmosphere}
                showLabel={showLabels}
                onSelect={handleSelectObject}
              />
            );
          }
          
          // Render navigation points (jump points, lagrange points, stations, landing zones, comm arrays)
          return (
            <NavigationPointRenderer
              key={key}
              object={object as JumpPoint | LagrangePoint | Station | LandingZone | CommArray}
              selected={isSelected}
              showLabel={showLabels}
              onSelect={handleSelectObject}
            />
          );
        })}
      </>
    );
  }, [objectsMap, visibilityFilters, selectedObject, enhancedAtmosphere, showLabels, handleSelectObject, centralStar, planetaryObjects]);

  // Create the scene with a dark space background and starfield
  const sceneRef = useRef<THREE.Scene>(null);
  
  // The core Three.js scene
  return (
    <div className="system-map-container">
      {/* System browser (positioned via CSS) - Now outside Canvas */}
      <div style={{ pointerEvents: 'auto' }}>
        <SystemBrowser 
          objectsMap={objectsMap}
          selectedObject={selectedObject}
          onSelectObject={(objectName: string | null) => {
            if (objectName) {
              handleSelectObject(objectName);
            }
          }}
        />
      </div>
      
      {/* MiniMap (positioned via CSS) - Now outside Canvas */}
      <div style={{ pointerEvents: 'auto' }}>
        <MiniMap 
          objectsMap={objectsMap}
          selectedObject={selectedObject}
          onSelectObject={(objectName: string) => handleSelectObject(objectName)}
          cameraPosition={cameraPosition ? cameraPosition : { x: 0, y: 0, z: 0 }}
        />
      </div>
      
      {/* Controls for toggling visibility - Now outside Canvas */}
      <div className="display-controls" style={{ pointerEvents: 'auto' }}>
        <button 
          className={`display-control-btn ${visibilityFilters.stars ? 'active' : ''}`}
          onClick={() => setVisibilityFilters(prev => ({ ...prev, stars: !prev.stars }))}
          title="Toggle Stars"
        >
          ★
        </button>
        <button 
          className={`display-control-btn ${visibilityFilters.planets ? 'active' : ''}`}
          onClick={() => setVisibilityFilters(prev => ({ ...prev, planets: !prev.planets }))}
          title="Toggle Planets"
        >
          🪐
        </button>
        <button 
          className={`display-control-btn ${visibilityFilters.moons ? 'active' : ''}`}
          onClick={() => setVisibilityFilters(prev => ({ ...prev, moons: !prev.moons }))}
          title="Toggle Moons"
        >
          🌙
        </button>
        <button 
          className={`display-control-btn ${visibilityFilters.stations ? 'active' : ''}`}
          onClick={() => setVisibilityFilters(prev => ({ ...prev, stations: !prev.stations }))}
          title="Toggle Stations"
        >
          🛰️
        </button>
        <button 
          className={`display-control-btn ${visibilityFilters.jumpPoints ? 'active' : ''}`}
          onClick={() => setVisibilityFilters(prev => ({ ...prev, jumpPoints: !prev.jumpPoints }))}
          title="Toggle Jump Points"
        >
          ⚡
        </button>
        <button 
          className={`display-control-btn ${visibilityFilters.orbitalDisk ? 'active' : ''}`}
          onClick={() => setVisibilityFilters(prev => ({ ...prev, orbitalDisk: !prev.orbitalDisk }))}
          title="Toggle Orbital Disk"
        >
          ◯
        </button>
        <button 
          className={`display-control-btn ${visibilityFilters.orbitPaths ? 'active' : ''}`}
          onClick={() => setVisibilityFilters(prev => ({ ...prev, orbitPaths: !prev.orbitPaths }))}
          title="Toggle Orbit Paths"
        >
          ⭕
        </button>
        <button 
          className={`display-control-btn ${enhancedAtmosphere ? 'active' : ''}`}
          onClick={() => setEnhancedAtmosphere(!enhancedAtmosphere)}
          title="Toggle Enhanced Atmosphere"
        >
          🌐
        </button>
        <button 
          className={`display-control-btn ${showLabels ? 'active' : ''}`}
          onClick={() => setShowLabels(!showLabels)}
          title="Toggle Labels"
        >
          🏷️
        </button>
      </div>
      
      {/* Help toggle button in the UI */}
      {!showHelp && (
        <div 
          className="help-button"
          onClick={() => setShowHelp(true)}
          title="Show Controls Help"
        >
          ?
        </div>
      )}
      
      <Canvas 
        gl={{ 
          antialias: true,
          logarithmicDepthBuffer: true // Important for handling the extreme scale differences
        }}
        shadows
        dpr={[1, 2]} // Responsive to device pixel ratio
        camera={{ 
          position: [0, 0, 2000],
          fov: 60,
          near: 0.1,
          far: 100000
        }}
        onCreated={(state: RootState) => {
          // Store camera position for the MiniMap
          setCameraPosition(state.camera.position);
          
          // Set up camera position change listener
          const unsubscribe = state.gl.render.bind(state.gl);
          state.gl.render = (...args) => {
            setCameraPosition(state.camera.position);
            return unsubscribe(...args);
          };
        }}
      >
        {/* Enhanced space background */}
        <SpaceBackground />
        
        {/* Ambient light to provide base illumination */}
        <ambientLight intensity={0.1} />
        
        {/* Main directional light from the star */}
        <directionalLight 
          position={[0, 0, 0]} 
          intensity={1.5} 
          color="#FFF9E0"
        />
        
        {/* Render all celestial objects */}
        {renderCelestialObjects()}
        
        {/* CameraSystem (only the camera controls should be inside the Canvas) */}
        <CameraSystem 
          objectsMap={objectsMap}
          selectedObject={selectedObject}
        />
      </Canvas>
      
      {/* Help overlay */}
      <ControlsHelp 
        isVisible={showHelp}
        onClose={() => setShowHelp(false)}
        deviceType={deviceType}
      />
    </div>
  );
};

export default SystemMap; 