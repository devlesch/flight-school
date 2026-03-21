-- Randomly assign a region to all existing profiles that don't have one
UPDATE profiles
SET region = (ARRAY['East', 'Central', 'West'])[floor(random() * 3 + 1)::int]
WHERE region IS NULL;
