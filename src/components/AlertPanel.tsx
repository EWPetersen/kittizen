import { useState } from 'react';
import { RouteAlert } from '../models/celestialObjects';

interface AlertPanelProps {
  objectId: string;
}

const AlertPanel = ({ objectId }: AlertPanelProps) => {
  const [alerts, setAlerts] = useState<RouteAlert[]>([]);
  const [showAlertForm, setShowAlertForm] = useState(false);
  const [newAlert, setNewAlert] = useState({
    title: '',
    description: '',
    severity: 'medium'
  });

  // Toggle alert form
  const toggleAlertForm = () => {
    setShowAlertForm(!showAlertForm);
  };

  // Handle input changes in the form
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setNewAlert({
      ...newAlert,
      [name]: value
    });
  };

  // Submit new alert
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // In a real app, this would save to a database
    // For demo purposes, we're just adding it to local state
    const mockAlert: RouteAlert = {
      id: `alert-${Date.now()}`,
      userId: 'demo-user',
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 4 * 60 * 60 * 1000), // 4 hours from now
      objectId,
      title: newAlert.title,
      description: newAlert.description,
      severity: newAlert.severity as 'low' | 'medium' | 'high',
      serverId: 'demo-server',
      region: 'NA',
      confirmations: 0,
      disputes: 0,
      isPublic: true
    };
    
    setAlerts([...alerts, mockAlert]);
    setNewAlert({ title: '', description: '', severity: 'medium' });
    setShowAlertForm(false);
  };

  return (
    <div className="mt-6 pt-6 border-t border-gray-800">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold">Alerts</h3>
        <button 
          className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded text-sm"
          onClick={toggleAlertForm}
        >
          {showAlertForm ? 'Cancel' : 'Add Alert'}
        </button>
      </div>
      
      {/* Alert form */}
      {showAlertForm && (
        <form onSubmit={handleSubmit} className="mb-4 bg-gray-800 p-3 rounded-md">
          <div className="mb-3">
            <label className="block text-sm font-medium mb-1">Title</label>
            <input
              type="text"
              name="title"
              value={newAlert.title}
              onChange={handleInputChange}
              className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
              required
            />
          </div>
          
          <div className="mb-3">
            <label className="block text-sm font-medium mb-1">Description</label>
            <textarea
              name="description"
              value={newAlert.description}
              onChange={handleInputChange}
              className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
              rows={3}
              required
            />
          </div>
          
          <div className="mb-3">
            <label className="block text-sm font-medium mb-1">Severity</label>
            <select
              name="severity"
              value={newAlert.severity}
              onChange={handleInputChange}
              className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
            >
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
            </select>
          </div>
          
          <button 
            type="submit" 
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded text-sm"
          >
            Submit Alert
          </button>
        </form>
      )}
      
      {/* Alert list */}
      <div className="space-y-3">
        {alerts.length > 0 ? (
          alerts.map(alert => (
            <div 
              key={alert.id} 
              className={`p-3 rounded-md ${
                alert.severity === 'high' ? 'bg-red-900 bg-opacity-40 border border-red-700' :
                alert.severity === 'medium' ? 'bg-yellow-900 bg-opacity-40 border border-yellow-700' :
                'bg-blue-900 bg-opacity-40 border border-blue-700'
              }`}
            >
              <div className="flex justify-between items-start">
                <h4 className="font-medium">{alert.title}</h4>
                <span className={`text-xs px-2 py-1 rounded ${
                  alert.severity === 'high' ? 'bg-red-700' :
                  alert.severity === 'medium' ? 'bg-yellow-700' :
                  'bg-blue-700'
                }`}>
                  {alert.severity}
                </span>
              </div>
              <p className="text-sm mt-1 text-gray-300">{alert.description}</p>
              <div className="flex justify-between text-xs text-gray-400 mt-2">
                <span>Expires in {Math.round((alert.expiresAt.getTime() - Date.now()) / (60 * 60 * 1000))} hours</span>
                <div>
                  <span className="mr-2">👍 {alert.confirmations}</span>
                  <span>👎 {alert.disputes}</span>
                </div>
              </div>
            </div>
          ))
        ) : (
          <p className="text-gray-500 text-sm italic">No alerts for this location</p>
        )}
      </div>
    </div>
  );
};

export default AlertPanel; 