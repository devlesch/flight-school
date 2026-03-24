import { describe, it, expect } from 'vitest';
import { mapToNewHireProfiles, computeAdminStats } from '../../services/adminStatsMapper';
import type { Profile, UserModule, TrainingModule as DbTrainingModule } from '../../types/database';

// --- Test Fixtures ---

const makeProfile = (overrides: Partial<Profile> = {}): Profile => ({
  id: 'user-1',
  email: 'alice@industriousoffice.com',
  name: 'Alice New',
  role: 'New Hire',
  avatar: 'https://example.com/alice.jpg',
  title: 'Member Experience Manager',
  region: 'East',
  location: 'Brooklyn',
  standardized_role: 'MxA',
  manager_id: 'mgr-1',
  department: 'Operations',
  start_date: '2026-01-15',
  provisioned: true,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
  ...overrides,
});

const makeUserModule = (overrides: Partial<UserModule> = {}): UserModule => ({
  id: 'um-1',
  user_id: 'user-1',
  module_id: 'mod-1',
  completed: false,
  completed_at: null,
  due_date: '2026-02-01',
  score: null,
  liked: false,
  created_at: '2026-01-15T00:00:00Z',
  ...overrides,
});

const makeDbModule = (overrides: Partial<DbTrainingModule> = {}): DbTrainingModule => ({
  id: 'mod-1',
  title: 'Culture Workbook',
  description: 'Industrious culture overview',
  type: 'WORKBOOK',
  duration: '1 hour',
  link: null,
  host: null,
  sort_order: 1,
  target_role: null,
  day_offset: 0,
  created_at: '2026-01-01T00:00:00Z',
  ...overrides,
});

// --- mapToNewHireProfiles Tests ---

describe('mapToNewHireProfiles', () => {
  it('maps Profile + UserModule[] to NewHireProfile with correct field names', () => {
    const profiles = [makeProfile()];
    const userModules = [makeUserModule({ completed: true })];
    const dbModules = [makeDbModule()];

    const result = mapToNewHireProfiles(profiles, userModules, dbModules);

    expect(result).toHaveLength(1);
    const hire = result[0];
    expect(hire.id).toBe('user-1');
    expect(hire.name).toBe('Alice New');
    expect(hire.email).toBe('alice@industriousoffice.com');
    expect(hire.managerId).toBe('mgr-1');
    expect(hire.startDate).toBe('2026-01-15');
    expect(hire.department).toBe('Operations');
    expect(hire.avatar).toBe('https://example.com/alice.jpg');
    expect(hire.title).toBe('Member Experience Manager');
  });

  it('computes progress as average module completion % per student', () => {
    const profiles = [makeProfile()];
    const userModules = [
      makeUserModule({ id: 'um-1', module_id: 'mod-1', completed: true }),
      makeUserModule({ id: 'um-2', module_id: 'mod-2', completed: false }),
    ];
    const dbModules = [
      makeDbModule({ id: 'mod-1' }),
      makeDbModule({ id: 'mod-2', title: 'Operations Systems' }),
    ];

    const result = mapToNewHireProfiles(profiles, userModules, dbModules);
    expect(result[0].progress).toBe(50); // 1/2 completed
  });

  it('handles student with zero modules → progress = 0%', () => {
    const profiles = [makeProfile()];
    const userModules: UserModule[] = [];
    const dbModules: DbTrainingModule[] = [];

    const result = mapToNewHireProfiles(profiles, userModules, dbModules);
    expect(result[0].progress).toBe(0);
    expect(result[0].modules).toEqual([]);
  });

  it('handles null/undefined fields gracefully (no avatar, no department)', () => {
    const profiles = [makeProfile({
      avatar: null,
      department: null,
      title: null,
      manager_id: null,
      start_date: null,
    })];
    const userModules: UserModule[] = [];
    const dbModules: DbTrainingModule[] = [];

    const result = mapToNewHireProfiles(profiles, userModules, dbModules);
    const hire = result[0];
    expect(hire.avatar).toBe('');
    expect(hire.department).toBe('');
    expect(hire.title).toBe('');
    expect(hire.managerId).toBe('');
    expect(hire.startDate).toBe('');
  });

  it('groups modules by user_id correctly across multiple students', () => {
    const profiles = [
      makeProfile({ id: 'user-1', name: 'Alice' }),
      makeProfile({ id: 'user-2', name: 'Bob', email: 'bob@industriousoffice.com' }),
    ];
    const userModules = [
      makeUserModule({ id: 'um-1', user_id: 'user-1', module_id: 'mod-1', completed: true }),
      makeUserModule({ id: 'um-2', user_id: 'user-1', module_id: 'mod-2', completed: true }),
      makeUserModule({ id: 'um-3', user_id: 'user-2', module_id: 'mod-1', completed: false }),
    ];
    const dbModules = [
      makeDbModule({ id: 'mod-1' }),
      makeDbModule({ id: 'mod-2', title: 'Operations Systems' }),
    ];

    const result = mapToNewHireProfiles(profiles, userModules, dbModules);
    expect(result).toHaveLength(2);

    const alice = result.find(h => h.name === 'Alice')!;
    const bob = result.find(h => h.name === 'Bob')!;

    expect(alice.modules).toHaveLength(2);
    expect(alice.progress).toBe(100);
    expect(bob.modules).toHaveLength(1);
    expect(bob.progress).toBe(0);
  });

  it('maps module due_date for overdue detection', () => {
    const profiles = [makeProfile()];
    const userModules = [makeUserModule({ due_date: '2026-01-20' })];
    const dbModules = [makeDbModule()];

    const result = mapToNewHireProfiles(profiles, userModules, dbModules);
    expect(result[0].modules[0].dueDate).toBe('2026-01-20');
  });

  it('sets managerTasks to empty array', () => {
    const profiles = [makeProfile()];
    const userModules = [makeUserModule()];
    const dbModules = [makeDbModule()];

    const result = mapToNewHireProfiles(profiles, userModules, dbModules);
    expect(result[0].managerTasks).toEqual([]);
  });

  it('maps module metadata from training_modules (title, type, duration)', () => {
    const profiles = [makeProfile()];
    const userModules = [makeUserModule({ score: 85 })];
    const dbModules = [makeDbModule({ title: 'Culture Workbook', type: 'WORKBOOK', duration: '1 hour' })];

    const result = mapToNewHireProfiles(profiles, userModules, dbModules);
    const mod = result[0].modules[0];
    expect(mod.title).toBe('Culture Workbook');
    expect(mod.type).toBe('WORKBOOK');
    expect(mod.duration).toBe('1 hour');
    expect(mod.score).toBe(85);
  });

  it('skips user_modules with no matching training_module', () => {
    const profiles = [makeProfile()];
    const userModules = [makeUserModule({ module_id: 'nonexistent-mod' })];
    const dbModules = [makeDbModule({ id: 'mod-1' })];

    const result = mapToNewHireProfiles(profiles, userModules, dbModules);
    expect(result[0].modules).toHaveLength(0);
    expect(result[0].progress).toBe(0);
  });
});

