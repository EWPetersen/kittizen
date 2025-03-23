import { useState } from 'react';
import { RouteAlert, BaseCelestialObject } from '../models/celestialObjects';

interface AlertPanelProps {
  selectedObject: BaseCelestialObject | null;
  alerts: RouteAlert[];
  onCreateAlert?: (alert: Partial<RouteAlert>) => void;
}

const AlertPanel = ({ selectedObject, alerts, onCreateAlert }: AlertPanelProps) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [severity, setSeverity] = useState<RouteAlert['severity']>('medium');
  const [isPublic, setIsPublic] = useState(true);
  const [isCreating, setIsCreating] = useState(false);

  const resetForm = () => {
    setTitle('');
    setDescription('');
    setSeverity('medium');
    setIsPublic(true);
    setIsCreating(false);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedObject || !title || !description) return;

    if (onCreateAlert) {
      onCreateAlert({
        title,
        description,
        severity,
        isPublic
      });
      resetForm();
    }
  };

  // Format date to readable string
  const formatDate = (date: Date) => {
    return new Date(date).toLocaleString();
  };

  // Calculate time remaining for an alert (in hours)
  const getTimeRemaining = (expiresAt: Date) => {
    const now = new Date();
    const expiry = new Date(expiresAt);
    const diff = expiry.getTime() - now.getTime();
    
    if (diff <= 0) return 'Expired';
    
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    
    if (hours > 0) {
      return `${hours}h ${minutes}m remaining`;
    }
    return `${minutes}m remaining`;
  };

  return (
    <div className="h-full flex flex-col">
      <div className="mb-4">
        <h2 className="text-xl font-bold text-white mb-2">
          {selectedObject ? selectedObject.display_name : 'Select an object'}
        </h2>
        {selectedObject && (
          <div className="text-gray-300 text-sm mb-2">
            <p>Type: {selectedObject.type}</p>
            <p>Size: {selectedObject.size.toLocaleString()} meters</p>
            {selectedObject.atmoHeight > 0 && (
              <p>Atmosphere Height: {selectedObject.atmoHeight.toLocaleString()} meters</p>
            )}
          </div>
        )}
      </div>
      
      {selectedObject && (
        <div className="mb-4">
          <div className="flex justify-between items-center mb-2">
            <h3 className="text-lg font-semibold text-white">Alerts</h3>
            {!isCreating && (
              <button
                onClick={() => setIsCreating(true)}
                className="px-2 py-1 bg-sc-blue text-white text-sm rounded"
              >
                Create Alert
              </button>
            )}
          </div>
          
          {isCreating ? (
            <form onSubmit={handleSubmit} className="bg-gray-800 p-3 rounded mb-4">
              <div className="mb-3">
                <label className="block text-gray-300 text-sm mb-1">Title</label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full bg-gray-700 text-white p-2 rounded"
                  required
                />
              </div>
              
              <div className="mb-3">
                <label className="block text-gray-300 text-sm mb-1">Description</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full bg-gray-700 text-white p-2 rounded"
                  rows={3}
                  required
                />
              </div>
              
              <div className="mb-3">
                <label className="block text-gray-300 text-sm mb-1">Severity</label>
                <select
                  value={severity}
                  onChange={(e) => setSeverity(e.target.value as RouteAlert['severity'])}
                  className="w-full bg-gray-700 text-white p-2 rounded"
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                </select>
              </div>
              
              <div className="mb-3 flex items-center">
                <input
                  type="checkbox"
                  id="isPublic"
                  checked={isPublic}
                  onChange={(e) => setIsPublic(e.target.checked)}
                  className="mr-2"
                />
                <label htmlFor="isPublic" className="text-gray-300 text-sm">Make public</label>
              </div>
              
              <div className="flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setIsCreating(false)}
                  className="px-3 py-1 bg-gray-600 text-white rounded"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-3 py-1 bg-sc-blue text-white rounded"
                >
                  Submit
                </button>
              </div>
            </form>
          ) : (
            <>
              {alerts.length === 0 ? (
                <p className="text-gray-400 text-center py-4">No alerts for this location</p>
              ) : (
                <ul className="space-y-3 overflow-y-auto max-h-96">
                  {alerts.map((alert) => (
                    <li key={alert.id} className="bg-gray-800 p-3 rounded">
                      <div className="flex justify-between items-start">
                        <h4 className="font-medium text-white">{alert.title}</h4>
                        <span className={`px-2 py-0.5 rounded-full text-xs ${
                          alert.severity === 'high' ? 'bg-red-600' :
                          alert.severity === 'medium' ? 'bg-yellow-600' : 'bg-green-600'
                        }`}>
                          {alert.severity}
                        </span>
                      </div>
                      <p className="text-gray-300 text-sm mt-1">{alert.description}</p>
                      <div className="mt-2 text-xs text-gray-400 flex justify-between">
                        <span>Created: {formatDate(alert.createdAt)}</span>
                        {alert.expiresAt && (
                          <span>{getTimeRemaining(alert.expiresAt)}</span>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
};

export default AlertPanel; 