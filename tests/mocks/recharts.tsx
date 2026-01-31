import React from 'react';
import { vi } from 'vitest';

// Mock all Recharts components to avoid SVG rendering issues in jsdom
// These return simple divs with data-testid for testing purposes

export const ResponsiveContainer = ({ children }: { children: React.ReactNode }) => (
  <div data-testid="recharts-responsive-container">{children}</div>
);

export const PieChart = ({ children }: { children?: React.ReactNode }) => (
  <div data-testid="recharts-pie-chart">{children}</div>
);

export const Pie = () => <div data-testid="recharts-pie" />;

export const Cell = () => <div data-testid="recharts-cell" />;

export const Tooltip = () => <div data-testid="recharts-tooltip" />;

export const Legend = () => <div data-testid="recharts-legend" />;

export const BarChart = ({ children }: { children?: React.ReactNode }) => (
  <div data-testid="recharts-bar-chart">{children}</div>
);

export const Bar = () => <div data-testid="recharts-bar" />;

export const XAxis = () => <div data-testid="recharts-xaxis" />;

export const YAxis = () => <div data-testid="recharts-yaxis" />;

export const CartesianGrid = () => <div data-testid="recharts-cartesian-grid" />;

export const LineChart = ({ children }: { children?: React.ReactNode }) => (
  <div data-testid="recharts-line-chart">{children}</div>
);

export const Line = () => <div data-testid="recharts-line" />;

export const AreaChart = ({ children }: { children?: React.ReactNode }) => (
  <div data-testid="recharts-area-chart">{children}</div>
);

export const Area = () => <div data-testid="recharts-area" />;

export const RadialBarChart = ({ children }: { children?: React.ReactNode }) => (
  <div data-testid="recharts-radial-bar-chart">{children}</div>
);

export const RadialBar = () => <div data-testid="recharts-radial-bar" />;

export const Sector = () => <div data-testid="recharts-sector" />;

// Export mock setup function for use in tests
export const setupRechartsMock = () => {
  vi.mock('recharts', () => ({
    ResponsiveContainer,
    PieChart,
    Pie,
    Cell,
    Tooltip,
    Legend,
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    LineChart,
    Line,
    AreaChart,
    Area,
    RadialBarChart,
    RadialBar,
    Sector,
  }));
};

export default {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  LineChart,
  Line,
  AreaChart,
  Area,
  RadialBarChart,
  RadialBar,
  Sector,
};
