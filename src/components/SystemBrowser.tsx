import React, { useState, useEffect, useMemo } from 'react';
import { StantonSystemMap, BaseCelestialObject } from '../models/celestialObjects';
import './SystemBrowser.css';

interface SystemBrowserProps {
  objectsMap: StantonSystemMap;
  selectedObject: string | null;
  onSelectObject: (objectName: string | null) => void;
}

// Define the hierarchical structure for the browser
interface HierarchyNode {
  id: string;
  name: string;
  displayName: string;
  type: string;
  children: HierarchyNode[];
  object: BaseCelestialObject;
}

const SystemBrowser: React.FC<SystemBrowserProps> = ({ 
  objectsMap, 
  selectedObject, 
  onSelectObject 
}) => {
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set(['stantonstar']));
  const [hierarchyRoot, setHierarchyRoot] = useState<HierarchyNode | null>(null);
  const [breadcrumbs, setBreadcrumbs] = useState<HierarchyNode[]>([]);
  const [contextMenu, setContextMenu] = useState<{ x: number, y: number, objectId: string } | null>(null);
  const [isSearchActive, setIsSearchActive] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Array<BaseCelestialObject>>([]);

  // Build the hierarchical structure
  useEffect(() => {
    if (!objectsMap || Object.keys(objectsMap).length === 0) return;

    // Find the stanton star (root)
    const stantonStar = Object.values(objectsMap).find(obj => obj.type === 'Star');
    if (!stantonStar) return;

    // Create the hierarchy tree
    const buildHierarchy = (): HierarchyNode => {
      // Create a node for the star
      const root: HierarchyNode = {
        id: stantonStar.name,
        name: stantonStar.name,
        displayName: stantonStar.display_name,
        type: stantonStar.type,
        children: [],
        object: stantonStar
      };

      // Map to track all nodes by their ID
      const nodesMap = new Map<string, HierarchyNode>();
      nodesMap.set(root.id, root);

      // First pass: create nodes for all objects
      Object.entries(objectsMap).forEach(([key, obj]) => {
        if (key === stantonStar.name) return; // Skip the star as we already added it

        const node: HierarchyNode = {
          id: key,
          name: obj.name,
          displayName: obj.display_name,
          type: obj.type,
          children: [],
          object: obj
        };

        nodesMap.set(key, node);
      });

      // Second pass: build parent-child relationships
      Object.values(objectsMap).forEach(obj => {
        if (obj.name === stantonStar.name) return; // Skip the star

        const childNode = nodesMap.get(obj.name);
        const parentNode = nodesMap.get(obj.parent);

        if (childNode && parentNode) {
          parentNode.children.push(childNode);
        }
      });

      // Sort children by type and then by name
      const sortChildren = (node: HierarchyNode) => {
        // Sort order: Planets, Moons, Stations, LandingZones, JumpPoints, LagrangePoints
        const typeOrder: Record<string, number> = {
          'Planet': 0,
          'Moon': 1,
          'Station': 2,
          'LandingZone': 3,
          'JumpPoint': 4,
          'LagrangePoint': 5
        };

        node.children.sort((a, b) => {
          // First sort by type
          const typeOrderA = typeOrder[a.type] ?? 999;
          const typeOrderB = typeOrder[b.type] ?? 999;
          
          if (typeOrderA !== typeOrderB) {
            return typeOrderA - typeOrderB;
          }
          
          // Then sort by display name
          return a.displayName.localeCompare(b.displayName);
        });

        // Recursively sort children
        node.children.forEach(sortChildren);
      };

      sortChildren(root);
      return root;
    };

    const hierarchy = buildHierarchy();
    setHierarchyRoot(hierarchy);

    // Initialize breadcrumbs with the root
    setBreadcrumbs([hierarchy]);
  }, [objectsMap]);

  // Update breadcrumbs when selected object changes
  useEffect(() => {
    if (!selectedObject || !hierarchyRoot) return;

    // Find path to selected object
    const findPath = (
      node: HierarchyNode,
      targetId: string,
      currentPath: HierarchyNode[]
    ): HierarchyNode[] | null => {
      if (node.id === targetId) {
        return [...currentPath, node];
      }

      for (const child of node.children) {
        const path = findPath(child, targetId, [...currentPath, node]);
        if (path) return path;
      }

      return null;
    };

    const path = findPath(hierarchyRoot, selectedObject, []);
    if (path) {
      setBreadcrumbs(path);
      
      // Expand all nodes in the path without creating an infinite loop
      setExpandedNodes(prevExpandedNodes => {
        const newExpandedNodes = new Set(prevExpandedNodes);
        let hasChanges = false;
        
        path.forEach(node => {
          if (!newExpandedNodes.has(node.id)) {
            newExpandedNodes.add(node.id);
            hasChanges = true;
          }
        });
        
        // Only return a new set if there were changes
        return hasChanges ? newExpandedNodes : prevExpandedNodes;
      });
    }
  }, [selectedObject, hierarchyRoot]);

  // Search functionality
  useEffect(() => {
    if (!searchQuery.trim() || !objectsMap) {
      setSearchResults([]);
      return;
    }

    const query = searchQuery.toLowerCase();
    const results = Object.values(objectsMap).filter(obj => 
      obj.display_name.toLowerCase().includes(query) || 
      obj.name.toLowerCase().includes(query)
    );

    setSearchResults(results);
  }, [searchQuery, objectsMap]);

  // Toggle node expansion
  const toggleNodeExpansion = (nodeId: string) => {
    const newExpandedNodes = new Set(expandedNodes);
    if (newExpandedNodes.has(nodeId)) {
      newExpandedNodes.delete(nodeId);
    } else {
      newExpandedNodes.add(nodeId);
    }
    setExpandedNodes(newExpandedNodes);
  };

  // Handle object selection
  const handleObjectClick = (objectId: string) => {
    onSelectObject(objectId);
  };

  // Handle breadcrumb navigation
  const handleBreadcrumbClick = (node: HierarchyNode) => {
    onSelectObject(node.id);
  };

  // Toggle search mode
  const toggleSearch = () => {
    setIsSearchActive(!isSearchActive);
    if (isSearchActive) {
      setSearchQuery('');
    }
  };

  // Recursive function to render the tree
  const renderTree = (node: HierarchyNode) => {
    const isExpanded = expandedNodes.has(node.id);
    const isSelected = selectedObject === node.id;
    const hasChildren = node.children.length > 0;

    // Determine icon based on object type
    const getIconForType = (type: string) => {
      switch (type) {
        case 'Star': return '☀️';
        case 'Planet': return '🪐';
        case 'Moon': return '🌙';
        case 'JumpPoint': return '🌀';
        case 'LagrangePoint': return '📍';
        case 'Station': return '🛰️';
        case 'LandingZone': return '🏙️';
        default: return '•';
      }
    };

    return (
      <div key={node.id} className="browser-node">
        <div 
          className={`browser-node-header ${isSelected ? 'selected' : ''}`}
          onClick={() => handleObjectClick(node.id)}
          onContextMenu={(e) => {
            e.preventDefault();
            setContextMenu({ x: e.clientX, y: e.clientY, objectId: node.id });
          }}
        >
          {hasChildren && (
            <span 
              className="expand-toggle"
              onClick={(e) => {
                e.stopPropagation();
                toggleNodeExpansion(node.id);
              }}
            >
              {isExpanded ? '▼' : '▶'}
            </span>
          )}
          <span className="node-icon">{getIconForType(node.type)}</span>
          <span className="node-label">{node.displayName}</span>
          <span className="node-type">{node.type}</span>
        </div>
        
        {isExpanded && hasChildren && (
          <div className="browser-node-children">
            {node.children.map(child => renderTree(child))}
          </div>
        )}
      </div>
    );
  };

  // Render search results
  const renderSearchResults = () => {
    if (searchResults.length === 0) {
      return <div className="no-results">No results found</div>;
    }

    return (
      <div className="search-results">
        {searchResults.map(obj => (
          <div 
            key={obj.name}
            className={`search-result-item ${selectedObject === obj.name ? 'selected' : ''}`}
            onClick={() => handleObjectClick(obj.name)}
          >
            <span className="result-icon">
              {(() => {
                switch (obj.type) {
                  case 'Star': return '☀️';
                  case 'Planet': return '🪐';
                  case 'Moon': return '🌙';
                  case 'JumpPoint': return '🌀';
                  case 'LagrangePoint': return '📍';
                  case 'Station': return '🛰️';
                  case 'LandingZone': return '🏙️';
                  default: return '•';
                }
              })()}
            </span>
            <span className="result-name">{obj.display_name}</span>
            <span className="result-type">{obj.type}</span>
          </div>
        ))}
      </div>
    );
  };

  // Quick access buttons for major celestial bodies
  const QuickAccessButtons = useMemo(() => {
    if (!objectsMap) return null;

    // Find the major objects (star and planets)
    const star = Object.values(objectsMap).find(obj => obj.type === 'Star');
    const planets = Object.values(objectsMap).filter(obj => obj.type === 'Planet');

    return (
      <div className="quick-access-buttons">
        {star && (
          <button 
            className={`quick-button star ${selectedObject === star.name ? 'selected' : ''}`}
            onClick={() => handleObjectClick(star.name)}
          >
            ☀️ {star.display_name}
          </button>
        )}
        {planets.map(planet => (
          <button 
            key={planet.name}
            className={`quick-button planet ${selectedObject === planet.name ? 'selected' : ''}`}
            onClick={() => handleObjectClick(planet.name)}
          >
            🪐 {planet.display_name}
          </button>
        ))}
      </div>
    );
  }, [objectsMap, selectedObject, handleObjectClick]);

  // Render context menu if active
  const renderContextMenu = () => {
    if (!contextMenu) return null;

    const object = objectsMap[contextMenu.objectId];
    if (!object) return null;

    return (
      <div 
        className="context-menu"
        style={{ top: contextMenu.y, left: contextMenu.x }}
      >
        <div className="context-menu-header">
          <span className="context-object-name">{object.display_name}</span>
          <span className="context-object-type">{object.type}</span>
        </div>
        <div className="context-menu-item" onClick={() => {
          onSelectObject(contextMenu.objectId);
          setContextMenu(null);
        }}>
          Focus Camera
        </div>
        <div className="context-menu-item" onClick={() => {
          // Toggle expanded state for this node
          toggleNodeExpansion(contextMenu.objectId);
          setContextMenu(null);
        }}>
          {expandedNodes.has(contextMenu.objectId) ? 'Collapse' : 'Expand'}
        </div>
        <div className="context-menu-item" onClick={() => setContextMenu(null)}>
          Close
        </div>
      </div>
    );
  };

  // Hide context menu when clicking outside
  useEffect(() => {
    const handleClickOutside = () => setContextMenu(null);
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);

  if (!hierarchyRoot) {
    return <div className="system-browser loading">Loading system data...</div>;
  }

  return (
    <div className="system-browser">
      {/* Breadcrumb navigation */}
      <div className="breadcrumb-navigation">
        {breadcrumbs.map((node, index) => (
          <React.Fragment key={node.id}>
            {index > 0 && <span className="breadcrumb-separator">›</span>}
            <span 
              className={`breadcrumb ${selectedObject === node.id ? 'active' : ''}`}
              onClick={() => handleBreadcrumbClick(node)}
            >
              {node.displayName}
            </span>
          </React.Fragment>
        ))}
      </div>

      {/* Search and filter toolbar */}
      <div className="browser-toolbar">
        <div className="search-container">
          <input
            type="text"
            className={`search-input ${isSearchActive ? 'active' : ''}`}
            placeholder="Search objects..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onFocus={() => setIsSearchActive(true)}
          />
          <button 
            className={`search-toggle ${isSearchActive ? 'active' : ''}`}
            onClick={toggleSearch}
          >
            {isSearchActive ? '✕' : '🔍'}
          </button>
        </div>
      </div>

      {/* Quick access buttons */}
      {QuickAccessButtons}

      {/* Main browser content */}
      <div className="browser-content">
        {isSearchActive && searchQuery 
          ? renderSearchResults() 
          : renderTree(hierarchyRoot)
        }
      </div>

      {/* Context menu */}
      {renderContextMenu()}
    </div>
  );
};

export default SystemBrowser; 