ALTER TABLE profiles ADD COLUMN standardized_role TEXT;
ALTER TABLE profiles ADD CONSTRAINT profiles_standardized_role_check
  CHECK (standardized_role IS NULL OR standardized_role IN ('MxA', 'MxM', 'AGM', 'GM', 'RD'));
