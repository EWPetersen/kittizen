import { useState, useEffect } from 'react';
import NavBar from '../components/NavBar';
import StantonMap from '../components/StantonMap';
import AlertPanel from '../components/AlertPanel';
import { Alert, CelestialObject } from '../models/types';
import { getCelestialObjectById } from '../services/stantonService';
import { auth, db } from '../services/firebase';
import { collection, addDoc, query, where, getDocs, Timestamp } from 'firebase/firestore';

const MapPage = () => {
  const [selectedObject, setSelectedObject] = useState<CelestialObject | undefined>(undefined);
  const [activeFilter, setActiveFilter] = useState('all');
  const [alerts, setAlerts] = useState<Alert[]>([]);

  useEffect(() => {
    // In a real app, this would fetch alerts from Firebase
    // For demo purposes, we'll just create some sample alerts
    const sampleAlerts: Alert[] = [
      {
        id: '1',
        userId: 'demo-user',
        objectId: 'stanton1', // Hurston
        title: 'Trading Opportunity',
        description: 'High demand for medical supplies at Lorville.',
        createdAt: new Date(),
        severity: 'medium',
        isPublic: true
      },
      {
        id: '2',
        userId: 'demo-user',
        objectId: 'stanton2', // Crusader
        title: 'Pirate Activity',
        description: 'Multiple pirate ships spotted near Port Olisar.',
        createdAt: new Date(),
        severity: 'high',
        isPublic: true
      }
    ];
    
    setAlerts(sampleAlerts);
  }, []);

  const handleObjectSelect = (objectId: string) => {
    const object = getCelestialObjectById(objectId);
    setSelectedObject(object);
  };

  const handleCreateAlert = async (alertData: Omit<Alert, 'id' | 'createdAt'>) => {
    // In a real app, this would add the alert to Firebase
    const newAlert: Alert = {
      ...alertData,
      id: `${Date.now()}`, // Generate a unique ID
      createdAt: new Date()
    };
    
    setAlerts([...alerts, newAlert]);
    
    // This would be the actual Firebase implementation:
    /*
    try {
      const alertsRef = collection(db, 'alerts');
      await addDoc(alertsRef, {
        ...alertData,
        createdAt: Timestamp.now(),
        expiresAt: alertData.expiresAt ? Timestamp.fromDate(alertData.expiresAt) : null
      });
    } catch (error) {
      console.error('Error creating alert:', error);
    }
    */
  };

  return (
    <div className="flex flex-col h-screen bg-sc-dark">
      <NavBar onFilterChange={setActiveFilter} />
      
      <div className="flex flex-1 overflow-hidden">
        <div className="flex-1 relative">
          <StantonMap 
            activeFilter={activeFilter}
            onSelectObject={handleObjectSelect}
          />
        </div>
        
        <div className="w-80 p-3 overflow-y-auto scrollbar-sc border-l border-sc-blue">
          <AlertPanel 
            selectedObject={selectedObject}
            alerts={alerts}
            onCreateAlert={handleCreateAlert}
          />
        </div>
      </div>
    </div>
  );
};

export default MapPage; 