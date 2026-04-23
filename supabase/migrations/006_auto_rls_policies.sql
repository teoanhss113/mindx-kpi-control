-- ============================================================================
-- Auto RLS Policies - Automatically apply RLS policies to new tables
-- ============================================================================

-- ============================================================================
-- FUNCTION: Apply default RLS policies to a table
-- ============================================================================

CREATE OR REPLACE FUNCTION apply_default_rls_policies(table_name text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Enable RLS on the table
  EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', table_name);
  
  -- Drop existing default policies if any (to avoid conflicts)
  EXECUTE format('DROP POLICY IF EXISTS "Public read %I" ON %I', table_name, table_name);
  EXECUTE format('DROP POLICY IF EXISTS "Admins manage %I" ON %I', table_name, table_name);
  EXECUTE format('DROP POLICY IF EXISTS "Service role full access %I" ON %I', table_name, table_name);
  
  -- Create public read policy
  EXECUTE format('
    CREATE POLICY "Public read %I"
      ON %I FOR SELECT
      USING (true)
  ', table_name, table_name);
  
  -- Create admin management policy
  EXECUTE format('
    CREATE POLICY "Admins manage %I"
      ON %I FOR ALL
      USING (
        auth.uid() IN (
          SELECT id FROM profiles 
          WHERE role = ''admin'' AND is_active = true
        )
      )
  ', table_name, table_name);
  
  -- Create service role full access policy
  EXECUTE format('
    CREATE POLICY "Service role full access %I"
      ON %I FOR ALL
      USING (current_setting(''request.jwt.claims'', true)::json->>''role'' = ''service_role'')
  ', table_name, table_name);
  
  RAISE NOTICE 'Applied default RLS policies to table: %', table_name;
END;
$$;

COMMENT ON FUNCTION apply_default_rls_policies IS 'Applies default RLS policies (public read, admin manage, service role full access) to a table';

-- ============================================================================
-- FUNCTION: Apply RLS to all existing tables in public schema
-- ============================================================================

CREATE OR REPLACE FUNCTION apply_rls_to_all_tables()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  table_record RECORD;
BEGIN
  -- Loop through all tables in public schema (excluding system tables)
  FOR table_record IN 
    SELECT tablename 
    FROM pg_tables 
    WHERE schemaname = 'public' 
      AND tablename NOT LIKE 'pg_%'
      AND tablename NOT LIKE 'sql_%'
      AND tablename != 'spatial_ref_sys'
    ORDER BY tablename
  LOOP
    BEGIN
      PERFORM apply_default_rls_policies(table_record.tablename);
      RAISE NOTICE 'Applied RLS to: %', table_record.tablename;
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'Failed to apply RLS to %: %', table_record.tablename, SQLERRM;
    END;
  END LOOP;
  
  RAISE NOTICE 'Finished applying RLS to all tables';
END;
$$;

COMMENT ON FUNCTION apply_rls_to_all_tables IS 'Applies default RLS policies to all tables in public schema';

-- ============================================================================
-- TRIGGER: Auto-apply RLS to new tables (PostgreSQL 14+)
-- Note: This requires event triggers which may need superuser privileges
-- If this fails, you can manually call apply_default_rls_policies(table_name)
-- ============================================================================

-- Drop existing trigger if any
DROP EVENT TRIGGER IF EXISTS auto_apply_rls_on_create_table;

-- Create event trigger function
CREATE OR REPLACE FUNCTION auto_apply_rls_on_create_table_func()
RETURNS event_trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  obj RECORD;
BEGIN
  -- Loop through created objects
  FOR obj IN SELECT * FROM pg_event_trigger_ddl_commands()
  LOOP
    -- Check if it's a table creation in public schema
    IF obj.object_type = 'table' AND obj.schema_name = 'public' THEN
      -- Apply default RLS policies
      PERFORM apply_default_rls_policies(obj.object_identity);
      RAISE NOTICE 'Auto-applied RLS policies to new table: %', obj.object_identity;
    END IF;
  END LOOP;
END;
$$;

-- Create event trigger (may fail if not superuser)
DO $$
BEGIN
  CREATE EVENT TRIGGER auto_apply_rls_on_create_table
    ON ddl_command_end
    WHEN TAG IN ('CREATE TABLE')
    EXECUTE FUNCTION auto_apply_rls_on_create_table_func();
  
  RAISE NOTICE 'Event trigger created successfully - RLS will auto-apply to new tables';
EXCEPTION WHEN insufficient_privilege THEN
  RAISE WARNING 'Could not create event trigger (requires superuser). You can manually call apply_default_rls_policies(table_name) for new tables.';
WHEN OTHERS THEN
  RAISE WARNING 'Could not create event trigger: %. You can manually call apply_default_rls_policies(table_name) for new tables.', SQLERRM;
END;
$$;

-- ============================================================================
-- APPLY TO EXISTING TABLES
-- ============================================================================

-- Apply default RLS policies to all existing tables
SELECT apply_rls_to_all_tables();

-- ============================================================================
-- USAGE EXAMPLES
-- ============================================================================

-- Example 1: Apply RLS to a specific new table
-- SELECT apply_default_rls_policies('my_new_table');

-- Example 2: Apply RLS to all tables again (if needed)
-- SELECT apply_rls_to_all_tables();

-- Example 3: Check which tables have RLS enabled
-- SELECT 
--   schemaname, 
--   tablename, 
--   rowsecurity 
-- FROM pg_tables 
-- WHERE schemaname = 'public' 
-- ORDER BY tablename;

-- Example 4: Check policies for a specific table
-- SELECT 
--   policyname, 
--   cmd, 
--   qual 
-- FROM pg_policies 
-- WHERE tablename = 'your_table_name';

-- ============================================================================
-- VERIFY
-- ============================================================================

-- Show all tables with RLS status
SELECT 
  schemaname, 
  tablename, 
  CASE WHEN rowsecurity THEN '✅ Enabled' ELSE '❌ Disabled' END as rls_status
FROM pg_tables 
WHERE schemaname = 'public' 
  AND tablename NOT LIKE 'pg_%'
  AND tablename NOT LIKE 'sql_%'
ORDER BY tablename;

-- Show all policies
SELECT 
  tablename, 
  policyname, 
  cmd,
  CASE 
    WHEN policyname LIKE 'Public read%' THEN '👁️  Public Read'
    WHEN policyname LIKE 'Admins manage%' THEN '🔐 Admin Manage'
    WHEN policyname LIKE 'Service role%' THEN '⚙️  Service Role'
    ELSE '📋 Custom'
  END as policy_type
FROM pg_policies 
WHERE schemaname = 'public'
ORDER BY tablename, policyname;

-- ============================================================================
-- NOTES
-- ============================================================================

-- 1. Default policies created:
--    - Public read: Everyone can SELECT
--    - Admins manage: Admin users can INSERT/UPDATE/DELETE
--    - Service role: Service role has full access

-- 2. To customize policies for specific tables:
--    - Drop the default policies
--    - Create your custom policies

-- 3. To disable auto-apply for future tables:
--    DROP EVENT TRIGGER IF EXISTS auto_apply_rls_on_create_table;

-- 4. To manually apply to a new table:
--    SELECT apply_default_rls_policies('table_name');

-- 5. Event trigger may not work on Supabase free tier
--    In that case, manually call apply_default_rls_policies() after creating tables
