import { useState, useMemo, useCallback } from 'react';
import {
  BaseCelestialObject,
  StantonSystemMap,
  isStar,
  isPlanet,
  isMoon,
  isJumpPoint,
  isLagrangePoint,
  isStation,
  isCommArray,
  isLandingZone
} from '../models/celestialObjects';
import './ObjectDetails.css';

// Distance scale for the visualization
const GM_SCALE = 1e9;

interface ObjectDetailsProps {
  selectedObjectName: string;
  objects: StantonSystemMap;
  onClose: () => void;
  onSelectObject: (name: string) => void;
}

const ObjectDetails: React.FC<ObjectDetailsProps> = ({
  selectedObjectName,
  objects,
  onClose,
  onSelectObject
}) => {
  const [activeTab, setActiveTab] = useState<'info' | 'position' | 'relations' | 'travel'>('info');
  
  // Get the selected object
  const selectedObject = useMemo(() => {
    return selectedObjectName ? objects[selectedObjectName] : null;
  }, [selectedObjectName, objects]);
  
  // Get the parent object
  const parentObject = useMemo(() => {
    if (!selectedObject || !selectedObject.parent || selectedObject.parent === 'root') {
      return null;
    }
    return objects[selectedObject.parent];
  }, [selectedObject, objects]);
  
  // Get children objects
  const childObjects = useMemo(() => {
    if (!selectedObject) return [];
    return Object.values(objects).filter(obj => obj.parent === selectedObject.name);
  }, [selectedObject, objects]);
  
  // Format coordinates with proper units
  const formatCoordinate = useCallback((value: number) => {
    if (Math.abs(value) >= 1e9) {
      return `${(value / 1e9).toFixed(2)} Gm`;
    } else if (Math.abs(value) >= 1e6) {
      return `${(value / 1e6).toFixed(2)} Mm`;
    } else if (Math.abs(value) >= 1e3) {
      return `${(value / 1e3).toFixed(2)} km`;
    } else {
      return `${value.toFixed(2)} m`;
    }
  }, []);
  
  // Get the type icon for the object
  const getTypeIcon = useCallback((object: BaseCelestialObject) => {
    if (isStar(object)) return '☀️';
    if (isPlanet(object)) return '🪐';
    if (isMoon(object)) return '🌑';
    if (isJumpPoint(object)) return '🌀';
    if (isLagrangePoint(object)) return '🔷';
    if (isStation(object)) {
      if (object.name.includes('reststop')) return '🛑';
      if (object.name.includes('commarray')) return '📡';
      if (object.name.includes('leo')) return '🛰️';
      if (object.name.includes('security')) return '🛡️';
      return '🚀';
    }
    if (isLandingZone(object)) return '🏙️';
    return '🔹';
  }, []);
  
  // Calculate distance to another object
  const calculateDistance = useCallback((object1: BaseCelestialObject, object2: BaseCelestialObject) => {
    const dx = object1.position.x - object2.position.x;
    const dy = object1.position.y - object2.position.y;
    const dz = object1.position.z - object2.position.z;
    return Math.sqrt(dx*dx + dy*dy + dz*dz);
  }, []);
  
  if (!selectedObject) return null;
  
  return (
    <div className="object-details-panel">
      <div className="object-details-header">
        <div className="object-title">
          <span className="object-icon">{getTypeIcon(selectedObject)}</span>
          <h2>{selectedObject.display_name}</h2>
          <span className="object-type">{selectedObject.type}</span>
        </div>
        <button className="close-button" onClick={onClose}>×</button>
      </div>
      
      <div className="object-details-tabs">
        <button 
          className={activeTab === 'info' ? 'active' : ''} 
          onClick={() => setActiveTab('info')}
        >
          Info
        </button>
        <button 
          className={activeTab === 'position' ? 'active' : ''} 
          onClick={() => setActiveTab('position')}
        >
          Position
        </button>
        <button 
          className={activeTab === 'relations' ? 'active' : ''} 
          onClick={() => setActiveTab('relations')}
        >
          Relations
        </button>
        <button 
          className={activeTab === 'travel' ? 'active' : ''} 
          onClick={() => setActiveTab('travel')}
        >
          Travel
        </button>
      </div>
      
      <div className="object-details-content">
        {activeTab === 'info' && (
          <div className="info-tab">
            <div className="detail-row">
              <span className="detail-label">Name:</span>
              <span className="detail-value">{selectedObject.name}</span>
            </div>
            <div className="detail-row">
              <span className="detail-label">Display Name:</span>
              <span className="detail-value">{selectedObject.display_name}</span>
            </div>
            <div className="detail-row">
              <span className="detail-label">Type:</span>
              <span className="detail-value">{selectedObject.type}</span>
            </div>
            <div className="detail-row">
              <span className="detail-label">Size:</span>
              <span className="detail-value">{formatCoordinate(selectedObject.size)}</span>
            </div>
            {selectedObject.atmoHeight > 0 && (
              <div className="detail-row">
                <span className="detail-label">Atmosphere Height:</span>
                <span className="detail-value">{formatCoordinate(selectedObject.atmoHeight)}</span>
              </div>
            )}
            <div className="detail-row">
              <span className="detail-label">System Entity:</span>
              <span className="detail-value">{selectedObject.system_entity_name}</span>
            </div>
            
            {isPlanet(selectedObject) || isMoon(selectedObject) ? (
              <div className="detail-section">
                <h3>Orbital Markers</h3>
                <ul className="orbital-markers-list">
                  {Object.entries(selectedObject.orbitalMarkers).map(([key, position]) => (
                    <li key={key}>
                      <span className="marker-name">{key.toUpperCase()}:</span>
                      <span className="marker-coords">
                        ({formatCoordinate(position.x)}, {formatCoordinate(position.y)}, {formatCoordinate(position.z)})
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        )}
        
        {activeTab === 'position' && (
          <div className="position-tab">
            <div className="detail-row">
              <span className="detail-label">X:</span>
              <span className="detail-value">{formatCoordinate(selectedObject.position.x)}</span>
            </div>
            <div className="detail-row">
              <span className="detail-label">Y:</span>
              <span className="detail-value">{formatCoordinate(selectedObject.position.y)}</span>
            </div>
            <div className="detail-row">
              <span className="detail-label">Z:</span>
              <span className="detail-value">{formatCoordinate(selectedObject.position.z)}</span>
            </div>
            
            <div className="detail-section">
              <h3>Rotation (Quaternion)</h3>
              <div className="detail-row">
                <span className="detail-label">W:</span>
                <span className="detail-value">{selectedObject.rotation.w.toFixed(4)}</span>
              </div>
              <div className="detail-row">
                <span className="detail-label">X:</span>
                <span className="detail-value">{selectedObject.rotation.x.toFixed(4)}</span>
              </div>
              <div className="detail-row">
                <span className="detail-label">Y:</span>
                <span className="detail-value">{selectedObject.rotation.y.toFixed(4)}</span>
              </div>
              <div className="detail-row">
                <span className="detail-label">Z:</span>
                <span className="detail-value">{selectedObject.rotation.z.toFixed(4)}</span>
              </div>
            </div>
            
            {parentObject && (
              <div className="detail-section">
                <h3>Relative to Parent ({parentObject.display_name})</h3>
                <div className="detail-row">
                  <span className="detail-label">X:</span>
                  <span className="detail-value">
                    {formatCoordinate(selectedObject.position.x - parentObject.position.x)}
                  </span>
                </div>
                <div className="detail-row">
                  <span className="detail-label">Y:</span>
                  <span className="detail-value">
                    {formatCoordinate(selectedObject.position.y - parentObject.position.y)}
                  </span>
                </div>
                <div className="detail-row">
                  <span className="detail-label">Z:</span>
                  <span className="detail-value">
                    {formatCoordinate(selectedObject.position.z - parentObject.position.z)}
                  </span>
                </div>
                <div className="detail-row">
                  <span className="detail-label">Distance:</span>
                  <span className="detail-value">
                    {formatCoordinate(calculateDistance(selectedObject, parentObject))}
                  </span>
                </div>
              </div>
            )}
          </div>
        )}
        
        {activeTab === 'relations' && (
          <div className="relations-tab">
            {parentObject && (
              <div className="detail-section">
                <h3>Parent Object</h3>
                <div 
                  className="related-object-item"
                  onClick={() => onSelectObject(parentObject.name)}
                >
                  <span className="object-icon">{getTypeIcon(parentObject)}</span>
                  <span className="object-name">{parentObject.display_name}</span>
                  <span className="object-type">{parentObject.type}</span>
                </div>
              </div>
            )}
            
            {childObjects.length > 0 && (
              <div className="detail-section">
                <h3>Child Objects ({childObjects.length})</h3>
                <div className="children-list">
                  {childObjects.map(child => (
                    <div 
                      key={child.name}
                      className="related-object-item"
                      onClick={() => onSelectObject(child.name)}
                    >
                      <span className="object-icon">{getTypeIcon(child)}</span>
                      <span className="object-name">{child.display_name}</span>
                      <span className="object-type">{child.type}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            
            {/* Siblings (other objects with same parent) */}
            {parentObject && (
              <div className="detail-section">
                <h3>Sibling Objects</h3>
                <div className="siblings-list">
                  {Object.values(objects)
                    .filter(obj => obj.parent === parentObject.name && obj.name !== selectedObject.name)
                    .map(sibling => (
                      <div 
                        key={sibling.name}
                        className="related-object-item"
                        onClick={() => onSelectObject(sibling.name)}
                      >
                        <span className="object-icon">{getTypeIcon(sibling)}</span>
                        <span className="object-name">{sibling.display_name}</span>
                        <span className="object-type">{sibling.type}</span>
                      </div>
                    ))
                  }
                </div>
              </div>
            )}
          </div>
        )}
        
        {activeTab === 'travel' && (
          <div className="travel-tab">
            <div className="detail-section">
              <h3>Quantum Travel Parameters</h3>
              <div className="detail-row">
                <span className="detail-label">Arrival Radius:</span>
                <span className="detail-value">{formatCoordinate(selectedObject.arrivalRadius)}</span>
              </div>
              <div className="detail-row">
                <span className="detail-label">Obstruction Radius:</span>
                <span className="detail-value">{formatCoordinate(selectedObject.obstructionRadius)}</span>
              </div>
            </div>
            
            <div className="detail-section">
              <h3>Nearby Objects</h3>
              <div className="nearby-objects-list">
                {Object.values(objects)
                  .filter(obj => obj.name !== selectedObject.name)
                  .sort((a, b) => 
                    calculateDistance(selectedObject, a) - calculateDistance(selectedObject, b)
                  )
                  .slice(0, 5)
                  .map(nearby => {
                    const distance = calculateDistance(selectedObject, nearby);
                    return (
                      <div 
                        key={nearby.name}
                        className="related-object-item"
                        onClick={() => onSelectObject(nearby.name)}
                      >
                        <span className="object-icon">{getTypeIcon(nearby)}</span>
                        <span className="object-name">{nearby.display_name}</span>
                        <span className="object-distance">{formatCoordinate(distance)}</span>
                      </div>
                    );
                  })
                }
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ObjectDetails; 