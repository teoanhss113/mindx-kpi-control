-- Rename course_lines to courses for consistency
-- This aligns with filter terminology used throughout the app

-- Rename column in user_permissions table
ALTER TABLE user_permissions 
RENAME COLUMN course_lines TO courses;

-- Update comment to reflect new naming
COMMENT ON COLUMN user_permissions.courses IS 'Array of courses user has access to: Coding, Robotics, Art, Others. Empty array means all courses.';
