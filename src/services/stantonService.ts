import { CelestialObject } from '../models/types';
import stantonData from '../stanton_extract.json';

// Helper function to transform the stanton data from object format to array format
export const getStantonData = (): CelestialObject[] => {
  // Convert the object structure to an array of CelestialObject
  const data = Object.entries(stantonData).map(([key, value]: [string, any]) => {
    return {
      id: key,
      name: value.display_name || value.name,
      // Map the type from Stanton data to our defined types
      type: mapObjectType(value.type),
      position: [value.position.x, value.position.y, value.position.z],
      size: value.size,
      parent: value.parent || undefined,
      // Optional properties
      color: getColorByType(mapObjectType(value.type)),
      description: `${value.display_name || value.name} (${value.type})`
    } as CelestialObject;
  });
  
  return data;
};

// Helper function to map Stanton object types to our defined types
const mapObjectType = (type: string): CelestialObject['type'] => {
  switch (type) {
    case 'Star':
      return 'star';
    case 'Planet':
      return 'planet';
    case 'Moon':
      return 'moon';
    case 'SpaceStation':
    case 'Station':
      return 'station';
    case 'JumpPoint':
    case 'LagrangePoint':
    default:
      return 'point_of_interest';
  }
};

// Helper function to get color based on object type
const getColorByType = (type: CelestialObject['type']): string => {
  switch (type) {
    case 'star':
      return '#FFFF00'; // Yellow
    case 'planet':
      return '#3366CC'; // Blue
    case 'moon':
      return '#CCCCCC'; // Gray
    case 'station':
      return '#FF6600'; // Orange
    case 'point_of_interest':
      return '#66FF66'; // Green
    default:
      return '#FFFFFF'; // White
  }
};

export const getCelestialObjectById = (id: string): CelestialObject | undefined => {
  const data = getStantonData();
  return data.find(obj => obj.id === id);
};

export const getCelestialObjectsByType = (type: CelestialObject['type']): CelestialObject[] => {
  const data = getStantonData();
  return data.filter(obj => obj.type === type);
};

export const getCelestialObjectsByParent = (parentId: string): CelestialObject[] => {
  const data = getStantonData();
  return data.filter(obj => obj.parent === parentId);
}; 