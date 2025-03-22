export interface CelestialObject {
  id: string;
  name: string;
  type: 'star' | 'planet' | 'moon' | 'station' | 'point_of_interest';
  position: [number, number, number]; // 3D coordinates [x, y, z]
  size: number;
  parent?: string; // ID of parent object (e.g., planet for a moon)
  color?: string;
  description?: string;
}

export interface Alert {
  id: string;
  userId: string;
  objectId: string; // ID of the celestial object
  title: string;
  description: string;
  createdAt: Date;
  expiresAt?: Date;
  severity: 'low' | 'medium' | 'high';
  isPublic: boolean;
}

export interface User {
  uid: string;
  email: string;
  displayName?: string;
  savedFilters?: string[];
} 