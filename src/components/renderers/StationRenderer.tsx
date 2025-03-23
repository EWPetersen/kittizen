import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { Sphere, Box, Cylinder, Billboard, Html } from '@react-three/drei';
import * as THREE from 'three';
import { Station } from '../../models/celestialObjects';
import BaseRenderer, { BaseRendererProps, GM_SCALE } from './BaseRenderer';

interface StationRendererProps extends Omit<BaseRendererProps, 'object'> {
  object: Station;
  showTravelMarkers?: boolean;
}

// Helper function to determine station type from the name
const getStationType = (name: string): string => {
  if (name.includes('reststop')) {
    return 'REST_STOP';
  } else if (name.includes('commarray')) {
    return 'COMM_ARRAY';
  } else if (name.includes('leo')) {
    return 'LEO';
  } else if (name.includes('security')) {
    return 'SECURITY';
  } else if (name.includes('shippinghub')) {
    return 'SHIPPING';
  } else if (name.includes('motel')) {
    return 'MOTEL';
  } else {
    return 'GENERIC';
  }
};

const StationRenderer: React.FC<StationRendererProps> = ({
  object,
  selected,
  showLabel,
  actualScale,
  onClick,
  showTravelMarkers = true,
}) => {
  // Multiple refs for different station parts
  const baseRef = useRef<THREE.Mesh>(null);
  const detailsRef = useRef<THREE.Group>(null);
  
  // Determine station type and related styling
  const stationType = useMemo(() => getStationType(object.name), [object.name]);
  
  // Station colors based on type
  const getStationColor = (): THREE.Color => {
    switch (stationType) {
      case 'REST_STOP':
        return new THREE.Color('#FF6600'); // Orange
      case 'COMM_ARRAY':
        return new THREE.Color('#33CC33'); // Green
      case 'LEO':
        return new THREE.Color('#6699FF'); // Light blue
      case 'SECURITY':
        return new THREE.Color('#FF3333'); // Red
      case 'SHIPPING':
        return new THREE.Color('#FFCC00'); // Yellow
      case 'MOTEL':
        return new THREE.Color('#CC99FF'); // Light purple
      default:
        return new THREE.Color('#CCCCCC'); // Gray
    }
  };
  
  const stationColor = useMemo(() => getStationColor(), [stationType]);
  
  // Animation for stations - different for each type
  useFrame(({ clock }) => {
    if (detailsRef.current) {
      if (stationType === 'REST_STOP' || stationType === 'LEO') {
        // Rotating parts for rest stops and orbital stations
        detailsRef.current.rotation.y = clock.getElapsedTime() * 0.1;
      } else if (stationType === 'COMM_ARRAY') {
        // Oscillating dishes for comm arrays
        detailsRef.current.rotation.z = Math.sin(clock.getElapsedTime() * 0.2) * 0.15;
      }
    }
  });
  
  // Calculate sizes
  const baseSize = actualScale 
    ? object.size / GM_SCALE 
    : Math.max(object.size / GM_SCALE * 0.00005, 0.3);
  
  // Arrival radius for quantum travel
  const arrivalRadius = object.arrivalRadius > 0 
    ? Math.max(object.arrivalRadius / GM_SCALE, baseSize * 10) 
    : baseSize * 10;
  
  // Convert position to scene coordinates
  const position = [
    object.position.x / GM_SCALE,
    object.position.y / GM_SCALE,
    object.position.z / GM_SCALE
  ];
  
  // Station type indicator icon/symbol
  const getStationIcon = () => {
    switch (stationType) {
      case 'REST_STOP':
        return '🛑'; // Stop sign
      case 'COMM_ARRAY':
        return '📡'; // Satellite dish
      case 'LEO':
        return '🛰️'; // Satellite
      case 'SECURITY':
        return '🛡️'; // Shield
      case 'SHIPPING':
        return '📦'; // Package
      case 'MOTEL':
        return '🏨'; // Hotel
      default:
        return '🚀'; // Rocket (generic)
    }
  };
  
  // Render specific geometry based on station type
  const renderStationModel = () => {
    switch (stationType) {
      case 'REST_STOP':
        return (
          <>
            {/* Central hub */}
            <Sphere ref={baseRef} args={[baseSize, 16, 16]} onClick={onClick}>
              <meshStandardMaterial color={stationColor} roughness={0.6} />
            </Sphere>
            {/* Extending arms */}
            <group ref={detailsRef}>
              <Cylinder args={[baseSize*0.1, baseSize*0.1, baseSize*4, 8]} rotation={[Math.PI/2, 0, 0]}>
                <meshStandardMaterial color={stationColor} roughness={0.7} />
              </Cylinder>
              <Cylinder args={[baseSize*0.1, baseSize*0.1, baseSize*4, 8]} rotation={[0, 0, Math.PI/2]}>
                <meshStandardMaterial color={stationColor} roughness={0.7} />
              </Cylinder>
              {/* End caps */}
              <Box args={[baseSize*0.5, baseSize*0.5, baseSize*0.2]} position={[baseSize*2, 0, 0]}>
                <meshStandardMaterial color={stationColor} roughness={0.7} />
              </Box>
              <Box args={[baseSize*0.5, baseSize*0.5, baseSize*0.2]} position={[-baseSize*2, 0, 0]}>
                <meshStandardMaterial color={stationColor} roughness={0.7} />
              </Box>
              <Box args={[baseSize*0.5, baseSize*0.5, baseSize*0.2]} position={[0, baseSize*2, 0]}>
                <meshStandardMaterial color={stationColor} roughness={0.7} />
              </Box>
              <Box args={[baseSize*0.5, baseSize*0.5, baseSize*0.2]} position={[0, -baseSize*2, 0]}>
                <meshStandardMaterial color={stationColor} roughness={0.7} />
              </Box>
            </group>
          </>
        );
        
      case 'COMM_ARRAY':
        return (
          <>
            {/* Base */}
            <Cylinder ref={baseRef} args={[baseSize*0.6, baseSize, baseSize*1.5, 8]} onClick={onClick}>
              <meshStandardMaterial color={stationColor} roughness={0.6} />
            </Cylinder>
            {/* Dish */}
            <group ref={detailsRef} position={[0, baseSize, 0]}>
              <Sphere args={[baseSize*0.2, 16, 16]} position={[0, baseSize*0.4, 0]}>
                <meshStandardMaterial color="#AAAAAA" roughness={0.3} metalness={0.7} />
              </Sphere>
              <Cylinder args={[baseSize*0.05, baseSize*0.05, baseSize*0.8, 8]} position={[0, baseSize*0.4/2, 0]}>
                <meshStandardMaterial color="#888888" roughness={0.5} />
              </Cylinder>
              <Sphere args={[baseSize*1.2, 16, 8, 0, Math.PI]} rotation={[Math.PI/2, 0, 0]} position={[0, baseSize*0.8, 0]}>
                <meshStandardMaterial color="#DDDDDD" roughness={0.3} metalness={0.8} side={THREE.BackSide} />
              </Sphere>
            </group>
          </>
        );
        
      case 'LEO':
        return (
          <>
            {/* Central module */}
            <Cylinder ref={baseRef} args={[baseSize*0.8, baseSize*0.8, baseSize*2, 8]} rotation={[Math.PI/2, 0, 0]} onClick={onClick}>
              <meshStandardMaterial color={stationColor} roughness={0.5} metalness={0.3} />
            </Cylinder>
            {/* Solar panels */}
            <group ref={detailsRef}>
              <Box args={[baseSize*4, baseSize*0.1, baseSize*1.5]} position={[0, 0, 0]}>
                <meshStandardMaterial color="#3399FF" roughness={0.3} metalness={0.8} />
              </Box>
              <Box args={[baseSize*0.1, baseSize*0.1, baseSize*0.2]} position={[baseSize*2, 0, 0]}>
                <meshStandardMaterial color="#666666" roughness={0.5} />
              </Box>
              <Box args={[baseSize*0.1, baseSize*0.1, baseSize*0.2]} position={[-baseSize*2, 0, 0]}>
                <meshStandardMaterial color="#666666" roughness={0.5} />
              </Box>
            </group>
          </>
        );
        
      default:
        // Generic station model for other types
        return (
          <>
            <Box ref={baseRef} args={[baseSize*1.5, baseSize, baseSize*1.5]} onClick={onClick}>
              <meshStandardMaterial color={stationColor} roughness={0.6} />
            </Box>
            <group ref={detailsRef} position={[0, baseSize*0.5, 0]}>
              <Cylinder args={[baseSize*0.4, baseSize*0.6, baseSize*0.5, 8]}>
                <meshStandardMaterial color={stationColor.clone().multiplyScalar(1.2)} roughness={0.5} />
              </Cylinder>
            </group>
          </>
        );
    }
  };
  
  return (
    <group position={position as [number, number, number]}>
      {/* Arrival radius indicator */}
      {showTravelMarkers && (
        <Sphere args={[arrivalRadius, 16, 16]}>
          <meshBasicMaterial 
            color={stationColor} 
            transparent={true} 
            opacity={0.05}
            wireframe={true}
          />
        </Sphere>
      )}
      
      {/* Station model */}
      {renderStationModel()}
      
      {/* Station type indicator */}
      <Billboard position={[0, baseSize * 2, 0]}>
        <Html
          transform
          distanceFactor={10}
          style={{
            color: '#FFFFFF',
            backgroundColor: 'rgba(0,0,0,0.7)',
            padding: '2px 6px',
            borderRadius: '3px',
            fontSize: '12px',
            display: 'flex',
            alignItems: 'center',
            gap: '4px'
          }}
        >
          <span>{getStationIcon()}</span>
          {showLabel && <span>{stationType.replace('_', ' ')}</span>}
        </Html>
      </Billboard>
      
      {/* Base renderer for labels and selection effects */}
      <BaseRenderer 
        object={object}
        selected={selected}
        showLabel={showLabel}
        actualScale={actualScale}
        onClick={onClick}
        color={stationColor}
        emissiveIntensity={0.3}
        scaleMultiplier={0.00005}
        minSize={0.01} // Small because we're rendering our own station model
      />
    </group>
  );
};

export default StationRenderer; 