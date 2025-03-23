import { useState, useEffect } from 'react';
import { SystemMap } from './components/SystemMap';
import './App.css';

// Define the SystemMap data structure for the flat JSON format
interface SystemMapObject {
  name: string;
  display_name: string;
  type: string;
  parent: string;
  position?: {
    x: number;
    y: number;
    z: number;
  };
  rotation: {
    w: number;
    x: number;
    y: number;
    z: number;
  };
  size: number;
  arrivalRadius: number;
  obstructionRadius: number;
  atmoHeight: number;
  system_entity_name: string;
  orbitalMarkers?: {
    om1: { x: number; y: number; z: number };
    om2: { x: number; y: number; z: number };
    om3: { x: number; y: number; z: number };
    om4: { x: number; y: number; z: number };
    om5: { x: number; y: number; z: number };
    om6: { x: number; y: number; z: number };
  };
}

interface SystemMapData {
  [key: string]: SystemMapObject;
}

function App() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [systemData, setSystemData] = useState<SystemMapData | null>(null);

  useEffect(() => {
    // Fetch the Stanton system data using fetch instead of import
    const fetchData = async () => {
      try {
        const response = await fetch('/stanton_extract.json');
        if (!response.ok) {
          throw new Error(`Failed to load system data: ${response.status} ${response.statusText}`);
        }
        const data = await response.json() as SystemMapData;
        
        // Log data load success
        console.log('Data loaded successfully:', Object.keys(data).length, 'objects');
        
        // Log objects with missing position data
        const missingPositions = Object.entries(data)
          .filter(([_, obj]) => !obj.position)
          .map(([key, obj]) => ({ key, name: obj.display_name, type: obj.type }));
          
        if (missingPositions.length > 0) {
          console.warn('Objects with missing position data:', missingPositions);
        }
        
        setSystemData(data);
        setLoading(false);
      } catch (err) {
        console.error('Error loading system data:', err);
        setError(err instanceof Error ? err.message : 'Failed to load system data');
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  if (loading) {
    return (
      <div className="loading-screen">
        <div className="loading-spinner"></div>
        <p>Loading Stanton System Data...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="error-screen">
        <h2>Error Loading System Data</h2>
        <p>{error}</p>
        <p>Please check that the data file is available and retry.</p>
        <button onClick={() => window.location.reload()}>Retry</button>
      </div>
    );
  }

  return (
    <div className="app">
      {systemData && <SystemMap systemData={systemData} />}
    </div>
  );
}

export default App; 