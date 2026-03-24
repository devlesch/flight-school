import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

describe('NewHireDashboard real data migration', () => {
  const dashboardSource = readFileSync(
    resolve(__dirname, '../../components/NewHireDashboard.tsx'),
    'utf-8'
  );

  it('does not import NEW_HIRES from constants', () => {
    // Check that NEW_HIRES is not imported
    const importLine = dashboardSource
      .split('\n')
      .find(line => line.includes('import') && line.includes('constants'));

    expect(importLine).toBeDefined();
    expect(importLine).not.toContain('NEW_HIRES');
  });

  it('does not import MANAGERS from constants', () => {
    const importLine = dashboardSource
      .split('\n')
      .find(line => line.includes('import') && line.includes('constants'));

    expect(importLine).toBeDefined();
    expect(importLine).not.toContain('MANAGERS');
  });

  it('still imports UNIVERSAL_SERVICE_STEPS from constants', () => {
    const importLine = dashboardSource
      .split('\n')
      .find(line => line.includes('import') && line.includes('constants'));

    expect(importLine).toBeDefined();
    expect(importLine).toContain('UNIVERSAL_SERVICE_STEPS');
  });

  it('does not reference NEW_HIRES anywhere in the component', () => {
    // Remove import lines and check body
    const bodyLines = dashboardSource
      .split('\n')
      .filter(line => !line.trimStart().startsWith('import '));
    const body = bodyLines.join('\n');

    expect(body).not.toContain('NEW_HIRES');
  });

  it('does not reference MANAGERS anywhere in the component', () => {
    const bodyLines = dashboardSource
      .split('\n')
      .filter(line => !line.trimStart().startsWith('import '));
    const body = bodyLines.join('\n');

    expect(body).not.toContain('MANAGERS');
  });

  it('imports useLeadershipTeam hook', () => {
    expect(dashboardSource).toContain('useLeadershipTeam');
  });

  it('imports useProfileById hook', () => {
    expect(dashboardSource).toContain('useProfileById');
  });

  it('does not spread mockProfile into myProfile', () => {
    expect(dashboardSource).not.toContain('...mockProfile');
  });
});
