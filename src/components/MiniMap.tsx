import React, { useRef, useEffect, useState } from 'react';
import { StantonSystemMap, BaseCelestialObject } from '../models/celestialObjects';
import './MiniMap.css';

interface MiniMapProps {
  objectsMap: StantonSystemMap;
  selectedObject: string | null;
  onSelectObject: (objectName: string) => void;
  cameraPosition: { x: number; y: number; z: number };
}

const MiniMap: React.FC<MiniMapProps> = ({
  objectsMap,
  selectedObject,
  onSelectObject,
  cameraPosition
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isExpanded, setIsExpanded] = useState(false);
  const [hoveredObject, setHoveredObject] = useState<string | null>(null);
  const [objectPositions, setObjectPositions] = useState<Map<string, {x: number, y: number, size: number, color: string}>>(new Map());
  
  // Distance scale factor
  const SCALE_FACTOR = 1e-9;
  const MINI_SIZE = 150; // Size of mini-map when collapsed
  const EXPANDED_SIZE = 300; // Size when expanded
  
  // Update the map when the objectsMap or selectedObject changes
  useEffect(() => {
    if (!objectsMap || Object.keys(objectsMap).length === 0) return;
    
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Determine map size based on state
    const mapSize = isExpanded ? EXPANDED_SIZE : MINI_SIZE;
    canvas.width = mapSize;
    canvas.height = mapSize;
    
    // Find system center (usually the star)
    const centerObject = Object.values(objectsMap).find(obj => obj.type === 'Star');
    if (!centerObject) return;
    
    // Map celestial object type to color
    const getColorForType = (type: string): string => {
      switch (type) {
        case 'Star': return '#ffe380';
        case 'Planet': return '#80c0ff';
        case 'Moon': return '#a0a0a0';
        case 'JumpPoint': return '#ff80c0';
        case 'LagrangePoint': return '#80ff80';
        case 'Station': return '#c080ff';
        case 'LandingZone': return '#ffaa60';
        default: return '#ffffff';
      }
    };
    
    // Determine map boundaries and scale
    let maxDist = 0;
    
    // Calculate max distance from center to determine scale
    Object.values(objectsMap).forEach(obj => {
      // Skip objects without position data
      if (!obj.position) {
        return;
      }
      
      // Calculate distance from center
      const dx = obj.position.x - centerObject.position.x;
      const dy = obj.position.y - centerObject.position.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      
      if (distance > maxDist) maxDist = distance;
    });
    
    // Add 10% padding to the max distance
    maxDist *= 1.1;
    
    // Scale factor to fit the map
    const scaleFactor = (mapSize / 2) / maxDist;
    
    // Map center in pixels
    const centerX = mapSize / 2;
    const centerY = mapSize / 2;
    
    // Draw background
    ctx.fillStyle = 'rgba(20, 30, 50, 0.7)';
    ctx.fillRect(0, 0, mapSize, mapSize);
    
    // Draw grid
    ctx.strokeStyle = 'rgba(100, 120, 150, 0.2)';
    ctx.lineWidth = 1;
    
    // Draw concentric circles
    const circles = 3;
    for (let i = 1; i <= circles; i++) {
      const radius = (mapSize / 2) * (i / circles);
      ctx.beginPath();
      ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
      ctx.stroke();
    }
    
    // Draw axes
    ctx.beginPath();
    ctx.moveTo(0, centerY);
    ctx.lineTo(mapSize, centerY);
    ctx.moveTo(centerX, 0);
    ctx.lineTo(centerX, mapSize);
    ctx.stroke();
    
    // Store object positions for click detection
    const positions = new Map<string, {x: number, y: number, size: number, color: string}>();
    
    // Draw objects
    Object.entries(objectsMap).forEach(([id, obj]) => {
      // Skip objects without position data
      if (!obj.position) {
        return;
      }
      
      // Calculate position on map
      const dx = obj.position.x - centerObject.position.x;
      const dy = obj.position.y - centerObject.position.y;
      
      const x = centerX + dx * scaleFactor;
      const y = centerY + dy * scaleFactor;
      
      // Skip if outside the map
      if (x < 0 || x > mapSize || y < 0 || y > mapSize) return;
      
      // Determine size based on object type and actual size
      let size = 2; // Default size
      switch (obj.type) {
        case 'Star': size = 6; break;
        case 'Planet': size = 4; break;
        case 'Moon': size = 3; break;
        case 'JumpPoint': 
        case 'LagrangePoint': size = 2; break;
        case 'Station': 
        case 'LandingZone': size = isExpanded ? 2 : 1; break;
      }
      
      // Make selected object larger
      if (id === selectedObject) {
        size *= 1.5;
      }
      
      // Store position for click detection
      positions.set(id, {
        x, y, size,
        color: getColorForType(obj.type)
      });
      
      // Draw object
      ctx.fillStyle = getColorForType(obj.type);
      ctx.beginPath();
      ctx.arc(x, y, size, 0, Math.PI * 2);
      ctx.fill();
      
      // Add highlight for selected object
      if (id === selectedObject || id === hoveredObject) {
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(x, y, size + 2, 0, Math.PI * 2);
        ctx.stroke();
      }
      
      // Add label for important objects or when expanded
      if (isExpanded || obj.type === 'Star' || obj.type === 'Planet' || id === selectedObject) {
        ctx.fillStyle = '#ffffff';
        ctx.font = isExpanded ? '10px Arial' : '8px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'bottom';
        ctx.fillText(obj.display_name, x, y - size - 2);
      }
    });
    
    // Draw camera position indicator
    if (cameraPosition && centerObject && centerObject.position) {
      // Scale camera position to map coordinates
      const camX = centerX + (cameraPosition.x - centerObject.position.x * SCALE_FACTOR) * scaleFactor / SCALE_FACTOR;
      const camY = centerY + (cameraPosition.y - centerObject.position.y * SCALE_FACTOR) * scaleFactor / SCALE_FACTOR;
      
      // Only draw if within map bounds
      if (camX >= 0 && camX <= mapSize && camY >= 0 && camY <= mapSize) {
        // Draw camera indicator
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1;
        ctx.beginPath();
        
        // Draw crosshair
        const crossSize = 5;
        ctx.moveTo(camX - crossSize, camY);
        ctx.lineTo(camX + crossSize, camY);
        ctx.moveTo(camX, camY - crossSize);
        ctx.lineTo(camX, camY + crossSize);
        
        // Draw circle
        ctx.arc(camX, camY, crossSize, 0, Math.PI * 2);
        ctx.stroke();
      }
    }
    
    // Store positions for interaction
    setObjectPositions(positions);
  }, [objectsMap, selectedObject, isExpanded, hoveredObject, cameraPosition]);
  
  // Handle canvas click to select object
  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    // Get click position relative to canvas
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    // Find clicked object
    let clickedObject: string | null = null;
    let minDistance = Number.MAX_VALUE;
    
    objectPositions.forEach((pos, id) => {
      const dx = pos.x - x;
      const dy = pos.y - y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      
      // Check if within object radius (using slightly larger area for easier clicking)
      const clickRadius = pos.size * 2;
      if (distance <= clickRadius && distance < minDistance) {
        clickedObject = id;
        minDistance = distance;
      }
    });
    
    if (clickedObject) {
      onSelectObject(clickedObject);
    }
  };
  
  // Handle mouse movement to highlight objects
  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    // Get mouse position relative to canvas
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    // Find hovered object
    let hovered: string | null = null;
    let minDistance = Number.MAX_VALUE;
    
    objectPositions.forEach((pos, id) => {
      const dx = pos.x - x;
      const dy = pos.y - y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      
      // Check if within object radius
      const hoverRadius = pos.size * 2;
      if (distance <= hoverRadius && distance < minDistance) {
        hovered = id;
        minDistance = distance;
      }
    });
    
    // Update hovered state if changed
    if (hovered !== hoveredObject) {
      setHoveredObject(hovered);
    }
  };
  
  // Clear hover state when mouse leaves
  const handleMouseLeave = () => {
    setHoveredObject(null);
  };
  
  // Toggle expanded state
  const toggleExpanded = () => {
    setIsExpanded(!isExpanded);
  };
  
  return (
    <div className={`mini-map-container ${isExpanded ? 'expanded' : ''}`}>
      <canvas
        ref={canvasRef}
        width={isExpanded ? EXPANDED_SIZE : MINI_SIZE}
        height={isExpanded ? EXPANDED_SIZE : MINI_SIZE}
        className="mini-map-canvas"
        onClick={handleCanvasClick}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
      />
      
      {/* Object info tooltip */}
      {hoveredObject && objectsMap[hoveredObject] && (
        <div className="mini-map-tooltip">
          <div className="tooltip-title">{objectsMap[hoveredObject].display_name}</div>
          <div className="tooltip-type">{objectsMap[hoveredObject].type}</div>
        </div>
      )}
      
      {/* Expand/collapse button */}
      <button 
        className="mini-map-toggle"
        onClick={toggleExpanded}
        title={isExpanded ? "Collapse map" : "Expand map"}
      >
        {isExpanded ? '−' : '+'}
      </button>
      
      {/* Mini-map title */}
      <div className="mini-map-title">
        Stanton System
      </div>
    </div>
  );
};

export default MiniMap; 