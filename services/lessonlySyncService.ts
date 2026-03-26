import { parseLessonlyId, getLessonlyStatuses } from './lessonlyService';
import { updateModuleProgress } from './moduleService';

interface SyncModule {
  id: string;
  type: string;
  link?: string;
  completed: boolean;
}

/**
 * Sync Lessonly completion status for a user's LESSONLY modules.
 * Compares API status with DB and corrects any mismatches:
 * - Completed in Lessonly but not in DB → mark complete
 * - Not completed in Lessonly but marked complete in DB → mark incomplete (regression)
 * Fire-and-forget — does not return status to the UI.
 */
export async function syncLessonlyStatus(
  userId: string,
  email: string,
  modules: SyncModule[]
): Promise<void> {
  const lessonlyModules = modules.filter(m => m.type === 'LESSONLY' && m.link);
  if (lessonlyModules.length === 0) return;

  const moduleToLessonId = new Map<string, number>();
  const lessonIds: number[] = [];

  for (const mod of lessonlyModules) {
    const lessonId = parseLessonlyId(mod.link!);
    if (lessonId) {
      moduleToLessonId.set(mod.id, lessonId);
      lessonIds.push(lessonId);
    }
  }

  if (lessonIds.length === 0) return;

  const response = await getLessonlyStatuses(email, lessonIds);
  if (!response.success) return;

  for (const mod of lessonlyModules) {
    const lessonId = moduleToLessonId.get(mod.id);
    if (!lessonId) continue;

    const lessonStatus = response.statuses[lessonId];
    if (!lessonStatus || lessonStatus.status === 'not_found') continue;

    const isCompletedInLessonly = lessonStatus.status === 'Completed';

    // Sync mismatches in either direction
    if (isCompletedInLessonly && !mod.completed) {
      updateModuleProgress(userId, mod.id, { completed: true });
    } else if (!isCompletedInLessonly && mod.completed) {
      updateModuleProgress(userId, mod.id, { completed: false });
    }
  }
}