// --- computeAdminStats Tests ---

describe('computeAdminStats', () => {
  it('computes activeCount as total student count', () => {
    const students = [
      { progress: 50, modules: [] },
      { progress: 75, modules: [] },
    ] as Parameters<typeof computeAdminStats>[0];

    const stats = computeAdminStats(students);
    expect(stats.activeCount).toBe(2);
  });

  it('computes avgProgress as mean of all student progress values', () => {
    const students = [
      { progress: 40, modules: [] },
      { progress: 60, modules: [] },
    ] as Parameters<typeof computeAdminStats>[0];

    const stats = computeAdminStats(students);
    expect(stats.avgProgress).toBe(50);
  });

  it('computes atRiskCount using isHireBehind logic (progress < 25%)', () => {
    const students = [
      { progress: 10, modules: [] },  // at risk: progress < 25
      { progress: 50, modules: [] },  // fine
      { progress: 20, modules: [] },  // at risk: progress < 25
    ] as Parameters<typeof computeAdminStats>[0];

    const stats = computeAdminStats(students);
    expect(stats.atRiskCount).toBe(2);
  });

  it('computes atRiskCount for overdue modules', () => {
    const pastDate = '2020-01-01';
    const futureDate = '2099-12-31';

    const students = [
      {
        progress: 80,
        modules: [
          { completed: false, dueDate: pastDate },  // overdue
        ],
      },
      {
        progress: 80,
        modules: [
          { completed: true, dueDate: pastDate },   // completed, not overdue
        ],
      },
      {
        progress: 80,
        modules: [
          { completed: false, dueDate: futureDate }, // not yet due
        ],
      },
    ] as Parameters<typeof computeAdminStats>[0];

    const stats = computeAdminStats(students);
    expect(stats.atRiskCount).toBe(1); // only the first student has overdue module
  });

  it('handles empty array → { activeCount: 0, avgProgress: 0, atRiskCount: 0 }', () => {
    const stats = computeAdminStats([]);
    expect(stats).toEqual({ activeCount: 0, avgProgress: 0, atRiskCount: 0 });
  });

  it('rounds avgProgress to nearest integer', () => {
    const students = [
      { progress: 33, modules: [] },
      { progress: 33, modules: [] },
      { progress: 34, modules: [] },
    ] as Parameters<typeof computeAdminStats>[0];

    const stats = computeAdminStats(students);
    expect(stats.avgProgress).toBe(33); // (33+33+34)/3 = 33.33 → 33
  });
});
