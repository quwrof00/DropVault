-- RLS Policy for room_users table
-- This allows a user to see ALL members of a room if they are also a member of that room.
CREATE POLICY "View members of own rooms"
ON room_users
FOR SELECT
TO authenticated
USING (
  room_id IN (
    SELECT room_id 
    FROM room_users 
    WHERE user_id = auth.uid()
  )
);

-- RLS Policy for users table (profile table)
-- This allows authenticated users to read basic profile info (email, etc) of other users.
-- Adjust strictly if you only want them to see users in the same room (more complex).
CREATE POLICY "Read accessible user profiles"
ON users
FOR SELECT
TO authenticated
USING (true);
