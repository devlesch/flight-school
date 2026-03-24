import '@testing-library/jest-dom';
import { cleanup } from '@testing-library/react';
import { afterEach, vi } from 'vitest';
import React from 'react';

// Mock Supabase client to avoid env var requirement in tests
vi.mock('../lib/supabase', () => ({
  supabase: {
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: null }),
      getSession: vi.fn().mockResolvedValue({ data: { session: null }, error: null }),
      onAuthStateChange: vi.fn().mockReturnValue({ data: { subscription: { unsubscribe: vi.fn() } } }),
      signInWithOAuth: vi.fn(),
      signOut: vi.fn(),
    },
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: null, error: null }),
          order: vi.fn().mockResolvedValue({ data: [], error: null }),
        }),
        order: vi.fn().mockResolvedValue({ data: [], error: null }),
        in: vi.fn().mockResolvedValue({ data: [], error: null }),
      }),
      insert: vi.fn().mockResolvedValue({ data: null, error: null }),
      update: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: null, error: null }),
          }),
        }),
      }),
      upsert: vi.fn().mockResolvedValue({ data: null, error: null }),
    }),
  },
}));

// Cleanup after each test to prevent memory leaks
afterEach(() => {
  cleanup();
});

// Mock Recharts to avoid SVG rendering issues in jsdom
vi.mock('recharts', () => ({
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) =>
    React.createElement('div', { 'data-testid': 'recharts-responsive-container' }, children),
  PieChart: ({ children }: { children?: React.ReactNode }) =>
    React.createElement('div', { 'data-testid': 'recharts-pie-chart' }, children),
  Pie: () => React.createElement('div', { 'data-testid': 'recharts-pie' }),
  Cell: () => React.createElement('div', { 'data-testid': 'recharts-cell' }),
  Tooltip: () => React.createElement('div', { 'data-testid': 'recharts-tooltip' }),
  Legend: () => React.createElement('div', { 'data-testid': 'recharts-legend' }),
  BarChart: ({ children }: { children?: React.ReactNode }) =>
    React.createElement('div', { 'data-testid': 'recharts-bar-chart' }, children),
  Bar: () => React.createElement('div', { 'data-testid': 'recharts-bar' }),
  XAxis: () => React.createElement('div', { 'data-testid': 'recharts-xaxis' }),
  YAxis: () => React.createElement('div', { 'data-testid': 'recharts-yaxis' }),
  CartesianGrid: () => React.createElement('div', { 'data-testid': 'recharts-cartesian-grid' }),
  LineChart: ({ children }: { children?: React.ReactNode }) =>
    React.createElement('div', { 'data-testid': 'recharts-line-chart' }, children),
  Line: () => React.createElement('div', { 'data-testid': 'recharts-line' }),
  AreaChart: ({ children }: { children?: React.ReactNode }) =>
    React.createElement('div', { 'data-testid': 'recharts-area-chart' }, children),
  Area: () => React.createElement('div', { 'data-testid': 'recharts-area' }),
  RadialBarChart: ({ children }: { children?: React.ReactNode }) =>
    React.createElement('div', { 'data-testid': 'recharts-radial-bar-chart' }, children),
  RadialBar: () => React.createElement('div', { 'data-testid': 'recharts-radial-bar' }),
  Sector: () => React.createElement('div', { 'data-testid': 'recharts-sector' }),
}));

// Mock canvas-confetti (used for celebrations)
vi.mock('canvas-confetti', () => ({
  default: vi.fn(),
}));

// Mock the Gemini service to avoid API calls in tests
vi.mock('../services/geminiService', () => ({
  generateEmailDraft: vi.fn().mockResolvedValue('Mocked email draft'),
  generateManagerNotification: vi.fn().mockResolvedValue('Mocked notification'),
  analyzeProgress: vi.fn().mockResolvedValue('Mocked analysis'),
  extractNewHireData: vi.fn().mockResolvedValue([]),
}));

// Mock window.matchMedia for responsive components
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

// Mock ResizeObserver (used by some chart components)
global.ResizeObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}));

// Mock window.scrollTo (used by some components)
Object.defineProperty(window, 'scrollTo', {
  writable: true,
  value: vi.fn(),
});

// Suppress console errors during tests (optional - can be removed for debugging)
// vi.spyOn(console, 'error').mockImplementation(() => {});
