import { BaseCelestialObject, Position } from '../models/celestialObjects';

/**
 * Constants for orbital calculations
 */
export const OrbitalConstants = {
  // Gravitational constant in m^3 kg^-1 s^-2
  G: 6.67430e-11,
  // 1 Gigameter to meters conversion
  GM_TO_M: 1_000_000_000,
  // Default orbital period for planets in the Stanton system (simplified)
  DEFAULT_ORBITAL_PERIOD: 24 * 60 * 60, // 1 Earth day in seconds
};

/**
 * Orbital parameter calculation result
 */
export interface OrbitalParameters {
  // Semi-major axis in Gm
  semiMajorAxis: number;
  // Eccentricity (0 = circle, 0-1 = ellipse)
  eccentricity: number;
  // Inclination in radians
  inclination: number;
  // Longitude of ascending node in radians
  longitudeOfAscendingNode: number;
  // Argument of periapsis in radians
  argumentOfPeriapsis: number;
  // Mean anomaly at epoch in radians
  meanAnomalyAtEpoch: number;
  // Period in seconds
  period: number;
  // Parent object name
  parentName: string;
}

/**
 * Calculate the 3D distance between two points in Gm
 * @param pos1 First position
 * @param pos2 Second position
 * @returns Distance in Gigameters
 */
