import { useState } from 'react';
import { auth } from '../services/firebase';

interface NavBarProps {
  onFilterChange?: (filter: string) => void;
}

const NavBar = ({ onFilterChange }: NavBarProps) => {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [activeFilter, setActiveFilter] = useState('all');

  const handleFilterChange = (filter: string) => {
    setActiveFilter(filter);
    if (onFilterChange) {
      onFilterChange(filter);
    }
  };

  return (
    <nav className="bg-sc-dark border-b border-sc-blue">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <span className="text-sc-blue font-bold text-xl">SCUMaps</span>
            </div>
            <div className="hidden md:block">
              <div className="ml-10 flex items-baseline space-x-4">
                <button
                  className={`px-3 py-2 rounded-md text-sm font-medium ${
                    activeFilter === 'all' ? 'bg-sc-blue text-white' : 'text-gray-300 hover:bg-gray-700 hover:text-white'
                  }`}
                  onClick={() => handleFilterChange('all')}
                >
                  All
                </button>
                
                <button
                  className={`px-3 py-2 rounded-md text-sm font-medium ${
                    activeFilter === 'planets' ? 'bg-sc-blue text-white' : 'text-gray-300 hover:bg-gray-700 hover:text-white'
                  }`}
                  onClick={() => handleFilterChange('planets')}
                >
                  Planets
                </button>
                
                <button
                  className={`px-3 py-2 rounded-md text-sm font-medium ${
                    activeFilter === 'moons' ? 'bg-sc-blue text-white' : 'text-gray-300 hover:bg-gray-700 hover:text-white'
                  }`}
                  onClick={() => handleFilterChange('moons')}
                >
                  Moons
                </button>
                
                <button
                  className={`px-3 py-2 rounded-md text-sm font-medium ${
                    activeFilter === 'stations' ? 'bg-sc-blue text-white' : 'text-gray-300 hover:bg-gray-700 hover:text-white'
                  }`}
                  onClick={() => handleFilterChange('stations')}
                >
                  Stations
                </button>
                
                <button
                  className={`px-3 py-2 rounded-md text-sm font-medium ${
                    activeFilter === 'jumppoints' ? 'bg-sc-blue text-white' : 'text-gray-300 hover:bg-gray-700 hover:text-white'
                  }`}
                  onClick={() => handleFilterChange('jumppoints')}
                >
                  Jump Points
                </button>
                
                <button
                  className={`px-3 py-2 rounded-md text-sm font-medium ${
                    activeFilter === 'lagrangepoints' ? 'bg-sc-blue text-white' : 'text-gray-300 hover:bg-gray-700 hover:text-white'
                  }`}
                  onClick={() => handleFilterChange('lagrangepoints')}
                >
                  Lagrange Points
                </button>
                
                <button
                  className={`px-3 py-2 rounded-md text-sm font-medium ${
                    activeFilter === 'commarrays' ? 'bg-sc-blue text-white' : 'text-gray-300 hover:bg-gray-700 hover:text-white'
                  }`}
                  onClick={() => handleFilterChange('commarrays')}
                >
                  Comm Arrays
                </button>
              </div>
            </div>
          </div>
          
          <div className="flex items-center">
            <span className="text-gray-300 text-sm mr-3">Stanton System</span>
            <button className="bg-sc-blue text-white px-4 py-2 rounded-md text-sm font-medium">
              Filter Options
            </button>
          </div>
        </div>
      </div>
      
      {/* Mobile menu, show/hide based on menu state */}
      <div className="md:hidden border-t border-gray-700">
        <div className="px-2 py-3 space-y-1 sm:px-3 flex flex-wrap">
          <button 
            className={`px-3 py-2 rounded-md text-sm font-medium ${
              activeFilter === 'all' ? 'bg-sc-blue text-white' : 'text-gray-300 hover:bg-gray-700 hover:text-white'
            } m-1`}
            onClick={() => handleFilterChange('all')}
          >
            All
          </button>
          <button 
            className={`px-3 py-2 rounded-md text-sm font-medium ${
              activeFilter === 'planets' ? 'bg-sc-blue text-white' : 'text-gray-300 hover:bg-gray-700 hover:text-white'
            } m-1`}
            onClick={() => handleFilterChange('planets')}
          >
            Planets
          </button>
          <button 
            className={`px-3 py-2 rounded-md text-sm font-medium ${
              activeFilter === 'moons' ? 'bg-sc-blue text-white' : 'text-gray-300 hover:bg-gray-700 hover:text-white'
            } m-1`}
            onClick={() => handleFilterChange('moons')}
          >
            Moons
          </button>
          <button 
            className={`px-3 py-2 rounded-md text-sm font-medium ${
              activeFilter === 'stations' ? 'bg-sc-blue text-white' : 'text-gray-300 hover:bg-gray-700 hover:text-white'
            } m-1`}
            onClick={() => handleFilterChange('stations')}
          >
            Stations
          </button>
          <button 
            className={`px-3 py-2 rounded-md text-sm font-medium ${
              activeFilter === 'commarrays' ? 'bg-sc-blue text-white' : 'text-gray-300 hover:bg-gray-700 hover:text-white'
            } m-1`}
            onClick={() => handleFilterChange('commarrays')}
          >
            Comm Arrays
          </button>
        </div>
      </div>
    </nav>
  );
};

export default NavBar; 