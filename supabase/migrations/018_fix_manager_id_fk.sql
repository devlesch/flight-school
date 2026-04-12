-- Fix: Allow deleting profiles that are referenced as manager_id
-- Change from NO ACTION (blocks) to SET NULL (clears reference)
ALTER TABLE profiles DROP CONSTRAINT profiles_manager_id_fkey;
ALTER TABLE profiles ADD CONSTRAINT profiles_manager_id_fkey
  FOREIGN KEY (manager_id) REFERENCES profiles(id) ON DELETE SET NULL;
