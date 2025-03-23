import { StantonSystem } from '../models/celestialObjects';
import { StantonSystemService } from './stantonSystemService';

/**
 * Service to handle loading and initialization of Stanton system data
 */
export class StantonDataLoader {
  /**
   * Load Stanton system data from the specified URL
   * @param url URL to load data from
   * @returns Promise that resolves to a StantonSystemService
   */
  public static async loadData(url: string = '/src/stanton_extract.json'): Promise<StantonSystemService> {
    try {
      console.log(`Loading Stanton system data from ${url}...`);
      
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Failed to load data: ${response.status} ${response.statusText}`);
      }
      
      const data = await response.json() as StantonSystem;
      console.log(`Successfully loaded ${Object.keys(data).length} objects from Stanton system data`);
      
      // Create and return a new service instance
      return new StantonSystemService(data);
    } catch (error) {
      console.error('Error loading Stanton system data:', error);
      throw error;
    }
  }
  
  /**
   * Validate that the loaded data meets our expectations
   * @param data The loaded data
   * @returns True if data is valid, throws error if invalid
   */
  public static validateData(data: StantonSystem): boolean {
    // Check that we have at least some basic object types
    const objectTypes = new Set<string>();
    let starCount = 0;
    let planetCount = 0;
    
    for (const key in data) {
      const obj = data[key];
      objectTypes.add(obj.type);
      
      if (obj.type === 'Star') {
        starCount++;
      } else if (obj.type === 'Planet') {
        planetCount++;
      }
      
      // Basic validation of required fields
      if (!obj.name || !obj.type || !obj.position || typeof obj.size !== 'number') {
        throw new Error(`Invalid object data for ${key}: missing required fields`);
      }
    }
    
    // We expect at least 1 star and some planets
    if (starCount === 0) {
      throw new Error('Invalid data: No star found in the system');
    }
    
    if (planetCount === 0) {
      throw new Error('Invalid data: No planets found in the system');
    }
    
    // We expect a certain diversity of object types
    const expectedTypes = ['Star', 'Planet', 'Moon', 'JumpPoint', 'Station'];
    for (const type of expectedTypes) {
      if (!objectTypes.has(type)) {
        throw new Error(`Invalid data: No ${type} objects found`);
      }
    }
    
    return true;
  }
  
  /**
   * Helper method to initialize spatial partitioning for more efficient
   * spatial queries (not implemented in this example)
   */
  public static initializeSpatialPartitioning(service: StantonSystemService): void {
    // This would implement a spatial partitioning system
    // such as an octree or grid for efficient spatial queries
    console.log('Spatial partitioning initialization would happen here');
  }
} 