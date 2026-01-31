// Re-export test data from constants.ts for use in tests
export {
  CURRENT_USER_ADMIN,
  MANAGERS,
  NEW_HIRES,
  MOCK_TRAINING_MODULES,
  MXM_ONBOARDING_MODULES,
  MXM_OKRS,
  GM_OKRS,
  UNIVERSAL_SERVICE_STEPS,
  MANAGER_ONBOARDING_TASKS
} from '../../constants';

export { UserRole } from '../../types';
export type {
  User,
  NewHireProfile,
  TrainingModule,
  Objective,
  ManagerTask,
  Shoutout,
  ModuleComment,
  CalendarEvent,
  Presenter
} from '../../types';

// Additional test-specific fixtures

// A simple admin user for basic tests
export const testAdmin = {
  id: 'test-admin-1',
  name: 'Test Admin',
  role: 'Admin' as const,
  avatar: 'https://example.com/avatar.jpg',
  title: 'Test Operations Manager',
  email: 'test.admin@industriousoffice.com'
};

// A simple manager user for basic tests
export const testManager = {
  id: 'test-mgr-1',
  name: 'Test Manager',
  role: 'Manager' as const,
  avatar: 'https://example.com/avatar.jpg',
  title: 'Test Regional Director',
  email: 'test.manager@industriousoffice.com',
  region: 'Test Region'
};

// A simple new hire for basic tests
export const testNewHire = {
  id: 'test-nh-1',
  name: 'Test New Hire',
  role: 'New Hire' as const,
  avatar: 'https://example.com/avatar.jpg',
  title: 'Test Member Experience Manager',
  email: 'test.newhire@industriousoffice.com',
  managerId: 'test-mgr-1',
  startDate: '2026-01-15',
  progress: 50,
  department: 'Test Department',
  modules: [],
  okrs: []
};

// New hire with complete data for comprehensive tests
export const testNewHireWithModules = {
  ...testNewHire,
  id: 'test-nh-2',
  name: 'Test New Hire With Modules',
  modules: [
    {
      id: 'test-mod-1',
      title: 'Test Module 1',
      description: 'A test training module',
      type: 'WORKBOOK' as const,
      duration: '1 hour',
      completed: true,
      dueDate: '2026-01-10',
      score: 95
    },
    {
      id: 'test-mod-2',
      title: 'Test Module 2',
      description: 'Another test training module',
      type: 'VIDEO' as const,
      duration: '30 mins',
      completed: false,
      dueDate: '2026-01-20'
    }
  ],
  okrs: [
    {
      title: 'Test Objective',
      keyResults: [
        { description: 'Key Result 1', target: '100%' },
        { description: 'Key Result 2', target: '90%' }
      ]
    }
  ]
};

// Empty state fixtures for edge case testing
export const emptyNewHire = {
  ...testNewHire,
  id: 'test-nh-empty',
  modules: [],
  okrs: [],
  progress: 0
};
