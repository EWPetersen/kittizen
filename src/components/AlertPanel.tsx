import { useState } from 'react';
import { Alert, CelestialObject } from '../models/types';

interface AlertPanelProps {
  selectedObject?: CelestialObject;
  alerts: Alert[];
  onCreateAlert?: (alert: Omit<Alert, 'id' | 'createdAt'>) => void;
}

const AlertPanel = ({ selectedObject, alerts, onCreateAlert }: AlertPanelProps) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [severity, setSeverity] = useState<Alert['severity']>('medium');
  const [isPublic, setIsPublic] = useState(true);
  const [expiresIn, setExpiresIn] = useState('24');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedObject || !title || !description) return;

    const expiresAt = expiresIn ? new Date(Date.now() + parseInt(expiresIn) * 60 * 60 * 1000) : undefined;

    if (onCreateAlert) {
      onCreateAlert({
        userId: 'current-user', // In a real app, this would be from auth
        objectId: selectedObject.id,
        title,
        description,
        severity,
        isPublic,
        expiresAt
      });
    }

    // Reset form
    setTitle('');
    setDescription('');
    setSeverity('medium');
    setIsPublic(true);
    setExpiresIn('24');
  };

  const filteredAlerts = selectedObject 
    ? alerts.filter(alert => alert.objectId === selectedObject.id)
    : alerts;

  return (
    <div className="bg-sc-dark text-sc-light p-4 rounded-lg shadow-lg w-full max-w-md">
      <h2 className="text-xl font-bold mb-4 text-sc-blue">Alerts</h2>
      
      {selectedObject && (
        <div className="mb-4">
          <h3 className="text-lg font-semibold">{selectedObject.name}</h3>
          <p className="text-sm opacity-75">{selectedObject.description}</p>
        </div>
      )}

      <div className="max-h-60 overflow-y-auto scrollbar-sc mb-4">
        {filteredAlerts.length > 0 ? (
          <ul className="space-y-2">
            {filteredAlerts.map(alert => (
              <li 
                key={alert.id} 
                className={`p-3 rounded-md ${
                  alert.severity === 'high' 
                    ? 'bg-red-900/30 border-l-4 border-red-600' 
                    : alert.severity === 'medium'
                      ? 'bg-yellow-900/30 border-l-4 border-yellow-600'
                      : 'bg-blue-900/30 border-l-4 border-blue-600'
                }`}
              >
                <h4 className="font-medium">{alert.title}</h4>
                <p className="text-sm">{alert.description}</p>
                <div className="text-xs mt-1 flex justify-between">
                  <span>
                    {new Date(alert.createdAt).toLocaleString()}
                  </span>
                  {alert.expiresAt && (
                    <span>
                      Expires: {new Date(alert.expiresAt).toLocaleString()}
                    </span>
                  )}
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-center text-gray-400 italic py-4">No alerts for this location</p>
        )}
      </div>

      {selectedObject && (
        <form onSubmit={handleSubmit} className="space-y-3">
          <h3 className="text-lg font-semibold border-b border-sc-blue pb-1">Create Alert</h3>
          
          <div>
            <label htmlFor="title" className="block text-sm font-medium mb-1">Title</label>
            <input
              type="text"
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 rounded-md px-3 py-2 text-sm"
              required
            />
          </div>
          
          <div>
            <label htmlFor="description" className="block text-sm font-medium mb-1">Description</label>
            <textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 rounded-md px-3 py-2 text-sm h-20"
              required
            />
          </div>
          
          <div className="flex space-x-4">
            <div className="flex-1">
              <label htmlFor="severity" className="block text-sm font-medium mb-1">Severity</label>
              <select
                id="severity"
                value={severity}
                onChange={(e) => setSeverity(e.target.value as Alert['severity'])}
                className="w-full bg-gray-800 border border-gray-700 rounded-md px-3 py-2 text-sm"
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>
            </div>
            
            <div className="flex-1">
              <label htmlFor="expiresIn" className="block text-sm font-medium mb-1">Expires In (hours)</label>
              <input
                type="number"
                id="expiresIn"
                value={expiresIn}
                onChange={(e) => setExpiresIn(e.target.value)}
                className="w-full bg-gray-800 border border-gray-700 rounded-md px-3 py-2 text-sm"
                min="1"
                step="1"
              />
            </div>
          </div>
          
          <div className="flex items-center">
            <input
              type="checkbox"
              id="isPublic"
              checked={isPublic}
              onChange={(e) => setIsPublic(e.target.checked)}
              className="mr-2 h-4 w-4"
            />
            <label htmlFor="isPublic" className="text-sm">Make alert public</label>
          </div>
          
          <button
            type="submit"
            className="w-full bg-sc-blue text-white font-medium py-2 px-4 rounded-md hover:bg-blue-700 transition-colors"
          >
            Create Alert
          </button>
        </form>
      )}
    </div>
  );
};

export default AlertPanel; 