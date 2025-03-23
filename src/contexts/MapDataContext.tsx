import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { StantonSystemMap } from '../models/celestialObjects';
import mapDataService from '../services/mapDataService';

interface MapDataContextType {
  mapData: StantonSystemMap | null;
  loading: boolean;
  error: Error | null;
  refreshData: () => Promise<void>;
}

// Create context with default values
const MapDataContext = createContext<MapDataContextType>({
  mapData: null,
  loading: false,
  error: null,
  refreshData: async () => {},
});

interface MapDataProviderProps {
  children: ReactNode;
}

export const MapDataProvider: React.FC<MapDataProviderProps> = ({ children }) => {
  const [mapData, setMapData] = useState<StantonSystemMap | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<Error | null>(null);
  const [retryCount, setRetryCount] = useState(0);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      console.log(`Attempting to load map data (attempt ${retryCount + 1})...`);
      const data = await mapDataService.loadStantonData();
      
      // Validate data to ensure it has at least some valid items
      const entries = Object.entries(data);
      if (entries.length === 0) {
        throw new Error('Map data appears to be empty. No objects were loaded.');
      }
      
      console.log(`Successfully loaded ${entries.length} map objects`);
      setMapData(data);
    } catch (err) {
      const errorMessage = err instanceof Error 
        ? err.message 
        : 'Failed to load map data';
      
      console.error('Error loading map data:', err);
      setError(new Error(`${errorMessage} (Attempt ${retryCount + 1})`));
      
      // Auto-retry up to 3 times
      if (retryCount < 3) {
        console.log(`Retrying data load (${retryCount + 1}/3)...`);
        setRetryCount(prev => prev + 1);
        // Schedule a retry after a delay
        setTimeout(() => loadData(), 1500);
      }
    } finally {
      setLoading(false);
    }
  };

  // Load data on component mount or when retry count changes
  useEffect(() => {
    if (retryCount === 0 || (error && retryCount < 3)) {
      loadData();
    }
  }, [retryCount]);

  // Reset retry count when manually refreshing
  const handleRefresh = async () => {
    setRetryCount(0);
    await loadData();
  };

  return (
    <MapDataContext.Provider
      value={{
        mapData,
        loading,
        error,
        refreshData: handleRefresh,
      }}
    >
      {children}
    </MapDataContext.Provider>
  );
};

// Custom hook for using the map data context
export const useMapData = () => useContext(MapDataContext);

export default MapDataContext; 