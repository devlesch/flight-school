-- ============================================
-- Flight School: Restrict to @industriousoffice.com domain
-- ============================================
-- Run this in Supabase SQL Editor
-- ============================================

-- Drop the existing trigger and function
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user();

-- Recreate with domain restriction
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  -- Check if email is from allowed domain
  IF NEW.email NOT LIKE '%@industriousoffice.com' THEN
    RAISE EXCEPTION 'Only @industriousoffice.com email addresses are allowed';
  END IF;

  -- Create profile for valid users
  INSERT INTO public.profiles (id, email, name, avatar, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    NEW.raw_user_meta_data->>'avatar_url',
    'New Hire'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Recreate trigger
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();
