import { vi } from 'vitest';
import type { ExtractedHireData } from '../../services/geminiService';

// Mock responses for predictable testing
export const mockEmailDraft = `Hi there,

Great progress on your onboarding! You're doing well.

Let me know if you need any support.

Best,
Manager`;

export const mockOverdueEmailDraft = `Hi there,

I noticed you have some overdue training items. Let's schedule time to discuss how I can help you catch up.

Please share your availability for this week.

Best,
Manager`;

export const mockManagerNotification = `Hi Manager,

I wanted to flag that one of your direct reports needs additional support with their onboarding training.

Could you check in with them during your next 1:1?

Thanks,
Admin`;

export const mockProgressAnalysis = `## Onboarding Analysis

- **At Risk**: 1 employee below 20% completion
- **On Track**: 2 employees progressing well
- **Action**: Schedule check-in with at-risk employee this week`;

export const mockExtractedHireData: ExtractedHireData[] = [
  {
    workerName: 'Test Worker',
    managerName: 'Test Manager',
    hireDate: '2026-01-15',
    managerEmail: 'manager@industriousoffice.com',
    workerEmail: 'worker@industriousoffice.com',
    businessTitle: 'Member Experience Manager'
  }
];

// Mock implementations
export const generateEmailDraft = vi.fn().mockImplementation(
  async (
    _newHireName: string,
    _managerName: string,
    _progress: number,
    _topic: string,
    overdueItems: string[] = []
  ): Promise<string> => {
    return overdueItems.length > 0 ? mockOverdueEmailDraft : mockEmailDraft;
  }
);

export const generateManagerNotification = vi.fn().mockResolvedValue(mockManagerNotification);

export const analyzeProgress = vi.fn().mockResolvedValue(mockProgressAnalysis);

export const extractNewHireData = vi.fn().mockResolvedValue(mockExtractedHireData);

// Helper to reset all mocks
export const resetAllMocks = () => {
  generateEmailDraft.mockClear();
  generateManagerNotification.mockClear();
  analyzeProgress.mockClear();
  extractNewHireData.mockClear();
};

// Default export for vi.mock auto-mocking
export default {
  generateEmailDraft,
  generateManagerNotification,
  analyzeProgress,
  extractNewHireData
};
