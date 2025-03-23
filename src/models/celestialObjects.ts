/**
 * Celestial object interfaces for Star Citizen's Stanton system map
 * Based on data structure from stanton_extract.json
 */

/**
 * Position in 3D space represented by x, y, z coordinates
 */
export interface Position {
  x: number;
  y: number;
  z: number;
}

/**
 * Rotation quaternion
 */
export interface Rotation {
  w: number;
  x: number;
  y: number;
  z: number;
}

/**
 * Orbital markers representing positions around a celestial body
 */
export interface OrbitalMarkers {
  om1: Position;
  om2: Position;
  om3: Position;
  om4: Position;
  om5: Position;
  om6: Position;
}

/**
 * Types of celestial objects in the Stanton system
 */
export type CelestialObjectType = 
  | 'Star' 
  | 'Planet' 
  | 'Moon' 
  | 'JumpPoint' 
  | 'LagrangePoint' 
  | 'LandingZone' 
  | 'CommArray' 
  | 'Station';

/**
 * Base interface for all celestial objects in the Stanton system
 */
export interface BaseCelestialObject {
  /** Unique name identifier */
  name: string;
  /** Human-readable display name */
  display_name: string;
  /** Type of celestial object */
  type: CelestialObjectType;
  /** Parent object name reference */
  parent: string;
  /** Position in 3D space */
  position?: Position;
  /** Rotation quaternion */
  rotation: Rotation;
  /** Size/radius in meters */
  size: number;
  /** Arrival distance in meters */
  arrivalRadius: number;
  /** Minimum approach distance in meters */
  obstructionRadius: number;
  /** Height of atmosphere in meters (0 for no atmosphere) */
  atmoHeight: number;
  /** System entity name for reference */
  system_entity_name: string;
}

/**
 * Jump Point between star systems
 */
export interface JumpPoint extends BaseCelestialObject {
  type: "JumpPoint";
}

/**
 * Lagrange Point - stable orbital position
 */
export interface LagrangePoint extends BaseCelestialObject {
  type: "LagrangePoint";
}

/**
 * Communication Array station
 */
export interface CommArray extends BaseCelestialObject {
  type: "CommArray";
}

/**
 * Star - central object of a star system
 */
export interface Star extends BaseCelestialObject {
  type: "Star";
}

/**
 * Planet - large celestial body orbiting a star
 */
export interface Planet extends BaseCelestialObject {
  type: "Planet";
  /** Orbital markers positioned around the planet */
  orbitalMarkers: OrbitalMarkers;
}

/**
 * Moon - celestial body orbiting a planet
 */
export interface Moon extends BaseCelestialObject {
  type: "Moon";
  /** Orbital markers positioned around the moon */
  orbitalMarkers: OrbitalMarkers;
}

/**
 * Landing Zone - surface location on a planet/moon
 */
export interface LandingZone extends BaseCelestialObject {
  type: "LandingZone";
}

/**
 * Space Station - artificial structure in space
 */
export interface Station extends BaseCelestialObject {
  type: "Station";
}

/**
 * Rest Stop Station - specialized station type
 */
export interface RestStopStation extends Station {
  /** Station pattern includes "reststop" in name */
}

export interface SecurityStation extends Station {
  /** Station pattern includes "security" in name */
}

export interface LEOStation extends Station {
  /** Low Earth Orbit station - usually close to planet */
}

export interface ShippingHubStation extends Station {
  /** Shipping/cargo-focused station */
}

/**
 * Complete Stanton system map containing all celestial objects
 */
export interface StantonSystemMap {
  [key: string]: JumpPoint | LagrangePoint | Star | Planet | Moon | LandingZone | Station | CommArray;
}

/**
 * Parameters for quantum travel between objects
 */
export interface QuantumTravelParameters {
  /** Distance from target at which arrival occurs */
  arrivalDistance: number;
  /** Minimum distance to avoid obstruction */
  obstructionDistance: number;
  /** Calculated travel time in seconds */
  travelTime: number;
  /** Fuel consumption for travel */
  fuelConsumption: number;
}

/**
 * Alert for routes in the system
 */
export interface RouteAlert {
  /** Unique identifier */
  id: string;
  /** User who created the alert */
  userId: string;
  /** When alert was created */
  createdAt: Date;
  /** When alert expires (4-hour decay system) */
  expiresAt: Date;
  /** Affected celestial object */
  objectId: string;
  /** Alert title */
  title: string;
  /** Alert description */
  description: string;
  /** Severity level */
  severity: 'low' | 'medium' | 'high';
  /** Server/shard identifier */
  serverId: string;
  /** Region identifier */
  region: string;
  /** Confirmation count from other users */
  confirmations: number;
  /** Dispute count from other users */
  disputes: number;
  /** Whether alert is publicly visible */
  isPublic: boolean;
}

/**
 * User profile information
 */
export interface UserProfile {
  /** Unique identifier */
  uid: string;
  /** Email address */
  email: string;
  /** Display name */
  displayName?: string;
  /** Subscription status */
  subscriptionStatus: 'free' | 'premium';
  /** Subscription expiry date */
  subscriptionExpiryDate?: Date;
  /** User reputation score */
  reputationScore: number;
  /** User alert history count */
  alertsCreated: number;
  /** User confirmed alerts count */
  alertsConfirmed: number;
  /** Saved filters for map view */
  savedFilters?: string[];
  /** User preferences */
  preferences: {
    darkMode: boolean;
    showAlerts: boolean;
    alertNotifications: boolean;
    defaultView: 'system' | 'planet' | 'moon' | 'station';
    defaultSystem: string;
  }
}

/**
 * Type guard for checking if a celestial object is a Star
 */
export function isStar(object: BaseCelestialObject): object is Star {
  return object.type === 'Star';
}

/**
 * Type guard for checking if a celestial object is a Planet
 */
export function isPlanet(object: BaseCelestialObject): object is Planet {
  return object.type === 'Planet';
}

/**
 * Type guard for checking if a celestial object is a Moon
 */
export function isMoon(object: BaseCelestialObject): object is Moon {
  return object.type === 'Moon';
}

/**
 * Type guard for checking if a celestial object is a Jump Point
 */
export function isJumpPoint(object: BaseCelestialObject): object is JumpPoint {
  return object.type === 'JumpPoint';
}

/**
 * Type guard for checking if a celestial object is a Lagrange Point
 */
export function isLagrangePoint(object: BaseCelestialObject): object is LagrangePoint {
  return object.type === 'LagrangePoint';
}

/**
 * Type guard for checking if a celestial object is a Landing Zone
 */
export function isLandingZone(object: BaseCelestialObject): object is LandingZone {
  return object.type === 'LandingZone';
}

/**
 * Type guard for checking if a celestial object is a Comm Array
 */
export function isCommArray(object: BaseCelestialObject): object is CommArray {
  return object.type === 'CommArray';
}

/**
 * Type guard for checking if a celestial object is a Station
 */
export function isStation(object: BaseCelestialObject): object is Station {
  return object.type === 'Station';
}

/**
 * Complete data structure for the Stanton system
 */
export type StantonSystem = {
  [key: string]: BaseCelestialObject;
} 