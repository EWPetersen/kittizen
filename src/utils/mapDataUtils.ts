import { 
  StantonSystemMap, 
  BaseCelestialObject,
  JumpPoint,
  LagrangePoint,
  Planet,
  Moon,
  LandingZone,
  Station,
  Star,
  CommArray,
  QuantumTravelParameters
} from '../models/celestialObjects';

/**
 * Check if an object is a Planet
 */
export const isPlanet = (obj: BaseCelestialObject): obj is Planet => {
  return obj.type === 'Planet';
};

/**
 * Check if an object is a Moon
 */
export const isMoon = (obj: BaseCelestialObject): obj is Moon => {
  return obj.type === 'Moon';
};

/**
 * Check if an object is a Station
 */
export const isStation = (obj: BaseCelestialObject): obj is Station => {
  return obj.type === 'Station';
};

/**
 * Check if an object is a JumpPoint
 */
export const isJumpPoint = (obj: BaseCelestialObject): obj is JumpPoint => {
  return obj.type === 'JumpPoint';
};

/**
 * Check if an object is a LagrangePoint
 */
export const isLagrangePoint = (obj: BaseCelestialObject): obj is LagrangePoint => {
  return obj.type === 'LagrangePoint';
};

/**
 * Check if an object is a LandingZone
 */
export const isLandingZone = (obj: BaseCelestialObject): obj is LandingZone => {
  return obj.type === 'LandingZone';
};

/**
 * Check if an object is a Star
 */
export const isStar = (obj: BaseCelestialObject): obj is Star => {
  return obj.type === 'Star';
};

/**
 * Check if an object is a CommArray
 */
export const isCommArray = (obj: BaseCelestialObject): obj is CommArray => {
  return obj.type === 'CommArray';
};

/**
 * Calculate distance between two positions in 3D space
 */
export const calculateDistance = (pos1: { x: number, y: number, z: number }, pos2: { x: number, y: number, z: number }): number => {
  const dx = pos2.x - pos1.x;
  const dy = pos2.y - pos1.y;
  const dz = pos2.z - pos1.z;
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
};

/**
 * Find all children of a celestial object
 */
export const findChildren = (parentName: string, mapData: StantonSystemMap): BaseCelestialObject[] => {
  return Object.values(mapData).filter(obj => obj.parent === parentName);
};

/**
 * Find a celestial object's parent
 */
export const findParent = (childObject: BaseCelestialObject, mapData: StantonSystemMap): BaseCelestialObject | null => {
  return childObject.parent ? mapData[childObject.parent] || null : null;
};

/**
 * Calculate quantum travel parameters between two points
 * @param start Starting position
 * @param end Destination position
 * @param shipSpeed Speed of the ship in m/s
 */
export const calculateQuantumTravelParameters = (
  start: BaseCelestialObject, 
  end: BaseCelestialObject,
  shipSpeed: number
): QuantumTravelParameters => {
  const distance = calculateDistance(start.position, end.position);
  const travelTime = distance / shipSpeed;
  const fuelConsumption = distance * 0.0001; // Example calculation
  
  return {
    arrivalDistance: end.arrivalRadius,
    obstructionDistance: end.obstructionRadius,
    travelTime,
    fuelConsumption
  };
};

/**
 * Group celestial objects by their type
 */
export const groupByType = (mapData: StantonSystemMap) => {
  const result = {
    stars: [] as Star[],
    planets: [] as Planet[],
    moons: [] as Moon[],
    stations: [] as Station[],
    jumpPoints: [] as JumpPoint[],
    lagrangePoints: [] as LagrangePoint[],
    landingZones: [] as LandingZone[],
    commArrays: [] as CommArray[]
  };

  Object.values(mapData).forEach(obj => {
    if (isPlanet(obj)) result.planets.push(obj);
    else if (isMoon(obj)) result.moons.push(obj);
    else if (isStation(obj)) result.stations.push(obj);
    else if (isJumpPoint(obj)) result.jumpPoints.push(obj);
    else if (isLagrangePoint(obj)) result.lagrangePoints.push(obj);
    else if (isLandingZone(obj)) result.landingZones.push(obj);
    else if (isStar(obj)) result.stars.push(obj);
    else if (isCommArray(obj)) result.commArrays.push(obj);
  });

  return result;
};

/**
 * Parse the raw JSON data into properly typed objects
 */
export const parseStantonData = (rawData: any): StantonSystemMap => {
  const result: StantonSystemMap = {};
  
  Object.entries(rawData).forEach(([key, value]) => {
    const rawObj = value as any;
    
    // Check for missing or null position and provide default
    if (!rawObj.position) {
      console.warn(`Missing position for object: ${key}`);
      rawObj.position = { x: 0, y: 0, z: 0 };
    }
    
    // Create properly typed object based on the 'type' field
    switch (rawObj.type) {
      case 'Planet':
        result[key] = rawObj as Planet;
        break;
      case 'Moon':
        result[key] = rawObj as Moon;
        break;
      case 'Station':
        result[key] = rawObj as Station;
        break;
      case 'JumpPoint':
        result[key] = rawObj as JumpPoint;
        break;
      case 'LagrangePoint':
        result[key] = rawObj as LagrangePoint;
        break;
      case 'LandingZone':
        result[key] = rawObj as LandingZone;
        break;
      case 'Star':
        result[key] = rawObj as Star;
        break;
      case 'CommArray':
        result[key] = rawObj as CommArray;
        break;
      default:
        console.warn(`Unknown celestial object type: ${rawObj.type} for object ${key}`);
        // Create a default object of CommArray type to ensure type safety
        result[key] = {
          ...rawObj,
          position: rawObj.position || { x: 0, y: 0, z: 0 },
          rotation: rawObj.rotation || { w: 1, x: 0, y: 0, z: 0 },
          type: "CommArray" // Set as CommArray to satisfy type constraints
        } as CommArray;
    }
  });
  
  return result;
}; 