import { useState } from 'react';

interface NavBarProps {
  activeFilter: string;
  showLabels: boolean;
  showGrid: boolean;
  actualScale: boolean;
  onFilterChange: (filter: string) => void;
  onToggleLabels: () => void;
  onToggleGrid: () => void;
  onToggleScale: () => void;
}

const NavBar = ({ 
  activeFilter, 
  showLabels, 
  showGrid, 
  actualScale,
  onFilterChange, 
  onToggleLabels, 
  onToggleGrid, 
  onToggleScale 
}: NavBarProps) => {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isOptionsOpen, setIsOptionsOpen] = useState(false);

  const toggleDropdown = () => setIsDropdownOpen(!isDropdownOpen);
  const toggleOptions = () => setIsOptionsOpen(!isOptionsOpen);

  const filters = [
    { id: 'all', label: 'All Objects' },
    { id: 'planets', label: 'Planets' },
    { id: 'moons', label: 'Moons' },
    { id: 'stations', label: 'Stations' },
    { id: 'jumppoints', label: 'Jump Points' },
    { id: 'lagrangepoints', label: 'Lagrange Points' },
    { id: 'landingzones', label: 'Landing Zones' },
    { id: 'commarrays', label: 'Comm Arrays' },
  ];

  const handleFilterSelect = (filterId: string) => {
    onFilterChange(filterId);
    setIsDropdownOpen(false);
  };

  // Get current filter label
  const currentFilter = filters.find(f => f.id === activeFilter)?.label || 'All Objects';

  return (
    <nav className="bg-gray-900 text-white p-4 shadow-md">
      <div className="container mx-auto flex justify-between items-center">
        <div className="flex items-center space-x-4">
          {/* Logo/Title */}
          <h1 className="text-xl font-bold">Stanton System Map</h1>
          
          {/* Filter Dropdown */}
          <div className="relative">
            <button 
              className="bg-gray-800 hover:bg-gray-700 px-4 py-2 rounded-md flex items-center"
              onClick={toggleDropdown}
            >
              <span className="mr-2">{currentFilter}</span>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            
            {isDropdownOpen && (
              <div className="absolute z-10 mt-2 w-48 bg-gray-800 rounded-md shadow-lg py-1">
                {filters.map(filter => (
                  <button
                    key={filter.id}
                    className={`block w-full text-left px-4 py-2 hover:bg-gray-700 ${
                      activeFilter === filter.id ? 'bg-blue-600' : ''
                    }`}
                    onClick={() => handleFilterSelect(filter.id)}
                  >
                    {filter.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
        
        {/* Visualization Options */}
        <div className="relative">
          <button 
            className="bg-gray-800 hover:bg-gray-700 px-4 py-2 rounded-md flex items-center"
            onClick={toggleOptions}
          >
            <span className="mr-2">Visualization Options</span>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          
          {isOptionsOpen && (
            <div className="absolute right-0 z-10 mt-2 w-60 bg-gray-800 rounded-md shadow-lg py-1">
              <div className="p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <span>Show Labels</span>
                  <button 
                    className={`w-12 h-6 rounded-full p-1 transition-colors duration-300 ease-in-out ${
                      showLabels ? 'bg-blue-600' : 'bg-gray-600'
                    }`}
                    onClick={onToggleLabels}
                  >
                    <div className={`w-4 h-4 rounded-full bg-white transform transition-transform duration-300 ease-in-out ${
                      showLabels ? 'translate-x-6' : 'translate-x-0'
                    }`}></div>
                  </button>
                </div>
                
                <div className="flex items-center justify-between">
                  <span>Show Grid</span>
                  <button 
                    className={`w-12 h-6 rounded-full p-1 transition-colors duration-300 ease-in-out ${
                      showGrid ? 'bg-blue-600' : 'bg-gray-600'
                    }`}
                    onClick={onToggleGrid}
                  >
                    <div className={`w-4 h-4 rounded-full bg-white transform transition-transform duration-300 ease-in-out ${
                      showGrid ? 'translate-x-6' : 'translate-x-0'
                    }`}></div>
                  </button>
                </div>
                
                <div className="flex items-center justify-between">
                  <span>Actual Scale</span>
                  <button 
                    className={`w-12 h-6 rounded-full p-1 transition-colors duration-300 ease-in-out ${
                      actualScale ? 'bg-blue-600' : 'bg-gray-600'
                    }`}
                    onClick={onToggleScale}
                  >
                    <div className={`w-4 h-4 rounded-full bg-white transform transition-transform duration-300 ease-in-out ${
                      actualScale ? 'translate-x-6' : 'translate-x-0'
                    }`}></div>
                  </button>
                </div>
                
                <div className="pt-2 text-xs text-gray-400 border-t border-gray-700">
                  <p>Tip: Actual scale shows true size relationships, but smaller objects may not be visible.</p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </nav>
  );
};

export default NavBar; 