import type { Profile, UserModule, TrainingModule as DbTrainingModule } from '../types/database';
import type { NewHireProfile, TrainingModule } from '../types';
import { UserRole } from '../types';

/**
 * Maps Supabase Profile + UserModule + TrainingModule data into
 * the app-level NewHireProfile[] shape used by AdminDashboard KPIs
 * and the Gemini analyzeProgress() function.
 */
export function mapToNewHireProfiles(
  profiles: Profile[],
  userModules: UserModule[],
  dbModules: DbTrainingModule[],
): NewHireProfile[] {
  // Lookup map: module_id → training module definition
  const moduleMap = new Map(dbModules.map(m => [m.id, m]));

  // Group user_modules by user_id
  const userModuleMap = new Map<string, UserModule[]>();
  for (const um of userModules) {
    const existing = userModuleMap.get(um.user_id) || [];
    existing.push(um);
    userModuleMap.set(um.user_id, existing);
  }

  return profiles.map(profile => {
    const profileModules = userModuleMap.get(profile.id) || [];

    // Join user_modules with training_modules to build app TrainingModule[]
    const modules: TrainingModule[] = profileModules
      .filter(um => moduleMap.has(um.module_id))
      .map(um => {
        const dbMod = moduleMap.get(um.module_id)!;
        return {
          id: dbMod.id,
          title: dbMod.title,
          description: dbMod.description || '',
          type: dbMod.type,
          duration: dbMod.duration || '',
          completed: um.completed,
          dueDate: um.due_date || '',
          link: dbMod.link || undefined,
          score: um.score ?? undefined,
          host: dbMod.host || undefined,
          liked: um.liked,
        };
      });

    // Progress = % of completed modules (0 if no modules)
    const completedCount = modules.filter(m => m.completed).length;
    const progress = modules.length > 0
      ? Math.round((completedCount / modules.length) * 100)
      : 0;

    return {
      id: profile.id,
      name: profile.name,
      email: profile.email,
      role: profile.role as UserRole,
      avatar: profile.avatar || '',
      title: profile.title || '',
      region: profile.region || undefined,
      managerId: profile.manager_id || '',
      startDate: profile.start_date || '',
      progress,
      department: profile.department || '',
      modules,
      managerTasks: [],
    };
  });
}

/**
 * Computes admin dashboard KPI stats from mapped NewHireProfile[].
 * Mirrors the isHireBehind() logic from AdminDashboard.tsx.
 */
export function computeAdminStats(students: NewHireProfile[]): {
  activeCount: number;
  avgProgress: number;
  atRiskCount: number;
} {
  if (students.length === 0) {
    return { activeCount: 0, avgProgress: 0, atRiskCount: 0 };
  }

  const activeCount = students.length;

  const totalProgress = students.reduce((sum, s) => sum + s.progress, 0);
  const avgProgress = Math.round(totalProgress / students.length);

  const atRiskCount = students.filter(isHireBehind).length;

  return { activeCount, avgProgress, atRiskCount };
}

/**
 * Determines if a hire is "behind schedule" — mirrors the existing
 * isHireBehind() logic from AdminDashboard.tsx line 247.
 */
export function isHireBehind(hire: NewHireProfile): boolean {
  if (hire.progress < 25) return true;
  return hire.modules.some(
    m => !m.completed && new Date(m.dueDate) < new Date()
  );
}
