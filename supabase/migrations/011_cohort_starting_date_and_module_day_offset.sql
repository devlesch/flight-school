-- Cohort training start date (when day-offset counting begins)
ALTER TABLE cohorts ADD COLUMN starting_date DATE;

-- Day offset for training modules (days after cohort starting_date)
ALTER TABLE training_modules ADD COLUMN day_offset INTEGER NOT NULL DEFAULT 0;
