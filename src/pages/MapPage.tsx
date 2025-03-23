import { useState, useEffect } from 'react';
import NavBar from '../components/NavBar';
import StantonMap from '../components/StantonMap';
import AlertPanel from '../components/AlertPanel';
import { useMapData } from '../contexts/MapDataContext';
import { BaseCelestialObject } from '../models/celestialObjects';
import { RouteAlert } from '../models/celestialObjects';
import { ErrorBoundary } from 'react-error-boundary';

// Error fallback component
const ErrorFallback = ({ error, resetErrorBoundary }: { error: Error, resetErrorBoundary: () => void }) => (
  <div className="flex items-center justify-center h-full bg-sc-dark text-white">
    <div className="text-center text-red-500 p-6 bg-gray-800 rounded-lg max-w-md">
      <h2 className="text-2xl mb-2">Something went wrong rendering the map</h2>
      <p className="mb-4">{error.message}</p>
      <button 
        className="px-4 py-2 bg-sc-blue text-white rounded"
        onClick={resetErrorBoundary}
      >
        Try again
      </button>
    </div>
  </div>
);

const MapPage = () => {
  const { mapData, loading, error, refreshData } = useMapData();
  const [selectedObject, setSelectedObject] = useState<BaseCelestialObject | null>(null);
  const [activeFilter, setActiveFilter] = useState('all');
  const [alerts, setAlerts] = useState<RouteAlert[]>([]);
  const [isMapError, setIsMapError] = useState(false);

  // Reset selected object when map data changes
  useEffect(() => {
    setSelectedObject(null);
  }, [mapData]);

  // Handle loading state
  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-sc-dark text-white">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-sc-blue mx-auto"></div>
          <p className="mt-4 text-xl">Loading Stanton System Data...</p>
        </div>
      </div>
    );
  }

  // Handle data loading error
  if (error) {
    return (
      <div className="flex items-center justify-center h-screen bg-sc-dark text-white">
        <div className="text-center text-red-500">
          <h2 className="text-2xl mb-2">Error Loading Map Data</h2>
          <p>{error.message}</p>
          <button 
            className="mt-4 px-4 py-2 bg-sc-blue text-white rounded"
            onClick={() => refreshData()}
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  const handleObjectSelect = (objectName: string) => {
    if (!mapData) return;
    const object = mapData[objectName] || null;
    setSelectedObject(object);
  };

  const handleCreateAlert = (alertData: Partial<RouteAlert>) => {
    // Create a new alert with required fields
    const newAlert: RouteAlert = {
      id: `alert-${Date.now()}`,
      userId: 'demo-user',
      objectId: selectedObject?.name || '',
      title: alertData.title || 'Untitled Alert',
      description: alertData.description || '',
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 4 * 60 * 60 * 1000), // 4 hours from now
      severity: alertData.severity || 'medium',
      serverId: '1',
      region: 'stanton',
      confirmations: 0,
      disputes: 0,
      isPublic: true
    };
    
    setAlerts([...alerts, newAlert]);
  };

  return (
    <div className="flex flex-col h-screen bg-sc-dark">
      <NavBar onFilterChange={setActiveFilter} />
      
      <div className="flex flex-1 overflow-hidden">
        <div className="flex-1 relative">
          {mapData && (
            <ErrorBoundary 
              FallbackComponent={ErrorFallback}
              onReset={() => setActiveFilter('all')}
              resetKeys={[activeFilter]}
            >
              <StantonMap 
                mapData={mapData}
                activeFilter={activeFilter}
                onSelectObject={handleObjectSelect}
              />
            </ErrorBoundary>
          )}
        </div>
        
        <div className="w-80 p-3 overflow-y-auto scrollbar-sc border-l border-sc-blue">
          <AlertPanel 
            selectedObject={selectedObject}
            alerts={alerts.filter(a => !selectedObject || a.objectId === selectedObject.name)}
            onCreateAlert={handleCreateAlert}
          />
        </div>
      </div>
    </div>
  );
};

export default MapPage; 