export function calculateDistance(pos1: Position, pos2: Position): number {
  const dx = pos1.x - pos2.x;
  const dy = pos1.y - pos2.y;
  const dz = pos1.z - pos2.z;
  
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

/**
 * Calculate approximate orbital parameters based on position relative to parent
 * @param object The orbiting object
 * @param parent The parent object being orbited
 * @returns Calculated orbital parameters
 */
export function calculateOrbitalParameters(
  object: BaseCelestialObject, 
  parent: BaseCelestialObject
): OrbitalParameters {
  // Calculate position vector relative to parent
  const relativePos = {
    x: object.position.x - parent.position.x,
    y: object.position.y - parent.position.y,
    z: object.position.z - parent.position.z
  };
  
  // Calculate distance (semi-major axis for circular orbit approximation)
  const semiMajorAxis = calculateDistance(relativePos, { x: 0, y: 0, z: 0 });
  
  // For simplicity in this implementation, we'll assume circular orbits
  // with the current position as the reference point
  const eccentricity = 0;
  
  // Calculate orbital plane inclination from z-component
  const inclination = Math.atan2(relativePos.z, Math.sqrt(relativePos.x * relativePos.x + relativePos.y * relativePos.y));
  
  // Calculate longitude of ascending node
  const longitudeOfAscendingNode = Math.atan2(relativePos.y, relativePos.x);
  
  // For circular orbits, argument of periapsis is not well-defined, set to 0
  const argumentOfPeriapsis = 0;
  
  // For circular orbits, mean anomaly equals true anomaly
  const meanAnomalyAtEpoch = Math.atan2(relativePos.y, relativePos.x);
  
  // Estimate period using Kepler's third law
  // T² = (4π²/GM) * a³, where GM is the standard gravitational parameter
  // For simplicity, we'll use a default period based on the object's type
  let period: number;
  
  switch(object.type) {
    case 'Planet':
      // Planets have longer orbital periods
      period = OrbitalConstants.DEFAULT_ORBITAL_PERIOD * 365; // ~1 year
      break;
    case 'Moon':
      // Moons have shorter orbital periods
      period = OrbitalConstants.DEFAULT_ORBITAL_PERIOD * 27.3; // ~27.3 days like Earth's moon
      break;
    case 'Station':
      // Stations in orbit have very short periods
      period = OrbitalConstants.DEFAULT_ORBITAL_PERIOD / 24; // ~1 hour
      break;
    default:
      // Default period for other objects
      period = OrbitalConstants.DEFAULT_ORBITAL_PERIOD;
  }
  
  return {
    semiMajorAxis,
    eccentricity,
    inclination,
    longitudeOfAscendingNode,
    argumentOfPeriapsis,
    meanAnomalyAtEpoch,
    period,
    parentName: parent.name
  };
}

/**
 * Convert mean anomaly to eccentric anomaly using Newton-Raphson method
 * @param meanAnomaly Mean anomaly in radians
 * @param eccentricity Orbital eccentricity
 * @returns Eccentric anomaly in radians
 */
export function meanToEccentricAnomaly(meanAnomaly: number, eccentricity: number): number {
  // For circular orbits, eccentric anomaly equals mean anomaly
  if (eccentricity < 0.001) {
    return meanAnomaly;
  }
  
  // For elliptical orbits, use Newton-Raphson iteration
  let E = meanAnomaly; // Initial guess
  
  // Iterate until convergence
  for (let i = 0; i < 10; i++) {
    const deltaE = (meanAnomaly - E + eccentricity * Math.sin(E)) / (1 - eccentricity * Math.cos(E));
    E += deltaE;
    
    // Check for convergence
    if (Math.abs(deltaE) < 1e-6) {
      break;
    }
  }
  
  return E;
}

/**
 * Convert eccentric anomaly to true anomaly
 * @param eccentricAnomaly Eccentric anomaly in radians
 * @param eccentricity Orbital eccentricity
 * @returns True anomaly in radians
 */
export function eccentricToTrueAnomaly(eccentricAnomaly: number, eccentricity: number): number {
  // For circular orbits, true anomaly equals eccentric anomaly
  if (eccentricity < 0.001) {
    return eccentricAnomaly;
  }
  
  const cosE = Math.cos(eccentricAnomaly);
  const sinE = Math.sin(eccentricAnomaly);
  
  // Calculate true anomaly
  const cosV = (cosE - eccentricity) / (1 - eccentricity * cosE);
  const sinV = (Math.sqrt(1 - eccentricity * eccentricity) * sinE) / (1 - eccentricity * cosE);
  
  return Math.atan2(sinV, cosV);
}

/**
 * Calculate position at a specific time based on orbital parameters
 * @param params Orbital parameters
 * @param parentPosition Position of the parent object
 * @param timeFromEpoch Time elapsed since epoch in seconds
 * @returns Calculated position
 */
export function calculatePositionAtTime(
  params: OrbitalParameters, 
  parentPosition: Position, 
  timeFromEpoch: number
): Position {
  // Calculate mean anomaly at the specified time
  const meanAnomaly = (params.meanAnomalyAtEpoch + (2 * Math.PI * timeFromEpoch / params.period)) % (2 * Math.PI);
  
  // Convert to eccentric anomaly
  const eccentricAnomaly = meanToEccentricAnomaly(meanAnomaly, params.eccentricity);
  
  // For circular orbits, position calculation is simplified
  if (params.eccentricity < 0.001) {
    // Calculate position in the orbital plane
    const x = params.semiMajorAxis * Math.cos(eccentricAnomaly);
    const y = params.semiMajorAxis * Math.sin(eccentricAnomaly);
    
    // Apply inclination and longitude of ascending node rotations
    const cosIncl = Math.cos(params.inclination);
    const sinIncl = Math.sin(params.inclination);
    const cosLAN = Math.cos(params.longitudeOfAscendingNode);
    const sinLAN = Math.sin(params.longitudeOfAscendingNode);
    
    // Perform coordinate transformation from orbital plane to reference plane
    const xRef = x * cosLAN - y * sinLAN * cosIncl;
    const yRef = x * sinLAN + y * cosLAN * cosIncl;
    const zRef = y * sinIncl;
    
    // Add parent position to get absolute position
    return {
      x: parentPosition.x + xRef,
      y: parentPosition.y + yRef,
      z: parentPosition.z + zRef
    };
  } else {
    // For elliptical orbits, calculate position in orbital plane
    const distance = params.semiMajorAxis * (1 - params.eccentricity * Math.cos(eccentricAnomaly));
    const trueAnomaly = eccentricToTrueAnomaly(eccentricAnomaly, params.eccentricity);
    
    const x = distance * Math.cos(trueAnomaly);
    const y = distance * Math.sin(trueAnomaly);
    
    // Apply orbital plane orientation
    const cosIncl = Math.cos(params.inclination);
    const sinIncl = Math.sin(params.inclination);
    const cosLAN = Math.cos(params.longitudeOfAscendingNode);
    const sinLAN = Math.sin(params.longitudeOfAscendingNode);
    const cosAP = Math.cos(params.argumentOfPeriapsis);
    const sinAP = Math.sin(params.argumentOfPeriapsis);
    
    // Apply argument of periapsis rotation
    const xOrbit = x * cosAP - y * sinAP;
    const yOrbit = x * sinAP + y * cosAP;
    
    // Perform coordinate transformation from orbital plane to reference plane
    const xRef = xOrbit * cosLAN - yOrbit * sinLAN * cosIncl;
    const yRef = xOrbit * sinLAN + yOrbit * cosLAN * cosIncl;
    const zRef = yOrbit * sinIncl;
    
    // Add parent position to get absolute position
    return {
      x: parentPosition.x + xRef,
      y: parentPosition.y + yRef,
      z: parentPosition.z + zRef
    };
  }
}

/**
 * Calculate atmospheric parameters for visualization
 * @param object Celestial object with atmosphere data
 * @returns Atmosphere visualization parameters
 */
export function calculateAtmosphereParameters(object: BaseCelestialObject) {
  // If no atmosphere, return null
  if (!object.atmoHeight || object.atmoHeight <= 0) {
    return null;
  }
  
  // Convert atmosphere height from meters to Gm for visualization
  const atmoHeightGm = object.atmoHeight / OrbitalConstants.GM_TO_M;
  
  // Calculate outer atmosphere radius
  const outerRadius = object.size / OrbitalConstants.GM_TO_M + atmoHeightGm;
  
  // Calculate inner atmosphere radius (surface)
  const innerRadius = object.size / OrbitalConstants.GM_TO_M;
  
  // Define atmosphere color and opacity based on type
  let color = 'rgba(135, 206, 235, 0.3)'; // Default blue-ish atmosphere
  let opacityGradient = [0.1, 0.05, 0.01]; // Decreasing opacity with height
  
  // Different atmosphere colors for different planet types
  // This could be expanded with more specific data from the game
  switch(object.name) {
    case 'stanton1': // Hurston - industrial planet
      color = 'rgba(139, 69, 19, 0.3)'; // Brown hazy atmosphere
      opacityGradient = [0.2, 0.1, 0.05];
      break;
    case 'stanton2': // Crusader - gas giant
      color = 'rgba(230, 230, 255, 0.3)'; // Light blue-white atmosphere
      opacityGradient = [0.25, 0.15, 0.05];
      break;
    case 'stanton3': // ArcCorp - city planet
      color = 'rgba(169, 169, 169, 0.3)'; // Gray urban atmosphere
      opacityGradient = [0.2, 0.1, 0.03];
      break;
    case 'stanton4': // Microtech - frozen planet
      color = 'rgba(240, 248, 255, 0.3)'; // White-blue atmosphere
      opacityGradient = [0.15, 0.08, 0.02];
      break;
    default:
      // For moons with atmosphere
      if (object.type === 'Moon' && object.parent.startsWith('stanton')) {
        color = 'rgba(200, 200, 200, 0.2)'; // Light gray thin atmosphere
        opacityGradient = [0.08, 0.04, 0.01];
      }
  }
  
  return {
    innerRadius,
    outerRadius,
    color,
    opacityGradient
  };
}

/**
 * Calculate valid quantum travel paths between objects
 * @param from Source object
 * @param to Destination object
 * @param allObjects All celestial objects to check for obstructions
 * @returns Object indicating if travel is possible and any obstructions
 */
export function calculateQuantumTravelPath(
  from: BaseCelestialObject,
  to: BaseCelestialObject,
  allObjects: BaseCelestialObject[]
): { valid: boolean; obstructions: BaseCelestialObject[] } {
  const obstructions: BaseCelestialObject[] = [];
  
  // Vector from source to destination
  const travelVector = {
    x: to.position.x - from.position.x,
    y: to.position.y - from.position.y,
    z: to.position.z - from.position.z
  };
  
  // Total travel distance
  const totalDistance = calculateDistance(from.position, to.position);
  
  // Unit vector in direction of travel
  const unitVector = {
    x: travelVector.x / totalDistance,
    y: travelVector.y / totalDistance,
    z: travelVector.z / totalDistance
  };
  
  // Check each object for potential obstruction
  for (const obj of allObjects) {
    // Skip source and destination objects
    if (obj.name === from.name || obj.name === to.name) {
      continue;
    }
    
    // Skip objects with zero obstruction radius
    if (obj.obstructionRadius <= 0) {
      continue;
    }
    
    // Vector from source to potential obstruction
    const toObstruction = {
      x: obj.position.x - from.position.x,
      y: obj.position.y - from.position.y,
      z: obj.position.z - from.position.z
    };
    
    // Project this vector onto the travel direction to find closest approach point
    const projection = 
      toObstruction.x * unitVector.x + 
      toObstruction.y * unitVector.y + 
      toObstruction.z * unitVector.z;
    
    // If projection is negative or greater than travel distance, object is not in the way
    if (projection < 0 || projection > totalDistance) {
      continue;
    }
    
    // Calculate closest approach distance
    const closestApproachPoint = {
      x: from.position.x + unitVector.x * projection,
      y: from.position.y + unitVector.y * projection,
      z: from.position.z + unitVector.z * projection
    };
    
    const approachDistance = calculateDistance(closestApproachPoint, obj.position);
    
    // Convert obstruction radius from meters to Gm
    const obstructionRadiusGm = obj.obstructionRadius / OrbitalConstants.GM_TO_M;
    
    // Check if approach distance is less than obstruction radius
    if (approachDistance < obstructionRadiusGm) {
      obstructions.push(obj);
    }
  }
  
  return {
    valid: obstructions.length === 0,
    obstructions
  };
}

/**
 * Calculate quantum travel time between two points
 * @param distance Distance in Gigameters
 * @param shipSpeed Ship quantum drive speed in Gm/s
 * @returns Travel time in seconds
 */
export function calculateQuantumTravelTime(distance: number, shipSpeed: number): number {
  // Basic linear calculation for travel time
  return distance / shipSpeed;
}

/**
 * Convert travel time in seconds to a human-readable format
 * @param timeInSeconds Travel time in seconds
 * @returns Formatted time string
 */
export function formatTravelTime(timeInSeconds: number): string {
  if (timeInSeconds < 60) {
    return `${Math.round(timeInSeconds)} seconds`;
  } else if (timeInSeconds < 3600) {
    const minutes = Math.floor(timeInSeconds / 60);
    const seconds = Math.round(timeInSeconds % 60);
    return `${minutes}m ${seconds}s`;
  } else {
    const hours = Math.floor(timeInSeconds / 3600);
    const minutes = Math.floor((timeInSeconds % 3600) / 60);
    return `${hours}h ${minutes}m`;
  }
} 