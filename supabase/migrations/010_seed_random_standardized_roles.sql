-- Randomly assign a standardized role to all existing profiles that don't have one
UPDATE profiles
SET standardized_role = (ARRAY['MxA', 'MxM', 'AGM', 'GM', 'RD'])[floor(random() * 5 + 1)::int]
WHERE standardized_role IS NULL;
