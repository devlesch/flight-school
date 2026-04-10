-- Track: delete-tasks_20260410
-- Soft delete for training modules — preserves user progress and comments
ALTER TABLE training_modules ADD COLUMN deleted_at TIMESTAMPTZ;
