-- =====================================================
-- Delete Default Roles and Permissions
-- =====================================================
-- This migration removes all existing roles and role_permissions
-- Run this if you already ran the initial migration with default data
-- =====================================================

-- Delete all role permissions first (due to foreign key constraint)
DELETE FROM role_permissions;

-- Delete all roles
DELETE FROM roles;

-- Verify deletion
DO $$
DECLARE
  role_count INTEGER;
  perm_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO role_count FROM roles;
  SELECT COUNT(*) INTO perm_count FROM role_permissions;
  
  RAISE NOTICE 'Roles remaining: %', role_count;
  RAISE NOTICE 'Role permissions remaining: %', perm_count;
  
  IF role_count = 0 AND perm_count = 0 THEN
    RAISE NOTICE '✅ Successfully deleted all roles and permissions';
  ELSE
    RAISE WARNING '⚠️ Some records still remain';
  END IF;
END $$;
