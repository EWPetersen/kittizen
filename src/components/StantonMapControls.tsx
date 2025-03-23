import React, { useRef, useState, useEffect, useCallback } from 'react';
import { useThree, useFrame, extend } from '@react-three/fiber';
import * as THREE from 'three';
import { Html } from '@react-three/drei';
import { StantonSystemMap, BaseCelestialObject } from '../models/celestialObjects';
import CameraSystem, { CameraSystemRef } from './CameraSystem';
import SystemBrowser from './SystemBrowser';
import MiniMap from './MiniMap';
import './StantonMapControls.css';

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

interface StantonMapControlsProps {
  objectsMap: StantonSystemMap;
  visibilityFilters?: VisibilityFilters;
  onUpdateFilters?: (filters: VisibilityFilters) => void;
  selectedObject?: string | null;
  onSelectObject?: (objectName: string) => void;
  enhancedAtmosphere?: boolean;
  onToggleAtmosphere?: (value: boolean) => void;
  showLabels?: boolean;
  onToggleLabels?: (value: boolean) => void;
}

// Focus mode types
type FocusMode = 'system' | 'star' | 'planet' | 'moon' | 'station' | 'jumpPoint' | 'lagrangePoint';

const StantonMapControls: React.FC<StantonMapControlsProps> = ({ 
  objectsMap,
  visibilityFilters,
  onUpdateFilters,
  selectedObject: externalSelectedObject,
  onSelectObject: externalSelectObject,
  enhancedAtmosphere,
  onToggleAtmosphere,
  showLabels,
  onToggleLabels
}) => {
  const { camera } = useThree();

  // Use internal state if no external state is provided
  const [internalSelectedObject, setInternalSelectedObject] = useState<string | null>(null);
  const actualSelectedObject = externalSelectedObject !== undefined ? externalSelectedObject : internalSelectedObject;
  
  const [internalVisibilityFilters, setInternalVisibilityFilters] = useState<VisibilityFilters>({
    stars: true,
    planets: true,
    moons: true,
    jumpPoints: true,
    lagrangePoints: true,
    stations: true,
    landingZones: true
  });
  
  const actualVisibilityFilters = visibilityFilters || internalVisibilityFilters;
  
  const [internalEnhancedAtmosphere, setInternalEnhancedAtmosphere] = useState<boolean>(true);
  const actualEnhancedAtmosphere = enhancedAtmosphere !== undefined ? enhancedAtmosphere : internalEnhancedAtmosphere;
  
  const [internalShowLabels, setInternalShowLabels] = useState<boolean>(true);
  const actualShowLabels = showLabels !== undefined ? showLabels : internalShowLabels;
  
  // Camera reference
  const cameraRef = useRef<CameraSystemRef>(null);
  
  // Handle object selection with support for both internal and external state
  const handleObjectSelect = useCallback((objectId: string | null) => {
    if (externalSelectObject && objectId) {
      externalSelectObject(objectId);
    } else {
      setInternalSelectedObject(objectId);
    }
  }, [externalSelectObject]);
  
  // Handle visibility filter changes
  const handleFilterChange = useCallback((filterType: keyof VisibilityFilters, value: boolean) => {
    const newFilters = { ...actualVisibilityFilters, [filterType]: value };
    
    if (onUpdateFilters) {
      onUpdateFilters(newFilters);
    } else {
      setInternalVisibilityFilters(newFilters);
    }
  }, [actualVisibilityFilters, onUpdateFilters]);
  
  // Handle atmosphere toggle
  const handleAtmosphereToggle = useCallback((value: boolean) => {
    if (onToggleAtmosphere) {
      onToggleAtmosphere(value);
    } else {
      setInternalEnhancedAtmosphere(value);
    }
  }, [onToggleAtmosphere]);
  
  // Handle labels toggle
  const handleLabelsToggle = useCallback((value: boolean) => {
    if (onToggleLabels) {
      onToggleLabels(value);
    } else {
      setInternalShowLabels(value);
    }
  }, [onToggleLabels]);
  
  return (
    <>
      {/* Add CameraSystem component */}
      <CameraSystem 
        ref={cameraRef}
        objectsMap={objectsMap}
        selectedObject={actualSelectedObject}
      />
      
      {/* Use Html component from drei to render HTML elements inside Three.js */}
      <Html fullscreen>
        <div className="controls-container" style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none' }}>
          {/* System browser (positioned via CSS) */}
          <div style={{ pointerEvents: 'auto' }}>
            <SystemBrowser 
              objectsMap={objectsMap}
              selectedObject={actualSelectedObject}
              onSelectObject={handleObjectSelect}
            />
          </div>
          
          {/* MiniMap (positioned via CSS) */}
          <div style={{ pointerEvents: 'auto' }}>
            <MiniMap 
              objectsMap={objectsMap}
              selectedObject={actualSelectedObject}
              onSelectObject={handleObjectSelect}
              cameraPosition={camera.position}
            />
          </div>
          
          {/* Controls for toggling visibility, etc. */}
          <div className="display-controls" style={{ pointerEvents: 'auto' }}>
            <button 
              className={`display-control-btn ${actualVisibilityFilters.stars ? 'active' : ''}`}
              onClick={() => handleFilterChange('stars', !actualVisibilityFilters.stars)}
              title="Toggle Stars"
            >
              ★
            </button>
            <button 
              className={`display-control-btn ${actualVisibilityFilters.planets ? 'active' : ''}`}
              onClick={() => handleFilterChange('planets', !actualVisibilityFilters.planets)}
              title="Toggle Planets"
            >
              🪐
            </button>
            <button 
              className={`display-control-btn ${actualVisibilityFilters.moons ? 'active' : ''}`}
              onClick={() => handleFilterChange('moons', !actualVisibilityFilters.moons)}
              title="Toggle Moons"
            >
              🌙
            </button>
            <button 
              className={`display-control-btn ${actualVisibilityFilters.stations ? 'active' : ''}`}
              onClick={() => handleFilterChange('stations', !actualVisibilityFilters.stations)}
              title="Toggle Stations"
            >
              🛰️
            </button>
            <button 
              className={`display-control-btn ${actualVisibilityFilters.jumpPoints ? 'active' : ''}`}
              onClick={() => handleFilterChange('jumpPoints', !actualVisibilityFilters.jumpPoints)}
              title="Toggle Jump Points"
            >
              ⚡
            </button>
            <button 
              className={`display-control-btn ${actualEnhancedAtmosphere ? 'active' : ''}`}
              onClick={() => handleAtmosphereToggle(!actualEnhancedAtmosphere)}
              title="Toggle Enhanced Atmosphere"
            >
              🌐
            </button>
            <button 
              className={`display-control-btn ${actualShowLabels ? 'active' : ''}`}
              onClick={() => handleLabelsToggle(!actualShowLabels)}
              title="Toggle Labels"
            >
              🏷️
            </button>
          </div>
        </div>
      </Html>
    </>
  );
};

export default StantonMapControls; 