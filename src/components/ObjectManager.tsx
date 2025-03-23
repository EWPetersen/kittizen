import { useEffect, useState, useMemo } from 'react';
import { useThree } from '@react-three/fiber';
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
import {
  StarRenderer,
  PlanetRenderer,
  MoonRenderer,
  JumpPointRenderer,
  LagrangePointRenderer,
  StationRenderer,
  LandingZoneRenderer
} from './renderers';

// Distance scale for the visualization
const GM_SCALE = 1e9;

interface ObjectManagerProps {
  objects: StantonSystemMap;
  selectedObjectName: string;
  onSelectObject: (name: string) => void;
  showLabels: boolean;
  actualScale: boolean;
  enhancedAtmosphere: boolean;
  visibilityFilters: {
    stars: boolean;
    planets: boolean;
    moons: boolean;
    jumpPoints: boolean;
    lagrangePoints: boolean;
    stations: boolean;
    landingZones: boolean;
  };
  zoomLevel: number;
}

// Build a hierarchical object tree from the flat list
const buildObjectTree = (objects: StantonSystemMap) => {
  const tree: Record<string, string[]> = {};
  
  // Initialize tree nodes
  Object.keys(objects).forEach(key => {
    tree[key] = [];
  });
  
  // Add children to parents
  Object.entries(objects).forEach(([key, obj]) => {
    if (obj.parent && obj.parent !== 'root' && tree[obj.parent]) {
      tree[obj.parent].push(key);
    }
  });
  
  return tree;
};

// Calculate distance from camera to help with LOD
const useDistanceFromCamera = (position: [number, number, number]) => {
  const { camera } = useThree();
  const [distance, setDistance] = useState(0);
  
  useEffect(() => {
    const cameraPos = new THREE.Vector3();
    camera.getWorldPosition(cameraPos);
    const objPos = new THREE.Vector3(...position);
    const dist = cameraPos.distanceTo(objPos);
    setDistance(dist);
  }, [camera, position]);
  
  return distance;
};

