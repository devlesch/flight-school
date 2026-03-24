import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

describe('AdminDashboard real data migration', () => {
  const dashboardSource = readFileSync(
    resolve(__dirname, '../../components/AdminDashboard.tsx'),
    'utf-8'
  );

  it('does not import NEW_HIRES from constants', () => {
    const importLines = dashboardSource
      .split('\n')
      .filter(line => line.includes('import') && line.includes('constants'));

    // No imports from constants should contain NEW_HIRES
    importLines.forEach(line => {
      expect(line).not.toContain('NEW_HIRES');
    });
  });

  it('does not import MANAGERS from constants', () => {
    const importLines = dashboardSource
      .split('\n')
      .filter(line => line.includes('import') && line.includes('constants'));

    importLines.forEach(line => {
      expect(line).not.toContain('MANAGERS');
    });
  });

  it('does not import MOCK_TRAINING_MODULES from constants', () => {
    const importLines = dashboardSource
      .split('\n')
      .filter(line => line.includes('import') && line.includes('constants'));

    importLines.forEach(line => {
      expect(line).not.toContain('MOCK_TRAINING_MODULES');
    });
  });

  it('does not import MANAGER_ONBOARDING_TASKS from constants', () => {
    const importLines = dashboardSource
      .split('\n')
      .filter(line => line.includes('import') && line.includes('constants'));

    importLines.forEach(line => {
      expect(line).not.toContain('MANAGER_ONBOARDING_TASKS');
    });
  });

  it('does not reference NEW_HIRES anywhere in the component body', () => {
    const bodyLines = dashboardSource
      .split('\n')
      .filter(line => !line.trimStart().startsWith('import ') && !line.includes('// Mock imports removed'));
    const body = bodyLines.join('\n');

    expect(body).not.toContain('NEW_HIRES');
  });

  it('does not reference MANAGERS as a standalone identifier in the component body', () => {
    const bodyLines = dashboardSource
      .split('\n')
      .filter(line => !line.trimStart().startsWith('import ') && !line.includes('// Mock imports removed'));
    const body = bodyLines.join('\n');

    // Should not contain MANAGERS as a standalone reference (not as part of selectedCohortManager etc.)
    expect(body).not.toMatch(/\bMANAGERS\b/);
  });

  it('imports useAdminDashboard hook', () => {
    expect(dashboardSource).toContain('useAdminDashboard');
  });

  it('uses students from useAdminDashboard for KPI data', () => {
    expect(dashboardSource).toContain('stats.activeCount');
    expect(dashboardSource).toContain('stats.avgProgress');
    expect(dashboardSource).toContain('stats.atRiskCount');
  });

  it('uses real students data for analyzeProgress', () => {
    expect(dashboardSource).toContain('analyzeProgress(students)');
    expect(dashboardSource).not.toContain('analyzeProgress(NEW_HIRES)');
  });
});
