# Star Citizen Universe Map

An interactive 3D map for exploring the Stanton system from Star Citizen.

## Features

- Interactive 3D visualization of the Stanton system
- Advanced camera controls with smooth navigation
- Hierarchical browser for celestial objects
- Detailed information panels for planets, moons, stations, and more
- Minimap for navigation assistance
- Responsive design with support for desktop, tablet, and mobile devices
- Surface visualization with atmosphere effects
- Focus mode for detailed exploration of specific objects

## Getting Started

### Prerequisites

- Node.js 14.x or higher
- npm 6.x or higher

### Installation

1. Clone the repository
   ```
   git clone https://github.com/yourusername/star-citizen-universe-map.git
   cd star-citizen-universe-map
   ```

2. Install dependencies
   ```
   npm install
   ```

3. Add required texture assets
   - Download space cubemap textures and place them in the `public/textures/space_cubemap/` directory
   - Ensure the following files are present:
     - px.jpg, nx.jpg (positive/negative X axis)
     - py.jpg, ny.jpg (positive/negative Y axis)
     - pz.jpg, nz.jpg (positive/negative Z axis)

4. Start the development server
   ```
   npm run dev
   ```

## Project Structure

```
src/
  ├── components/           # React components
  │   ├── CameraSystem.tsx  # Advanced camera control system
  │   ├── ControlsHelp.tsx  # Help overlay for controls
  │   ├── MiniMap.tsx       # Navigation minimap
  │   ├── StantonMapControls.tsx # Main controls component
  │   ├── SystemBrowser.tsx # Hierarchical system browser
  │   ├── SystemMap.tsx     # Main map component
  │   └── renderers/        # Specialized renderers
  │       ├── CelestialBodyRenderer.tsx # Renderer for stars, planets, moons
  │       └── NavigationPointRenderer.tsx # Renderer for stations, jump points, etc.
  ├── models/               # TypeScript interfaces and data models
  │   └── celestialObjects.ts # Object type definitions
  ├── styles/               # Global styles
  └── utils/                # Utility functions
public/
  └── textures/             # Texture assets
      └── space_cubemap/    # Space environment cubemap textures
```

## Controls

### Desktop Controls
- Left Mouse Button + Drag: Rotate camera
- Right Mouse Button + Drag: Pan camera
- Mouse Wheel: Zoom in/out
- Middle Mouse Button: Reset view
- Double-click on object: Focus on object
- Shift + Mouse Wheel: Faster zoom
- Ctrl + Mouse Wheel: Slower, more precise zoom

### Mobile Controls
- One finger drag: Rotate camera
- Two finger drag: Pan camera
- Pinch: Zoom in/out
- Double-tap: Focus on object
- Three finger tap: Reset view

### Keyboard Controls
- Arrow Keys: Rotate camera
- WASD: Pan camera
- Q/E: Zoom in/out
- R: Reset view
- F: Focus on selected object
- Space: Toggle focus mode
- H or ?: Toggle help overlay

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Acknowledgments

- Star Citizen and all related content is property of Cloud Imperium Games
- This is a fan project and is not affiliated with Cloud Imperium Games
