-- ============================================================================
-- Verify and Fix user_permissions Schema
-- Ensure courses column exists with correct type
-- ============================================================================

-- Check if courses column exists, if not add it
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_name = 'user_permissions' 
    AND column_name = 'courses'
  ) THEN
    ALTER TABLE user_permissions 
    ADD COLUMN courses TEXT[] DEFAULT '{}';
    
    RAISE NOTICE 'Added courses column to user_permissions table';
  ELSE
    RAISE NOTICE 'courses column already exists in user_permissions table';
  END IF;
END $$;

-- Ensure the column has the correct type and default
ALTER TABLE user_permissions 
ALTER COLUMN courses TYPE TEXT[] USING courses::TEXT[],
ALTER COLUMN courses SET DEFAULT '{}';

-- Add comment
COMMENT ON COLUMN user_permissions.courses IS 'Array of course categories: Coding, Robotics, Art, Others. Empty array means all courses.';

-- Verify the schema
SELECT 
  column_name,
  data_type,
  column_default,
  is_nullable
FROM information_schema.columns
WHERE table_name = 'user_permissions'
ORDER BY ordinal_position;

