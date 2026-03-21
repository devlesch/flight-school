-- Step 1: Add location column to profiles
ALTER TABLE profiles ADD COLUMN location TEXT;

-- Step 2: Migrate existing region values (which are actually locations) into the new column
UPDATE profiles SET location = region, region = NULL WHERE region IS NOT NULL;

-- Step 3: Constrain region to valid values only
ALTER TABLE profiles ADD CONSTRAINT profiles_region_check
  CHECK (region IS NULL OR region IN ('East', 'Central', 'West'));
