-- Track: module-audience_20260330
-- Add audience column to training_modules for cohort vs direct report targeting
ALTER TABLE training_modules ADD COLUMN audience TEXT;
-- Values: 'cohort', 'direct', or NULL (all students)
