-- ============================================================================
-- 014 — Security hardening
--
-- This migration tightens permissive RLS policies that were previously set to
-- `USING (true)` — they effectively disabled row-level security for the
-- anonymous role.
--
-- Architectural note: this app authenticates with Firebase, not Supabase Auth,
-- so `auth.uid()` is empty inside RLS. All privileged data access MUST go
-- through the API routes (`src/app/api/**`) and server actions
-- (`src/lib/admin-actions.ts`), which now verify the caller's Firebase ID
-- token and admin role before using the service-role client.
--
-- For the anonymous (public anon key) role we therefore:
--   * keep SELECT open where the data is genuinely public-app-wide,
--   * BLOCK direct INSERT / UPDATE / DELETE — clients must go through the
--     authenticated server endpoints.
-- The `service_role` key bypasses all RLS automatically, so server-side
-- admin code keeps working.
-- ============================================================================

-- ────────────────────────────────────────────────────────────────────────────
-- profiles
-- ────────────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Public read access for authentication" ON profiles;
DROP POLICY IF EXISTS "Service role full access" ON profiles;
DROP POLICY IF EXISTS "Anon read profiles" ON profiles;
DROP POLICY IF EXISTS "Anon write profiles" ON profiles;

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Anonymous clients can no longer read every profile. The login flow uses
-- the `/api/auth/sync-profile` endpoint (service-role) instead.
CREATE POLICY "profiles_no_anon_read"
  ON profiles FOR SELECT
  TO anon
  USING (false);

CREATE POLICY "profiles_no_anon_write"
  ON profiles FOR ALL
  TO anon
  USING (false)
  WITH CHECK (false);

-- ────────────────────────────────────────────────────────────────────────────
-- regions / region_centres — drop blanket public-read policies
-- ────────────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Public read access" ON regions;
DROP POLICY IF EXISTS "Public read access" ON region_centres;

ALTER TABLE regions ENABLE ROW LEVEL SECURITY;
ALTER TABLE region_centres ENABLE ROW LEVEL SECURITY;

CREATE POLICY "regions_no_anon_write"
  ON regions FOR ALL
  TO anon
  USING (false)
  WITH CHECK (false);

CREATE POLICY "region_centres_no_anon_write"
  ON region_centres FOR ALL
  TO anon
  USING (false)
  WITH CHECK (false);

-- Region/centre listings are read by authenticated UI sessions. Anonymous
-- read stays open for now (no PII), but writes are blocked for anon.
CREATE POLICY "regions_anon_read"
  ON regions FOR SELECT
  TO anon
  USING (true);

CREATE POLICY "region_centres_anon_read"
  ON region_centres FOR SELECT
  TO anon
  USING (true);

-- ────────────────────────────────────────────────────────────────────────────
-- roles / role_permissions / pages
-- ────────────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Public read access" ON roles;
DROP POLICY IF EXISTS "Public read access" ON role_permissions;
DROP POLICY IF EXISTS "Public read access" ON pages;

ALTER TABLE roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE role_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE pages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "roles_no_anon_write"
  ON roles FOR ALL
  TO anon
  USING (false)
  WITH CHECK (false);

CREATE POLICY "role_permissions_no_anon_write"
  ON role_permissions FOR ALL
  TO anon
  USING (false)
  WITH CHECK (false);

CREATE POLICY "pages_no_anon_write"
  ON pages FOR ALL
  TO anon
  USING (false)
  WITH CHECK (false);

-- ────────────────────────────────────────────────────────────────────────────
-- user_permissions — only owner-read; writes via service role.
-- ────────────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Users can view own permissions" ON user_permissions;
DROP POLICY IF EXISTS "Public read access" ON user_permissions;

ALTER TABLE user_permissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user_permissions_no_anon_write"
  ON user_permissions FOR ALL
  TO anon
  USING (false)
  WITH CHECK (false);

-- ────────────────────────────────────────────────────────────────────────────
-- teacher_office_hour_confirmations — drop USING (true) policies.
-- ────────────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Allow all to view confirmations" ON teacher_office_hour_confirmations;
DROP POLICY IF EXISTS "Allow all to insert confirmations" ON teacher_office_hour_confirmations;
DROP POLICY IF EXISTS "Allow all to update confirmations" ON teacher_office_hour_confirmations;
DROP POLICY IF EXISTS "Allow all to delete confirmations" ON teacher_office_hour_confirmations;
DROP POLICY IF EXISTS "Authenticated users can view confirmations" ON teacher_office_hour_confirmations;
DROP POLICY IF EXISTS "Authenticated users can insert confirmations" ON teacher_office_hour_confirmations;
DROP POLICY IF EXISTS "Authenticated users can update confirmations" ON teacher_office_hour_confirmations;

ALTER TABLE teacher_office_hour_confirmations ENABLE ROW LEVEL SECURITY;

-- Until reads/writes are routed through authenticated server endpoints,
-- block direct anon write access. Service role (admin client) bypasses RLS
-- and keeps working.
CREATE POLICY "teacher_confirmations_no_anon_write"
  ON teacher_office_hour_confirmations FOR ALL
  TO anon
  USING (false)
  WITH CHECK (false);

-- ────────────────────────────────────────────────────────────────────────────
-- office_hours_shift_requests — drop USING (true) policies.
-- ────────────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Allow all to view shift requests" ON office_hours_shift_requests;
DROP POLICY IF EXISTS "Allow all to insert shift requests" ON office_hours_shift_requests;
DROP POLICY IF EXISTS "Allow all to update shift requests" ON office_hours_shift_requests;
DROP POLICY IF EXISTS "Allow all to delete shift requests" ON office_hours_shift_requests;

ALTER TABLE office_hours_shift_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "shift_requests_no_anon_write"
  ON office_hours_shift_requests FOR ALL
  TO anon
  USING (false)
  WITH CHECK (false);

-- ────────────────────────────────────────────────────────────────────────────
-- Verification
-- ────────────────────────────────────────────────────────────────────────────
COMMENT ON TABLE profiles IS
  'PII table — anon role has no direct access. All reads/writes go through authenticated API routes that verify Firebase ID tokens.';
