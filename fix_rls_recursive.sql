-- FIX RLS RECURSION
-- The previous policy caused infinite recursion because querying 'room_users' 
-- triggered the policy, which queried 'room_users' again.
-- We fix this by using a SECURITY DEFINER function to bypass RLS for the check.

-- 1. Drop the problematic policies
DROP POLICY IF EXISTS "View members of own rooms" ON room_users;
DROP POLICY IF EXISTS "Read accessible user profiles" ON users;
DROP POLICY IF EXISTS "Read basic user info" ON users;

-- 2. Create a secure function to check room membership without triggering RLS
-- This runs with 'security definer' privileges (admin level for this logic)
CREATE OR REPLACE FUNCTION is_room_member(_room_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 
    from room_users 
    WHERE room_id = _room_id 
    AND user_id = auth.uid()
  );
$$;

-- 3. Re-apply the policy on room_users using the safe function
CREATE POLICY "View members of own rooms"
ON room_users
FOR SELECT
TO authenticated
USING (
  -- Users can always see their own rows
  user_id = auth.uid() 
  OR 
  -- Users can see other rows if they are members of the same room
  is_room_member(room_id)
);

-- 4. Re-apply a simple policy for users/profiles
CREATE POLICY "Read basic user info"
ON users
FOR SELECT
TO authenticated
USING (true);
