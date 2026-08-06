# Intelligent Log Analyzer - Frontend

Professional React-based cybersecurity dashboard for real-time log analysis and threat intelligence.

## Features

- **Real-time Overview Dashboard** - Live metrics, attack timeline, top attackers
- **Live Feed** - Streaming log events with pause/resume controls
- **Threat Hunting** - Advanced log filtering and investigation
- **IP Intelligence** - Deep threat analysis with AbuseIPDB, OTX, and geolocation
- **Incident Management** - Track and manage security incidents
- **AI Analyst** - Automated threat reports using OpenAI
- **Attack Map** - Global visualization of attacks on world map
- **Settings** - Configure API integrations and dashboard preferences

## Tech Stack

- **React 18** - UI framework
- **Vite** - Build tool
- **TailwindCSS** - Styling
- **TanStack Query** - Data fetching and caching
- **React Router** - Navigation
- **Recharts** - Data visualization
- **Leaflet** - Interactive maps
- **Framer Motion** - Animations
- **Lucide React** - Icons

## Setup

### Prerequisites

- Node.js 18+ and npm
- Backend API running on http://localhost:8000

### Installation

```bash
# Install dependencies
npm install

# Start development server
npm run dev
```

The frontend will be available at http://localhost:5173

### Build for Production

```bash
npm run build
npm run preview
```

## Configuration

The frontend connects to the FastAPI backend at `http://localhost:8000/api/v1` by default.

To change this, edit `src/lib/constants.js`:

```javascript
export const API_BASE_URL = 'http://your-api-url/api/v1'
```

## Design System

### Colors

- **Background Primary**: `#050d1a` - Deepest navy
- **Background Secondary**: `#0a1628` - Card backgrounds
- **Background Tertiary**: `#0f1e35` - Hover states
- **Accent Cyan**: `#00d4ff` - Primary actions
- **Accent Green**: `#00ff88` - Success
- **Accent Amber**: `#ffb800` - Warnings
- **Accent Red**: `#ff3366` - Critical
- **Accent Purple**: `#8b5cf6` - AI features

### Typography

- All IP addresses, hashes, timestamps: `JetBrains Mono` (monospace)
- UI text and labels: `Inter` (sans-serif)
- Minimum text size: 12px

## Project Structure

```
src/
├── components/
│   ├── charts/           # Recharts visualizations
│   ├── features/         # Feature-specific components
│   ├── layout/           # Sidebar, PageWrapper
│   └── shared/           # Reusable UI components
├── lib/
│   ├── api.js            # API client
│   ├── constants.js      # Design tokens
│   ├── utils.js          # Utility functions
│   └── queryKeys.js      # React Query keys
├── pages/                # Route pages
│   ├── Overview.jsx
│   ├── LiveFeed.jsx
│   ├── ThreatHunting.jsx
│   ├── IPIntelligence.jsx
│   ├── Incidents.jsx
│   ├── AIAnalyst.jsx
│   ├── AttackMap.jsx
│   ├── Reports.jsx
│   └── Settings.jsx
├── App.jsx               # Main app component
├── main.jsx              # Entry point
└── index.css             # Global styles
```

## Development

### Running with Backend

Start both services:

```bash
# Terminal 1 - Backend
cd backend
uvicorn main:app --reload --port 8000

# Terminal 2 - Frontend
cd frontend
npm run dev
```

### Code Style

- Use functional components with hooks
- Keep components under 300 lines
- Extract reusable logic into custom hooks
- Use TanStack Query for all API calls
- Follow the established design system

## Performance

- TanStack Query caches API responses for 30 seconds
- Live feed refreshes every 5 seconds
- Overview dashboard refreshes every 30 seconds
- Virtual scrolling for large log tables
- Optimized bundle size with Vite

## Browser Support

- Chrome/Edge 90+
- Firefox 88+
- Safari 14+

## License

Private project - All rights reserved
