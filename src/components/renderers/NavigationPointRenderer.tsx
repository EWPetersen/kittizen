import React, { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { Text, Billboard } from '@react-three/drei';
import { JumpPoint, LagrangePoint, Station, LandingZone, CommArray } from '../../models/celestialObjects';

interface NavigationPointRendererProps {
  object: JumpPoint | LagrangePoint | Station | LandingZone | CommArray;
  selected: boolean;
  showLabel: boolean;
  onSelect: (objectName: string) => void;
}

// Scale factor for visualization
const SYSTEM_SCALE = 1e9;

const NavigationPointRenderer: React.FC<NavigationPointRendererProps> = ({
  object,
  selected,
  showLabel,
  onSelect
}) => {
  const groupRef = useRef<THREE.Group>(null);
  const meshRef = useRef<THREE.Mesh>(null);
  
  // Position in scaled space
  const position = useMemo(() => {
    // Check if object.position exists before accessing its properties
    if (!object.position) {
      console.warn(`Object ${object.name} has no position data`);
      return [0, 0, 0]; // Default position if no data available
    }
    
    return [
      object.position.x / SYSTEM_SCALE,
      object.position.y / SYSTEM_SCALE,
      object.position.z / SYSTEM_SCALE
    ];
  }, [object.name, object.position]);
  
  // Size and appearance configuration
  const config = useMemo(() => {
    let size = 0.05;
    let color = new THREE.Color(0xffffff);
    let intensity = 1.0;
    let geometry: 'sphere' | 'box' | 'octahedron' | 'torus' = 'sphere';
    let labelYOffset = 0.15;
    let labelColor = '#c0c0c0';
    
    // Configure based on object type
    switch (object.type) {
      case 'JumpPoint':
        size = 0.1;
        color = new THREE.Color(0xff88cc);
        intensity = 1.5;
        geometry = 'torus';
        labelColor = '#ff99cc';
        labelYOffset = 0.25;
        break;
        
      case 'LagrangePoint':
        size = 0.08;
        color = new THREE.Color(0x88ff88);
        intensity = 1.0;
        geometry = 'octahedron';
        labelColor = '#88ff88';
        labelYOffset = 0.2;
        break;
        
      case 'Station':
        size = 0.12;
        color = new THREE.Color(0xccccff);
        intensity = 1.2;
        geometry = 'box';
        labelColor = '#aaccff';
        labelYOffset = 0.25;
        break;
        
      case 'LandingZone':
        size = 0.1;
        color = new THREE.Color(0xffcc88);
        intensity = 1.0;
        geometry = 'sphere';
        labelColor = '#ffcc88';
        labelYOffset = 0.2;
        break;
        
      case 'CommArray':
        size = 0.09;
        color = new THREE.Color(0xffaacc);
        intensity = 1.1;
        geometry = 'box';
        labelColor = '#ffaacc';
        labelYOffset = 0.2;
        break;
    }
    
    return { size, color, intensity, geometry, labelYOffset, labelColor };
  }, [object.type]);
  
  // Animation
  useFrame((state, delta) => {
    if (meshRef.current) {
      // Different animations based on object type
      if (object.type === 'JumpPoint') {
        // Rotate jump point torus
        meshRef.current.rotation.z += delta * 0.5;
        meshRef.current.rotation.x = Math.PI / 4; // Tilt
      } else if (object.type === 'LagrangePoint') {
        // Spin lagrange point
        meshRef.current.rotation.y += delta * 0.2;
        meshRef.current.rotation.x += delta * 0.1;
      } else if (object.type === 'Station') {
        // Subtle rotation for stations
        meshRef.current.rotation.y += delta * 0.1;
      }
    }
    
    // Highlight pulse effect when selected
    if (selected && groupRef.current) {
      const pulseScale = 1 + Math.sin(state.clock.elapsedTime * 3) * 0.15;
      groupRef.current.scale.set(pulseScale, pulseScale, pulseScale);
    }
  });
  
  // Render appropriate geometry based on object type
  const renderGeometry = () => {
    switch (config.geometry) {
      case 'box':
        return <boxGeometry args={[config.size, config.size, config.size]} />;
      case 'octahedron':
        return <octahedronGeometry args={[config.size, 0]} />;
      case 'torus':
        return <torusGeometry args={[config.size * 1.5, config.size * 0.4, 16, 32]} />;
      case 'sphere':
      default:
        return <sphereGeometry args={[config.size, 16, 16]} />;
    }
  };
  
  return (
    <group 
      ref={groupRef}
      position={position as [number, number, number]}
      onClick={() => onSelect(object.name)}
    >
      {/* Main object */}
      <mesh ref={meshRef}>
        {renderGeometry()}
        <meshStandardMaterial 
          color={config.color}
          emissive={config.color}
          emissiveIntensity={config.intensity}
          transparent
          opacity={0.8}
        />
      </mesh>
      
      {/* Glow effect */}
      <mesh>
        <sphereGeometry args={[config.size * 1.5, 16, 16]} />
        <meshBasicMaterial 
          color={config.color}
          transparent 
          opacity={0.15}
        />
      </mesh>
      
      {/* Selection indicator */}
      {selected && (
        <mesh>
          <ringGeometry args={[config.size * 2, config.size * 2.2, 32]} />
          <meshBasicMaterial color="#ffffff" transparent opacity={0.6} />
        </mesh>
      )}
      
      {/* Label */}
      {showLabel && (
        <Billboard follow={true}>
          <Text
            position={[0, config.size + config.labelYOffset, 0]}
            fontSize={0.1}
            color={selected ? "#ffffff" : config.labelColor}
            anchorX="center"
            anchorY="middle"
            outlineWidth={0.02}
            outlineColor="#000000"
            fillOpacity={selected ? 1 : 0.85}
          >
            {object.display_name}
          </Text>
        </Billboard>
      )}
    </group>
  );
};

export default NavigationPointRenderer; 