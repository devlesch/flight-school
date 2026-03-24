import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

describe('Cohort page real stats migration', () => {
  const dashboardSource = readFileSync(
    resolve(__dirname, '../../components/AdminDashboard.tsx'),
    'utf-8'
  );

  it('does not contain the hardcoded hash formula', () => {
    expect(dashboardSource).not.toContain('role.length * 7');
    expect(dashboardSource).not.toContain('region.length * 13');
    expect(dashboardSource).not.toContain('55 + hash');
  });

  it('uses cohortSlotStats for real data lookups', () => {
    expect(dashboardSource).toContain('cohortSlotStats');
  });

  it('computes cohortSlotStats from students and cohorts', () => {
    expect(dashboardSource).toContain('cohortSlotStats.get(');
  });

  it('uses isHireBehind for at-risk computation in cohort stats', () => {
    // The useMemo should use isHireBehind to compute atRisk
    const startIdx = dashboardSource.indexOf('cohortSlotStats = useMemo');
    const cohortStatsBlock = dashboardSource.slice(startIdx, startIdx + 1500);
    expect(cohortStatsBlock).toContain('isHireBehind');
  });
});
