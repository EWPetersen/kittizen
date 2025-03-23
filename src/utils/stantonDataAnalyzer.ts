import { BaseCelestialObject, StantonSystem } from '../models/celestialObjects';
import { StantonSystemService } from '../services/stantonSystemService';

/**
 * Utility class for analyzing and documenting the Stanton system data structure
 */
export class StantonDataAnalyzer {
  private systemService: StantonSystemService;
  private systemData: StantonSystem;
  
  constructor(systemService: StantonSystemService, systemData: StantonSystem) {
    this.systemService = systemService;
    this.systemData = systemData;
  }
  
  /**
   * Analyze the complete hierarchy of object types in the system
   * @returns Summary of object types and their counts
   */
  public analyzeObjectTypes(): Record<string, number> {
    const typeCounts: Record<string, number> = {};
    const objects = Object.values(this.systemData);
    
    for (const obj of objects) {
      if (!typeCounts[obj.type]) {
        typeCounts[obj.type] = 0;
      }
      typeCounts[obj.type]++;
    }
    
    return typeCounts;
  }
  
  /**
   * Document all properties of each object type
   * @returns Object mapping types to their property sets
   */
  public documentObjectProperties(): Record<string, string[]> {
    const typeProperties: Record<string, Set<string>> = {};
    const objects = Object.values(this.systemData);
    
    for (const obj of objects) {
      if (!typeProperties[obj.type]) {
        typeProperties[obj.type] = new Set();
      }
      
      // Add all properties of this object to the set for its type
      for (const prop in obj) {
        typeProperties[obj.type].add(prop);
      }
    }
    
    // Convert sets to arrays for easier consumption
    const result: Record<string, string[]> = {};
    for (const type in typeProperties) {
      result[type] = Array.from(typeProperties[type]);
    }
    
    return result;
  }
  
  /**
   * Map parent-child relationships in the system
   * @returns Object mapping parent names to arrays of child names
   */
  public mapParentChildRelationships(): Record<string, string[]> {
    const relationships: Record<string, string[]> = {};
    const objects = Object.values(this.systemData);
    
    for (const obj of objects) {
      if (!relationships[obj.parent]) {
        relationships[obj.parent] = [];
      }
      relationships[obj.parent].push(obj.name);
    }
    
    return relationships;
  }
  
  /**
   * Generate a text-based hierarchy visualization
   * @returns String representing the hierarchical structure
   */
  public generateHierarchyVisualization(): string {
    const output: string[] = ['Stanton System Hierarchy:'];
    const root = this.systemService.getRootObject();
    
    if (!root) {
      return 'Error: No root object (Star) found in the system.';
    }
    
    this.appendHierarchyVisualization(root.name, output, '', true);
    
    return output.join('\n');
  }
  
  /**
   * Helper method to recursively build the hierarchy visualization
   */
  private appendHierarchyVisualization(
    objName: string, 
    output: string[], 
    indent: string, 
    isLast: boolean
  ): void {
    const obj = this.systemData[objName];
    if (!obj) return;
    
    // Add this object to the output
    const prefix = isLast ? '└─ ' : '├─ ';
    output.push(`${indent}${prefix}${obj.display_name} (${obj.type})`);
    
    // Get children of this object
    const children = this.systemService.getChildrenOf(obj.name);
    
    // Sort children by type and name for consistent output
    children.sort((a, b) => {
      // First sort by type
      if (a.type !== b.type) {
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
      }
      // Then sort by name
      return a.display_name.localeCompare(b.display_name);
    });
    
    // New indent for children
    const childIndent = indent + (isLast ? '   ' : '│  ');
    
    // Recursively add children
    for (let i = 0; i < children.length; i++) {
      const isLastChild = i === children.length - 1;
      this.appendHierarchyVisualization(children[i].name, output, childIndent, isLastChild);
    }
  }
  
  /**
   * Generate comprehensive documentation of the entire system
   * @returns Complete system documentation as a string
   */
  public generateCompleteDocs(): string {
    const output: string[] = ['# Stanton System Documentation\n'];
    
    // System overview
    output.push('## System Overview');
    const typeCounts = this.analyzeObjectTypes();
    output.push('\nObject counts by type:');
    for (const type in typeCounts) {
      output.push(`- ${type}: ${typeCounts[type]}`);
    }
    
    // Object hierarchy
    output.push('\n## System Hierarchy');
    output.push(this.generateHierarchyVisualization());
    
    // Property documentation
    output.push('\n## Property Documentation');
    const properties = this.documentObjectProperties();
    
    for (const type in properties) {
      output.push(`\n### ${type} Properties`);
      for (const prop of properties[type]) {
        output.push(`- ${prop}`);
      }
    }
    
    // Scale information
    output.push('\n## Scale Information');
    output.push('The system uses a scale where 1 unit = 1 Gigameter (Gm).');
    output.push('For reference, 1 Gm = 1,000,000,000 meters = 1,000,000 kilometers.');
    
    return output.join('\n');
  }
} 