import { StantonSystemMap } from '../models/celestialObjects';
import { parseStantonData, groupByType } from '../utils/mapDataUtils';

/**
 * Service for loading and managing celestial map data
 */
class MapDataService {
  private mapData: StantonSystemMap | null = null;
  private groupedData: ReturnType<typeof groupByType> | null = null;
  
  /**
   * Load the Stanton system data from the JSON file
   */
  async loadStantonData(): Promise<StantonSystemMap> {
    try {
      // Use a relative path that works in development and production
      const response = await fetch('/stanton_extract.json');
      if (!response.ok) {
        throw new Error(`Failed to load Stanton data: ${response.statusText}`);
      }
      
      const rawData = await response.json();
      this.mapData = parseStantonData(rawData);
      this.groupedData = groupByType(this.mapData);
      
      return this.mapData;
    } catch (error) {
      console.error('Error loading Stanton data:', error);
      throw error;
    }
  }
  
  /**
   * Get the full map data
   */
  getMapData(): StantonSystemMap {
    if (!this.mapData) {
      throw new Error('Map data not loaded. Call loadStantonData() first.');
    }
    return this.mapData;
  }
  
  /**
   * Get data grouped by object type
   */
  getGroupedData() {
    if (!this.groupedData) {
      if (!this.mapData) {
        throw new Error('Map data not loaded. Call loadStantonData() first.');
      }
      this.groupedData = groupByType(this.mapData);
    }
    return this.groupedData;
  }
  
  /**
   * Get all objects of a specific type
   * @param type The type of celestial object to retrieve
   */
  getObjectsByType(type: string) {
    const grouped = this.getGroupedData();
    
    switch (type.toLowerCase()) {
      case 'star':
      case 'stars':
        return grouped.stars;
      case 'planet':
      case 'planets':
        return grouped.planets;
      case 'moon':
      case 'moons':
        return grouped.moons;
      case 'station':
      case 'stations':
        return grouped.stations;
      case 'jumppoint':
      case 'jumppoints':
        return grouped.jumpPoints;
      case 'lagrangepoint':
      case 'lagrangepoints':
        return grouped.lagrangePoints;
      case 'landingzone':
      case 'landingzones':
        return grouped.landingZones;
      case 'commarray':
      case 'commarrays':
        return grouped.commArrays;
      default:
        throw new Error(`Unknown object type: ${type}`);
    }
  }
  
  /**
   * Find an object by its name
   * @param name The name of the celestial object
   */
  findObjectByName(name: string) {
    if (!this.mapData) {
      throw new Error('Map data not loaded. Call loadStantonData() first.');
    }
    
    return this.mapData[name] || null;
  }
  
  /**
   * Find objects by display name (case-insensitive partial match)
   * @param displayName The display name to search for
   */
  findObjectsByDisplayName(displayName: string) {
    if (!this.mapData) {
      throw new Error('Map data not loaded. Call loadStantonData() first.');
    }
    
    const searchTerm = displayName.toLowerCase();
    return Object.values(this.mapData).filter(obj => 
      obj.display_name.toLowerCase().includes(searchTerm)
    );
  }
}

// Create and export a singleton instance
export const mapDataService = new MapDataService();
export default mapDataService; 