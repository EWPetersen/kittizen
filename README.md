# SCUMaps - Star Citizen Stanton Map

A Progressive Web Application for visualizing the Star Citizen's Stanton system in 3D with user-created alert functionality.

## Features

- 3D visualization of the Stanton system using Three.js and React Three Fiber
- Interactive celestial bodies with information display
- User-created alerts for locations in the system
- Filter system objects by type (stars, planets, moons, stations, points of interest)
- Progressive Web App capabilities for offline access
- Firebase integration for authentication and data storage

## Technologies Used

- React with TypeScript
- Three.js with React Three Fiber for 3D rendering
- Tailwind CSS for styling
- Firebase for backend services
- Vite for fast development and building
- SWC for speedy TypeScript compilation

## Installation

1. Clone the repository:
```bash
git clone https://github.com/yourusername/scumaps.git
cd scumaps
```

2. Install dependencies:
```bash
npm install
```

3. Create a Firebase project and add your Firebase configuration to `.env` file:
```
VITE_FIREBASE_API_KEY=your_api_key
VITE_FIREBASE_AUTH_DOMAIN=your_auth_domain
VITE_FIREBASE_PROJECT_ID=your_project_id
VITE_FIREBASE_STORAGE_BUCKET=your_storage_bucket
VITE_FIREBASE_MESSAGING_SENDER_ID=your_messaging_sender_id
VITE_FIREBASE_APP_ID=your_app_id
VITE_FIREBASE_MEASUREMENT_ID=your_measurement_id
```

4. Run the development server:
```bash
npm run dev
```

## Building for Production

To create a production build:

```bash
npm run build
```

The built files will be in the `dist` directory.

## Usage

- Navigate the 3D map using mouse controls:
  - Left click + drag to rotate
  - Right click + drag to pan
  - Scroll to zoom
- Click on celestial bodies to select them and view details
- Use the filter buttons in the navbar to show specific types of objects
- Create alerts for specific locations that can be public or private

## License

ISC
