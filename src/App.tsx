import { Suspense, lazy } from 'react'
import './App.css'
import { MapDataProvider } from './contexts/MapDataContext'

// Lazy load the MapPage component for better performance
const MapPage = lazy(() => import('./pages/MapPage'));

function App() {
  return (
    <MapDataProvider>
      <div className="app-container h-screen">
        <Suspense fallback={<div className="loading">Loading...</div>}>
          <MapPage />
        </Suspense>
      </div>
    </MapDataProvider>
  )
}

export default App
