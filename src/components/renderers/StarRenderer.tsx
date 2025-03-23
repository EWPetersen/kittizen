import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Sphere } from '@react-three/drei';
import * as THREE from 'three';
import { Star } from '../../models/celestialObjects';
import BaseRenderer, { BaseRendererProps, GM_SCALE } from './BaseRenderer';

interface StarRendererProps extends Omit<BaseRendererProps, 'object'> {
  object: Star;
}

// Sun/star custom shader material for solar effects
const vertexShader = `
  varying vec3 vNormal;
  varying vec2 vUv;
  
  void main() {
    vUv = uv;
    vNormal = normalize(normalMatrix * normal);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const fragmentShader = `
  uniform float time;
  uniform vec3 color;
  varying vec3 vNormal;
  varying vec2 vUv;
  
  float noise(vec3 p) {
    vec3 i = floor(p);
    vec4 a = dot(i, vec3(1., 57., 21.)) + vec4(0., 57., 21., 78.);
    vec3 f = cos((p-i)*acos(-1.))*(-.5)+.5;
    a = mix(sin(cos(a)*a),sin(cos(1.+a)*(1.+a)), f.x);
    a.xy = mix(a.xz, a.yw, f.y);
    return mix(a.x, a.y, f.z);
  }
  
  float sphereNoise(vec3 p) {
    float n = 0.0;
    n += 0.5 * noise(p * 5.0 + time * 0.1);
    n += 0.25 * noise(p * 10.0 + time * 0.3);
    n += 0.125 * noise(p * 20.0 + time * 0.5);
    n += 0.0625 * noise(p * 40.0 + time * 0.7);
    return n;
  }
  
  void main() {
    float noise = sphereNoise(vNormal);
    
    // Base color with noise modulation
    vec3 baseColor = color;
    baseColor += noise * 0.3; // Add noise variation
    
    // Edge darkening for solar limb effect
    float fresnel = pow(1.0 - dot(vNormal, vec3(0.0, 0.0, 1.0)), 2.0);
    baseColor *= (1.0 - fresnel * 0.5);
    
    // Solar flare effect
    float flareIntensity = pow(noise, 3.0) * 0.5;
    baseColor += flareIntensity * vec3(1.0, 0.6, 0.3);
    
    gl_FragColor = vec4(baseColor, 1.0);
  }
`;

const StarRenderer: React.FC<StarRendererProps> = ({
  object,
  selected,
  showLabel,
  actualScale,
  onClick,
}) => {
  const coronaRef = useRef<THREE.Mesh>(null);
  const sunMaterialRef = useRef<THREE.ShaderMaterial>(null);
  
  // Animate the sun material
  useFrame(({ clock }) => {
    if (sunMaterialRef.current) {
      sunMaterialRef.current.uniforms.time.value = clock.getElapsedTime();
    }
    
    if (coronaRef.current) {
      coronaRef.current.rotation.y = clock.getElapsedTime() * 0.05;
      coronaRef.current.rotation.z = clock.getElapsedTime() * 0.03;
    }
  });
  
  // Convert position to scene coordinates
  const position = [
    object.position.x / GM_SCALE,
    object.position.y / GM_SCALE,
    object.position.z / GM_SCALE
  ];
  
  // Calculate sizes
  const starSize = actualScale 
    ? object.size / GM_SCALE 
    : Math.max(object.size / GM_SCALE * 0.0001, 5.0); // Stars need a much larger minimum size
  
  const coronaSize = starSize * 1.5;
  
  // Star color - based on Stanton being a G-type star (yellow)
  const starColor = new THREE.Color('#FFCC00');
  
  return (
    <group position={position as [number, number, number]}>
      {/* Outer corona glow */}
      <Sphere ref={coronaRef} args={[coronaSize, 32, 32]}>
        <meshBasicMaterial 
          color={starColor} 
          transparent={true} 
          opacity={0.15}
          blending={THREE.AdditiveBlending}
        />
      </Sphere>
      
      {/* Main star sphere with custom shader */}
      <Sphere args={[starSize, 64, 64]} onClick={onClick}>
        <shaderMaterial
          ref={sunMaterialRef}
          vertexShader={vertexShader}
          fragmentShader={fragmentShader}
          uniforms={{
            time: { value: 0 },
            color: { value: new THREE.Vector3(starColor.r, starColor.g, starColor.b) }
          }}
        />
      </Sphere>
      
      {/* Light source */}
      <pointLight 
        color={starColor} 
        intensity={actualScale ? 1.5 : 5} 
        distance={actualScale ? 100 : 1000}
        decay={2}
      />
      
      {/* Base renderer for label and selection effects */}
      <BaseRenderer 
        object={object}
        selected={selected}
        showLabel={showLabel}
        actualScale={actualScale}
        onClick={onClick}
        color={starColor}
        emissiveIntensity={2.0}
        scaleMultiplier={0.0001}
        minSize={0.01} // Very small because we're rendering our own custom star
      />
    </group>
  );
};

export default StarRenderer; 