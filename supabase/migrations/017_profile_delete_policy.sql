-- Fix: Allow admins to delete profiles (RLS was silently blocking deletes)
CREATE POLICY "Admins can delete profiles"
  ON profiles FOR DELETE
  USING (get_user_role() = 'Admin');
