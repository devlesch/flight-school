# Tech Stack: Industrious Flight School

## Overview

Industrious Flight School is a modern single-page application (SPA) built with React and TypeScript, using Vite as the build tool for fast development and optimized production builds.

## Core Technologies

### Language
| Technology | Version | Purpose |
|------------|---------|---------|
| **TypeScript** | ~5.8.2 | Primary language for type-safe development |

### Frontend Framework
| Technology | Version | Purpose |
|------------|---------|---------|
| **React** | 18.2.0 | UI component library and state management |
| **React DOM** | 18.2.0 | React renderer for web |

### Build & Development
| Technology | Version | Purpose |
|------------|---------|---------|
| **Vite** | ^6.2.0 | Build tool and dev server |
| **@vitejs/plugin-react** | ^5.0.0 | React support for Vite |

## UI & Styling

| Technology | Version | Purpose |
|------------|---------|---------|
| **Tailwind CSS** | (inline) | Utility-first CSS framework |
| **Lucide React** | ^0.561.0 | Icon library |
| **Recharts** | ^2.12.0 | Charting and data visualization |
| **Canvas Confetti** | 1.9.2 | Celebration animations |

## AI Integration

| Technology | Version | Purpose |
|------------|---------|---------|
| **@google/genai** | ^1.33.0 | Google Gemini API for AI-powered features |

## Architecture

### Project Structure
```
/
├── App.tsx                 # Main application component with routing
├── index.tsx              # Entry point
├── index.html             # HTML template
├── types.ts               # TypeScript type definitions
├── constants.ts           # Mock data and constants
├── components/
│   ├── AdminDashboard.tsx    # Admin role dashboard
│   ├── ManagerDashboard.tsx  # Manager role dashboard
│   ├── NewHireDashboard.tsx  # New hire role dashboard
│   └── Login.tsx             # Authentication component
├── services/
│   └── geminiService.ts      # Gemini AI integration
├── package.json
├── tsconfig.json
└── vite.config.ts
```

### Design Patterns
- **Component-based architecture** — UI broken into reusable React components
- **Role-based rendering** — Different dashboard views based on user role
- **Lifted state** — App-level state management for authentication and view switching
- **Type-safe development** — Full TypeScript coverage with defined interfaces

## Development

### Scripts
| Command | Purpose |
|---------|---------|
| `npm run dev` | Start development server |
| `npm run build` | Build for production |
| `npm run preview` | Preview production build |
| `npm test` | Run Vitest tests |
| `npm run test:coverage` | Run tests with coverage report |

## Testing

| Technology | Version | Purpose |
|------------|---------|---------|
| **Vitest** | ^3.2.4 | Test runner (native Vite integration) |
| **@vitest/coverage-v8** | ^3.2.4 | Coverage reporting |
| **@testing-library/react** | ^16.2.0 | React component testing utilities |
| **@testing-library/jest-dom** | ^6.6.3 | DOM matchers |
| **@testing-library/user-event** | ^14.6.1 | User interaction simulation |
| **jsdom** | ^26.0.0 | DOM environment for tests |

### Environment
- Requires `GEMINI_API_KEY` in `.env.local` for AI features
- Node.js required for development
