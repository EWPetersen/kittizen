import { 
  BaseCelestialObject, 
  StantonSystem, 
  Planet, 
  Moon, 
  Star, 
  JumpPoint, 
  LagrangePoint, 
  Station, 
  CommArray, 
  LandingZone,
  isPlanet,
  isMoon,
  isStar,
  isJumpPoint,
  isLagrangePoint,
  isStation,
  isCommArray,
  isLandingZone,
  QuantumTravelParameters,
  Position
} from '../models/celestialObjects';

/**
 * Service for handling Stanton system data operations and calculations
 */
export class StantonSystemService {
  private systemData: StantonSystem;
  private hierarchyCache: Map<string, BaseCelestialObject[]> = new Map();
  private flatObjectList: BaseCelestialObject[] = [];
  
  /**
   * Constructor - Loads and parses the JSON data
   * @param jsonData The parsed JSON data or path to JSON file
   */
  constructor(jsonData: string | StantonSystem) {
    try {
      if (typeof jsonData === 'string') {
        this.systemData = this.loadJsonFile(jsonData);
      } else {
        this.systemData = jsonData;
      }
      
      this.processSystemData();
      this.buildFlatObjectList();
      console.log(`Successfully loaded Stanton system data with ${this.flatObjectList.length} objects`);
    } catch (error) {
      console.error('Error initializing StantonSystemService:', error);
      throw new Error('Failed to initialize Stanton system service');
    }
  }

  /**
   * Loads the JSON file containing Stanton system data
   * @param filePath Path to the JSON file
   * @returns Parsed StantonSystem object
   */
  private loadJsonFile(filePath: string): StantonSystem {
    try {
      // In a browser environment, we'd use fetch
      // In Node.js, we'd use require/fs
      const data = require(filePath);
      return data as StantonSystem;
    } catch (error) {
      console.error('Error loading JSON file:', error);
      throw new Error(`Failed to load Stanton system data from ${filePath}`);
    }
  }

  /**
   * Process the system data to validate and prepare it for use
   */
  private processSystemData(): void {
    // Validate required fields
    for (const key in this.systemData) {
      const obj = this.systemData[key];
      if (!obj.name || !obj.type || !obj.parent || !obj.position || !obj.size) {
        console.warn(`Object ${key} is missing required fields`);
      }
    }
  }

  /**
   * Creates a flat list of all celestial objects for easy iteration
   */
  private buildFlatObjectList(): void {
    this.flatObjectList = Object.values(this.systemData);
  }

  /**
   * Get the root object (Star) of the system
   * @returns The Star object at the center of the system
   */
  public getRootObject(): Star | null {
    return this.flatObjectList.find(obj => isStar(obj)) as Star;
  }

  /**
   * Get all objects of a specific type
   * @param type The type of objects to filter
   * @returns Array of objects matching the specified type
   */
  public getObjectsByType<T extends BaseCelestialObject>(
    type: T['type']
  ): T[] {
    return this.flatObjectList.filter(obj => obj.type === type) as T[];
  }

  /**
   * Get all direct children of a specified parent object
   * @param parentName Name of the parent object
   * @returns Array of child objects
   */
  public getChildrenOf(parentName: string): BaseCelestialObject[] {
    // Check cache first
    if (this.hierarchyCache.has(parentName)) {
      return this.hierarchyCache.get(parentName)!;
    }
    
    const children = this.flatObjectList.filter(obj => obj.parent === parentName);
    
    // Cache the result
    this.hierarchyCache.set(parentName, children);
    
    return children;
  }

  /**
   * Get all descendants of a specified object (children, grandchildren, etc.)
   * @param parentName Name of the parent object
   * @returns Array of all descendant objects
   */
  public getAllDescendantsOf(parentName: string): BaseCelestialObject[] {
    const result: BaseCelestialObject[] = [];
    const directChildren = this.getChildrenOf(parentName);
    
    result.push(...directChildren);
    
    // Recursively get descendants
    for (const child of directChildren) {
      result.push(...this.getAllDescendantsOf(child.name));
    }
    
    return result;
  }

  /**
   * Find an object by its name
   * @param name Name of the object to find
   * @returns The found object or null if not found
   */
  public findObjectByName(name: string): BaseCelestialObject | null {
    return this.systemData[name] || null;
  }

  /**
   * Find objects by a search term in their display name (case insensitive)
   * @param searchTerm Term to search for in display_name
   * @returns Array of matching objects
   */
  public findObjectsByDisplayName(searchTerm: string): BaseCelestialObject[] {
    const term = searchTerm.toLowerCase();
    return this.flatObjectList.filter(obj => 
      obj.display_name.toLowerCase().includes(term)
    );
  }

  /**
   * Calculate the 3D distance between two objects in Gm
   * @param obj1 First object
   * @param obj2 Second object
   * @returns Distance in Gigameters
   */
  public calculateDistance(obj1: BaseCelestialObject, obj2: BaseCelestialObject): number {
    const dx = obj1.position.x - obj2.position.x;
    const dy = obj1.position.y - obj2.position.y;
    const dz = obj1.position.z - obj2.position.z;
    
    return Math.sqrt(dx * dx + dy * dy + dz * dz);
  }

  /**
   * Calculate quantum travel parameters between two objects
   * @param from Source object
   * @param to Destination object
   * @param shipSpeed Speed of the ship in Gm/s
   * @returns Travel parameters including time and distances
   */
  public calculateQuantumTravelParams(
    from: BaseCelestialObject, 
    to: BaseCelestialObject, 
    shipSpeed: number
  ): QuantumTravelParameters {
    const distance = this.calculateDistance(from, to);
    
    // Use the destination's arrival radius
    const arrivalDistance = to.arrivalRadius;
    
    // Use the destination's obstruction radius
    const obstructionDistance = to.obstructionRadius;
    
    // Calculate travel time in seconds
    // Distance minus arrival radius divided by speed
    const travelTime = (distance - arrivalDistance / 1000000) / shipSpeed;
    
    // Simplified fuel calculation - just an example
    const fuelConsumption = distance * 0.1;
    
    return {
      arrivalDistance,
      obstructionDistance,
      travelTime,
      fuelConsumption
    };
  }