// Recursive component for object and its children
const ObjectWithChildren = ({ 
  objectName, 
  objects, 
  tree, 
  onSelect, 
  selectedObjectName,
  showLabels,
  actualScale,
  enhancedAtmosphere,
  visibilityFilters,
  zoomLevel
}: { 
  objectName: string; 
  objects: StantonSystemMap; 
  tree: Record<string, string[]>; 
  onSelect: (name: string) => void;
  selectedObjectName: string;
  showLabels: boolean;
  actualScale: boolean;
  enhancedAtmosphere: boolean;
  visibilityFilters: ObjectManagerProps['visibilityFilters'];
  zoomLevel: number;
}) => {
  const object = objects[objectName];
  if (!object) return null;
  
  // Convert position to scene coordinates
  const position: [number, number, number] = [
    object.position.x / GM_SCALE,
    object.position.y / GM_SCALE,
    object.position.z / GM_SCALE
  ];
  
  // Calculate distance from camera for LOD
  const distanceFromCamera = useDistanceFromCamera(position);
  
  // Determine if this object should be visible based on filters
  const isVisible = () => {
    if (isStar(object)) return visibilityFilters.stars;
    if (isPlanet(object)) return visibilityFilters.planets;
    if (isMoon(object)) return visibilityFilters.moons;
    if (isJumpPoint(object)) return visibilityFilters.jumpPoints;
    if (isLagrangePoint(object)) return visibilityFilters.lagrangePoints;
    if (isStation(object) || isCommArray(object)) return visibilityFilters.stations;
    if (isLandingZone(object)) return visibilityFilters.landingZones;
    return true;
  };
  
  // Determine if children should be visible based on zoom level
  const showChildren = () => {
    // Show children of the selected object regardless of zoom
    if (objectName === selectedObjectName) return true;
    
    // Stars always show children
    if (isStar(object)) return true;
    
    // Show children based on zoom level
    if (zoomLevel > 70) return true; // Show all when zoomed in a lot
    if (zoomLevel > 40 && (isPlanet(object) || isJumpPoint(object))) return true;
    if (zoomLevel > 20 && isStar(object)) return true;
    
    return false;
  };
  
  // Only render if object is visible by filter
  if (!isVisible()) return null;
  
  // Determine LOD (Level of Detail) based on distance and zoomLevel
  const getLODLevel = () => {
    // Higher number = more detail
    if (distanceFromCamera < 10 || objectName === selectedObjectName) return 3; // High detail
    if (distanceFromCamera < 50) return 2; // Medium detail
    return 1; // Low detail
  };
  
  const lodLevel = getLODLevel();
  const childrenVisible = showChildren();
  
  // Render appropriate component based on object type
  const renderObject = () => {
    const isSelected = objectName === selectedObjectName;
    const handleClick = () => onSelect(objectName);
    
    const commonProps = {
      selected: isSelected,
      showLabel: showLabels || isSelected,
      actualScale,
      onClick: handleClick
    };
    
    if (isStar(object)) {
      return <StarRenderer object={object} {...commonProps} />;
    } 
    else if (isPlanet(object)) {
      return (
        <PlanetRenderer 
          object={object} 
          {...commonProps} 
          showAtmosphere={lodLevel > 1}
          showOrbitalMarkers={lodLevel > 2 && isSelected}
          enhancedAtmosphere={enhancedAtmosphere}
        />
      );
    } 
    else if (isMoon(object)) {
      return (
        <MoonRenderer 
          object={object} 
          {...commonProps} 
          showAtmosphere={lodLevel > 1}
          showOrbitalMarkers={lodLevel > 2 && isSelected}
          enhancedAtmosphere={enhancedAtmosphere}
        />
      );
    } 
    else if (isJumpPoint(object)) {
      return (
        <JumpPointRenderer 
          object={object} 
          {...commonProps} 
          showTravelMarkers={lodLevel > 2}
        />
      );
    } 
    else if (isLagrangePoint(object)) {
      return <LagrangePointRenderer object={object} {...commonProps} />;
    } 
    else if (isStation(object)) {
      return (
        <StationRenderer 
          object={object} 
          {...commonProps} 
          showTravelMarkers={lodLevel > 2}
        />
      );
    } 
    else if (isLandingZone(object)) {
      return (
        <LandingZoneRenderer 
          object={object} 
          {...commonProps} 
          showTravelMarkers={lodLevel > 2}
        />
      );
    }
    
    return null;
  };
  
  return (
    <>
      {renderObject()}
      
      {/* Render children recursively if visible */}
      {childrenVisible && tree[objectName]?.map(childName => (
        <ObjectWithChildren 
          key={childName}
          objectName={childName}
          objects={objects}
          tree={tree}
          onSelect={onSelect}
          selectedObjectName={selectedObjectName}
          showLabels={showLabels}
          actualScale={actualScale}
          enhancedAtmosphere={enhancedAtmosphere}
          visibilityFilters={visibilityFilters}
          zoomLevel={zoomLevel}
        />
      ))}
    </>
  );
};

const ObjectManager: React.FC<ObjectManagerProps> = ({
  objects,
  selectedObjectName,
  onSelectObject,
  showLabels,
  actualScale,
  enhancedAtmosphere,
  visibilityFilters,
  zoomLevel
}) => {
  // Build the hierarchical tree
  const objectTree = useMemo(() => buildObjectTree(objects), [objects]);
  
  // Find the root object (usually the star)
  const rootObject = useMemo(() => {
    return Object.values(objects).find(obj => obj.parent === 'root')?.name || '';
  }, [objects]);
  
  if (!rootObject) return null;
  
  return (
    <ObjectWithChildren 
      objectName={rootObject}
      objects={objects}
      tree={objectTree}
      onSelect={onSelectObject}
      selectedObjectName={selectedObjectName}
      showLabels={showLabels}
      actualScale={actualScale}
      enhancedAtmosphere={enhancedAtmosphere}
      visibilityFilters={visibilityFilters}
      zoomLevel={zoomLevel}
    />
  );
};

export default ObjectManager; 