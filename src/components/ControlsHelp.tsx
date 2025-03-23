import React from 'react';
import './ControlsHelp.css';

interface ControlsHelpProps {
  isVisible: boolean;
  onClose: () => void;
  deviceType: 'desktop' | 'mobile' | 'tablet';
}

const ControlsHelp: React.FC<ControlsHelpProps> = ({ 
  isVisible, 
  onClose,
  deviceType
}) => {
  if (!isVisible) return null;
  
  const renderDesktopControls = () => (
    <>
      <h3>Mouse Controls</h3>
      <div className="controls-group">
        <div className="control-item">
          <div className="control-key">Left Mouse Button + Drag</div>
          <div className="control-description">Rotate camera</div>
        </div>
        <div className="control-item">
          <div className="control-key">Right Mouse Button + Drag</div>
          <div className="control-description">Pan camera</div>
        </div>
        <div className="control-item">
          <div className="control-key">Mouse Wheel</div>
          <div className="control-description">Zoom in/out</div>
        </div>
        <div className="control-item">
          <div className="control-key">Double Click</div>
          <div className="control-description">Focus on celestial object</div>
        </div>
      </div>
      
      <h3>Keyboard Controls</h3>
      <div className="controls-group">
        <div className="control-item">
          <div className="control-key">R</div>
          <div className="control-description">Reset camera to system view</div>
        </div>
        <div className="control-item">
          <div className="control-key">F</div>
          <div className="control-description">Focus on selected object</div>
        </div>
        <div className="control-item">
          <div className="control-key">Space</div>
          <div className="control-description">Toggle system browser</div>
        </div>
        <div className="control-item">
          <div className="control-key">M</div>
          <div className="control-description">Toggle mini-map</div>
        </div>
        <div className="control-item">
          <div className="control-key">B</div>
          <div className="control-description">Toggle browser panel</div>
        </div>
        <div className="control-item">
          <div className="control-key">H</div>
          <div className="control-description">Toggle this help screen</div>
        </div>
        <div className="control-item">
          <div className="control-key">Tab</div>
          <div className="control-description">Cycle through main celestial bodies</div>
        </div>
        <div className="control-item">
          <div className="control-key">Shift + Tab</div>
          <div className="control-description">Cycle in reverse order</div>
        </div>
        <div className="control-item">
          <div className="control-key">1-4</div>
          <div className="control-description">Quick select planets (1=Hurston, 2=Crusader, 3=ArcCorp, 4=microTech)</div>
        </div>
        <div className="control-item">
          <div className="control-key">O</div>
          <div className="control-description">Toggle orbital camera mode (when focused on planet/moon)</div>
        </div>
      </div>
    </>
  );
  
  const renderMobileControls = () => (
    <>
      <h3>Touch Controls</h3>
      <div className="controls-group">
        <div className="control-item">
          <div className="control-key">One Finger Drag</div>
          <div className="control-description">Rotate camera</div>
        </div>
        <div className="control-item">
          <div className="control-key">Two Finger Drag</div>
          <div className="control-description">Pan camera</div>
        </div>
        <div className="control-item">
          <div className="control-key">Pinch</div>
          <div className="control-description">Zoom in/out</div>
        </div>
        <div className="control-item">
          <div className="control-key">Double Tap</div>
          <div className="control-description">Focus on celestial object</div>
        </div>
      </div>
      
      <h3>On-Screen Controls</h3>
      <div className="controls-group">
        <div className="control-item">
          <div className="control-key">🔍</div>
          <div className="control-description">Toggle system browser</div>
        </div>
        <div className="control-item">
          <div className="control-key">🗺️</div>
          <div className="control-description">Toggle mini-map</div>
        </div>
        <div className="control-item">
          <div className="control-key">⚙️</div>
          <div className="control-description">Toggle controls panel</div>
        </div>
        <div className="control-item">
          <div className="control-key">🏠</div>
          <div className="control-description">Reset to system view</div>
        </div>
        <div className="control-item">
          <div className="control-key">?</div>
          <div className="control-description">Show/hide this help screen</div>
        </div>
      </div>
    </>
  );
  
  const renderTabletControls = () => (
    <>
      {/* Include both touch and simplified keyboard controls */}
      {renderMobileControls()}
      
      <h3>Additional Controls (with Keyboard)</h3>
      <div className="controls-group">
        <div className="control-item">
          <div className="control-key">R</div>
          <div className="control-description">Reset camera to system view</div>
        </div>
        <div className="control-item">
          <div className="control-key">F</div>
          <div className="control-description">Focus on selected object</div>
        </div>
        <div className="control-item">
          <div className="control-key">Tab</div>
          <div className="control-description">Cycle through main celestial bodies</div>
        </div>
        <div className="control-item">
          <div className="control-key">1-4</div>
          <div className="control-description">Quick select planets</div>
        </div>
      </div>
    </>
  );
  
  return (
    <div className="controls-help-overlay">
      <div className="controls-help-content">
        <button className="controls-help-close" onClick={onClose}>×</button>
        
        <h2>Stanton System Controls</h2>
        
        {deviceType === 'desktop' && renderDesktopControls()}
        {deviceType === 'mobile' && renderMobileControls()}
        {deviceType === 'tablet' && renderTabletControls()}
        
        <h3>Navigation Tips</h3>
        <ul className="navigation-tips">
          <li>Use the browser panel to find specific locations organized by hierarchy</li>
          <li>The mini-map shows your current location in the Stanton system</li>
          <li>When focused on a planet, you can see its moons and stations</li>
          <li>When focused on a moon, you can see its stations and landing zones</li>
          <li>Distance indicators show how far you are from selected objects</li>
          <li>The breadcrumb trail shows your current navigation path in the system</li>
        </ul>
        
        <div className="controls-help-footer">
          <button className="controls-help-button" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
};

export default ControlsHelp; 