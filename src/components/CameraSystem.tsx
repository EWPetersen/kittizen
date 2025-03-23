import React, { useRef, useEffect, useState, useCallback } from 'react';
import { useThree, useFrame } from '@react-three/fiber';
import { PerspectiveCamera, OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import { BaseCelestialObject, Star, Planet, Moon, Station, JumpPoint, LagrangePoint, StantonSystemMap } from '../models/celestialObjects';
import { Vector3 } from 'three';

// Scale constants
const SYSTEM_SCALE = 1e9; // Scale for system view
const DEFAULT_DISTANCE_MULTIPLIER = 2.5; // Default view distance multiplier

// Animation constants
const TRANSITION_DURATION = 1.5; // seconds
const EASE_FACTOR = 2.2; // Higher = more pronounced easing

export interface CameraSystemProps {
  objectsMap: StantonSystemMap;
  selectedObject: string | null;
  onZoomLevelChange?: (zoomLevel: number) => void;
}

export interface CameraSystemRef {
  focusOnObject: (objectName: string) => void;
  resetView: () => void;
  getCurrentZoomLevel: () => number;
}

const CameraSystem = React.forwardRef<CameraSystemRef, CameraSystemProps>(
  ({ objectsMap, selectedObject, onZoomLevelChange }, ref) => {
    const { camera, gl, scene } = useThree();
    const controlsRef = useRef<any>(null);
    const [targetPosition, setTargetPosition] = useState<THREE.Vector3>(new THREE.Vector3(0, 0, 0));
    const [targetLookAt, setTargetLookAt] = useState<THREE.Vector3>(new THREE.Vector3(0, 0, 0));
    const [startPosition, setStartPosition] = useState<THREE.Vector3>(new THREE.Vector3(0, 0, 0));
    const [startLookAt, setStartLookAt] = useState<THREE.Vector3>(new THREE.Vector3(0, 0, 0));
    const [transitionStartTime, setTransitionStartTime] = useState<number | null>(null);
    const [zoomLevel, setZoomLevel] = useState<number>(0);
    const [isTransitioning, setIsTransitioning] = useState<boolean>(false);
    const [currentObjectType, setCurrentObjectType] = useState<string | null>(null);

    // Calculate appropriate camera position and settings based on object type and size
    const calculateCameraSettings = useCallback((object: BaseCelestialObject) => {
      // Check if the object has position data
      if (!object.position) {
        console.warn(`Object ${object.name} has no position data, cannot focus`);
        return {
          position: new THREE.Vector3(0, 0, 2000),
          lookAt: new THREE.Vector3(0, 0, 0),
          nearPlane: 0.1,
          farPlane: 100000,
          zoomLevel: 0
        };
      }

      const objectPosition = new THREE.Vector3(
        object.position.x / SYSTEM_SCALE,
        object.position.y / SYSTEM_SCALE,
        object.position.z / SYSTEM_SCALE
      );
      
      let distanceMultiplier = DEFAULT_DISTANCE_MULTIPLIER;
      let nearPlane = 0.1;
      let farPlane = 100000;
      
      // Adjust settings based on object type
      switch (object.type) {
        case 'Star':
          distanceMultiplier = 10;
          nearPlane = 1;
          farPlane = 1000000;
          break;
        case 'Planet':
          distanceMultiplier = 5;
          nearPlane = 0.5;
          farPlane = 500000;
          break;
        case 'Moon':
          distanceMultiplier = 4;
          nearPlane = 0.1;
          farPlane = 100000;
          break;
        case 'Station':
        case 'LandingZone':
          distanceMultiplier = 2;
          nearPlane = 0.01;
          farPlane = 10000;
          break;
        case 'JumpPoint':
        case 'LagrangePoint':
          distanceMultiplier = 3;
          nearPlane = 0.1;
          farPlane = 50000;
          break;
      }
      
      // Calculate viewing distance based on object size
      // Use larger of size or arrivalRadius for a more consistent view
      const viewingDistance = Math.max(object.size, object.arrivalRadius) / SYSTEM_SCALE * distanceMultiplier;
      
      // Create a camera position offset based on object type
      // This gives different viewing angles for different types of objects
      let cameraOffset = new THREE.Vector3(1, 0.5, 1).normalize().multiplyScalar(viewingDistance);
      
      // For planets and moons, position camera to show atmosphere and surface
      if (object.type === 'Planet' || object.type === 'Moon') {
        cameraOffset = new THREE.Vector3(0.7, 0.5, 0.7).normalize().multiplyScalar(viewingDistance);
      }
      
      // For stations, get a more top-down view
      if (object.type === 'Station' || object.type === 'LandingZone') {
        cameraOffset = new THREE.Vector3(0.3, 0.7, 0.3).normalize().multiplyScalar(viewingDistance);
      }
      
      // Position camera at object position + offset
      const cameraPosition = objectPosition.clone().add(cameraOffset);
      
      return {
        position: cameraPosition,
        lookAt: objectPosition,
        nearPlane,
        farPlane,
        zoomLevel: calculateZoomLevel(object)
      };
    }, []);

    // Calculate zoom level (0-1) based on object type and size
    const calculateZoomLevel = (object: BaseCelestialObject): number => {
      switch (object.type) {
        case 'Star': return 0;
        case 'Planet': return 0.2;
        case 'Moon': return 0.4;
        case 'JumpPoint': return 0.6;
        case 'LagrangePoint': return 0.6;
        case 'Station': return 0.8;
        case 'LandingZone': return 0.9;
        default: return 0.5;
      }
    };

    // System reset view
    const resetView = useCallback(() => {
      if (!controlsRef.current) return;
      
      // Find the central star in the system
      const centralStar = Object.values(objectsMap).find(obj => obj.type === 'Star');
      if (centralStar) {
        // Check if the star has position data
        if (!centralStar.position) {
          console.warn("Central star has no position data");
          // Use default position
          const systemViewDistance = 2000;
          const systemCameraPosition = new THREE.Vector3(
            systemViewDistance,
            systemViewDistance * 0.5,
            systemViewDistance
          );
          startCameraTransition(systemCameraPosition, new THREE.Vector3(0, 0, 0), 0);
          setCurrentObjectType(null);
          return;
        }

        const starPosition = new THREE.Vector3(
          centralStar.position.x / SYSTEM_SCALE,
          centralStar.position.y / SYSTEM_SCALE,
          centralStar.position.z / SYSTEM_SCALE
        );
        
        // Set camera to view the whole system
        const systemViewDistance = 2000; // adjusted for system scale
        const systemCameraPosition = new THREE.Vector3(
          starPosition.x + systemViewDistance,
          starPosition.y + systemViewDistance * 0.5,
          starPosition.z + systemViewDistance
        );
        
        // Start transition to system view
        startCameraTransition(systemCameraPosition, starPosition, 0);
        setCurrentObjectType(null);
      }
    }, [objectsMap]);

    // Focus camera on a specific object
    const focusOnObject = useCallback((objectName: string) => {
      // Prevent repeated focusing on the same object
      if (isTransitioning || currentObjectType === objectsMap[objectName]?.type) {
        return;
      }
      
      const object = objectsMap[objectName];
      if (!object || !controlsRef.current) {
        console.warn(`Object ${objectName} not found or controls not initialized`);
        return;
      }

      // Check if the object has position data
      if (!object.position) {
        console.warn(`Object ${objectName} has no position data, cannot focus`);
        return;
      }
      
      const { position, lookAt, zoomLevel } = calculateCameraSettings(object);
      
      // Start the transition
      startCameraTransition(position, lookAt, zoomLevel);
      setCurrentObjectType(object.type);
    }, [objectsMap, calculateCameraSettings, isTransitioning, currentObjectType]);

    // Set up camera transition
    const startCameraTransition = (targetPos: THREE.Vector3, targetLook: THREE.Vector3, newZoomLevel: number) => {
      if (!controlsRef.current) return;
      
      // Get current camera position and target
      const currentPosition = camera.position.clone();
      const currentTarget = controlsRef.current.target.clone();
      
      // Store start state
      setStartPosition(currentPosition);
      setStartLookAt(currentTarget);
      
      // Store target state
      setTargetPosition(targetPos);
      setTargetLookAt(targetLook);
      
      // Start transition
      setTransitionStartTime(Date.now());
      setIsTransitioning(true);
    };

    // Handle animation frame
    useFrame(() => {
      if (isTransitioning && transitionStartTime !== null) {
        const now = Date.now();
        const elapsed = (now - transitionStartTime) / 1000; // Convert to seconds
        const progress = Math.min(elapsed / TRANSITION_DURATION, 1);
        
        // Apply easing
        const easedProgress = Math.pow(progress, 1 / EASE_FACTOR);
        
        // Interpolate position and lookAt
        if (progress < 1) {
          // Update camera position
          camera.position.lerpVectors(startPosition, targetPosition, easedProgress);
          
          // Update controls target (lookAt point)
          controlsRef.current.target.lerpVectors(startLookAt, targetLookAt, easedProgress);
          controlsRef.current.update();
          
          // Interpolate zoom level for smooth transition
          if (onZoomLevelChange) {
            const currentZoom = zoomLevel + (targetPosition.length() > 500 ? 0 : easedProgress * (targetPosition.length() / 1000));
            setZoomLevel(currentZoom);
            onZoomLevelChange(currentZoom);
          }
        } else {
          // End transition
          setIsTransitioning(false);
          setTransitionStartTime(null);
          
          // Set final zoom level
          const finalZoomLevel = targetPosition.length() > 500 ? 0 : targetPosition.length() / 1000;
          setZoomLevel(finalZoomLevel);
          if (onZoomLevelChange) {
            onZoomLevelChange(finalZoomLevel);
          }
          
          // Ensure camera is at final position
          camera.position.copy(targetPosition);
          controlsRef.current.target.copy(targetLookAt);
          controlsRef.current.update();
        }
      }
    });

    // Update camera on selected object change
    useEffect(() => {
      if (selectedObject) {
        focusOnObject(selectedObject);
      }
    }, [selectedObject, focusOnObject]);

    // Expose methods via ref
    useEffect(() => {
      if (ref) {
        // Handle both function and object refs
        if (typeof ref === 'function') {
          ref({
            focusOnObject,
            resetView,
            getCurrentZoomLevel: () => zoomLevel
          });
        } else {
          ref.current = {
            focusOnObject,
            resetView,
            getCurrentZoomLevel: () => zoomLevel
          };
        }
      }
    }, [ref, focusOnObject, resetView, zoomLevel]);

    // Adjust near/far planes based on current object type
    useEffect(() => {
      if (currentObjectType) {
        let nearPlane = 0.1;
        let farPlane = 100000;
        
        switch (currentObjectType) {
          case 'Star':
            nearPlane = 1;
            farPlane = 1000000;
            break;
          case 'Planet':
            nearPlane = 0.5;
            farPlane = 500000;
            break;
          case 'Moon':
            nearPlane = 0.1;
            farPlane = 100000;
            break;
          case 'Station':
          case 'LandingZone':
            nearPlane = 0.01;
            farPlane = 10000;
            break;
          case 'JumpPoint':
          case 'LagrangePoint':
            nearPlane = 0.1;
            farPlane = 50000;
            break;
        }
        
        camera.near = nearPlane;
        camera.far = farPlane;
        camera.updateProjectionMatrix();
      }
    }, [currentObjectType, camera]);

    return (
      <>
        <PerspectiveCamera 
          makeDefault 
          position={[2000, 1000, 2000]}
          fov={60}
          near={0.1}
          far={100000}
        />
        <OrbitControls
          ref={controlsRef}
          enableDamping
          dampingFactor={0.05}
          rotateSpeed={0.5}
          zoomSpeed={0.8}
          panSpeed={0.8}
          minDistance={0.1}
          maxDistance={10000}
        />
      </>
    );
  }
);

export default CameraSystem; 