  /**
   * Get objects that should be visible at a certain zoom level
   * @param zoomLevel Level of zoom (higher = more zoomed in)
   * @returns Array of objects that should be visible
   */
  public getObjectsForZoomLevel(zoomLevel: number): BaseCelestialObject[] {
    if (zoomLevel < 1) {
      // System view - only show star, planets, and jump points
      return this.flatObjectList.filter(obj => 
        isStar(obj) || isPlanet(obj) || isJumpPoint(obj)
      );
    } else if (zoomLevel < 3) {
      // Medium zoom - add moons and lagrange points
      return this.flatObjectList.filter(obj => 
        isStar(obj) || isPlanet(obj) || isMoon(obj) || 
        isJumpPoint(obj) || isLagrangePoint(obj)
      );
    } else if (zoomLevel < 5) {
      // Closer zoom - add stations
      return this.flatObjectList.filter(obj => 
        isStar(obj) || isPlanet(obj) || isMoon(obj) || 
        isJumpPoint(obj) || isLagrangePoint(obj) || 
        isStation(obj)
      );
    } else {
      // Maximum zoom - show everything
      return this.flatObjectList;
    }
  }

  /**
   * Calculate approximate orbital parameters for visualization
   * @param obj The celestial object
   * @returns Orbital parameters for visualization
   */
  public calculateOrbitalParameters(obj: BaseCelestialObject) {
    if (obj.parent === 'root') {
      return null; // No orbit for the root object (Star)
    }
    
    const parent = this.findObjectByName(obj.parent);
    if (!parent) {
      console.warn(`Parent ${obj.parent} not found for ${obj.name}`);
      return null;
    }
    
    // Calculate distance from parent (semi-major axis)
    const semiMajorAxis = this.calculateDistance(obj, parent);
    
    // For simplicity, assume circular orbits with xy-dominant positioning
    const xDiff = obj.position.x - parent.position.x;
    const yDiff = obj.position.y - parent.position.y;
    
    // Calculate orbital angle
    const angle = Math.atan2(yDiff, xDiff);
    
    // For this simplified model, we'll assume eccentricity is 0 (circular orbits)
    const eccentricity = 0;
    
    return {
      semiMajorAxis,
      eccentricity,
      angle,
      parent: parent.name
    };
  }

  /**
   * Get the object's position at a specific orbital angle
   * @param obj The object to calculate position for
   * @param angle Angle in radians
   * @returns Position at the specified angle
   */
  public getPositionAtAngle(obj: BaseCelestialObject, angle: number): Position {
    const orbitalParams = this.calculateOrbitalParameters(obj);
    if (!orbitalParams) {
      return obj.position; // Return current position if orbit can't be calculated
    }
    
    const parent = this.findObjectByName(orbitalParams.parent);
    if (!parent) {
      return obj.position;
    }
    
    // Calculate new position based on angle and semi-major axis
    // For circular orbits, this is straightforward
    const x = parent.position.x + orbitalParams.semiMajorAxis * Math.cos(angle);
    const y = parent.position.y + orbitalParams.semiMajorAxis * Math.sin(angle);
    
    // Keep the same z value for simplicity (in the data, most orbits are XY-dominant)
    const z = obj.position.z;
    
    return { x, y, z };
  }

  /**
   * Log the complete hierarchy of the star system
   * @param indentation Optional starting indentation for formatting
   */
  public logSystemHierarchy(indentation: string = ''): void {
    const root = this.getRootObject();
    if (!root) {
      console.error('No root object (Star) found in the system');
      return;
    }
    
    this.logObjectAndChildren(root, indentation);
  }

  /**
   * Helper method to recursively log an object and its children
   * @param obj The object to log
   * @param indentation Current indentation level
   */
  private logObjectAndChildren(obj: BaseCelestialObject, indentation: string): void {
    console.log(`${indentation}${obj.display_name} (${obj.type})`);
    
    const children = this.getChildrenOf(obj.name);
    const nextIndent = indentation + '  ';
    
    // Sort children by type for better readability
    const sortedChildren = [...children].sort((a, b) => {
      // Order: Planet, Moon, JumpPoint, LagrangePoint, Station, CommArray, LandingZone
      const typeOrder: Record<string, number> = {
        'Planet': 1,
        'Moon': 2,
        'JumpPoint': 3,
        'LagrangePoint': 4,
        'Station': 5,
        'CommArray': 6,
        'LandingZone': 7
      };
      
      return (typeOrder[a.type] || 99) - (typeOrder[b.type] || 99);
    });
    
    // Recursively log children
    for (const child of sortedChildren) {
      this.logObjectAndChildren(child, nextIndent);
    }
  }

  /**
   * Get summary statistics of the system
   * @returns Object containing count by type and total
   */
  public getSystemStatistics() {
    const stats: Record<string, number> = {
      Star: 0,
      Planet: 0,
      Moon: 0,
      JumpPoint: 0,
      LagrangePoint: 0,
      Station: 0,
      CommArray: 0,
      LandingZone: 0,
      total: this.flatObjectList.length
    };
    
    for (const obj of this.flatObjectList) {
      if (stats[obj.type] !== undefined) {
        stats[obj.type]++;
      }
    }
    
    return stats;
  }
} 