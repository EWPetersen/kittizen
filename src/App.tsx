import { Suspense, lazy } from 'react'
import './App.css'

// Lazy load the MapPage component for better performance
const MapPage = lazy(() => import('./pages/MapPage'));

function App() {
  return (
    <div className="app-container h-screen">
      <Suspense fallback={<div className="loading">Loading...</div>}>
        <MapPage />
      </Suspense>
    </div>
  )
}

export default App
