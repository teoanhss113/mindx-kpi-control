-- Manager weekly work schedule registrations

CREATE TABLE IF NOT EXISTS manager_work_schedules (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  manager_id TEXT NOT NULL,
  manager_name TEXT NOT NULL,
  manager_email TEXT NOT NULL,
  centre_id TEXT NOT NULL,
  centre_name TEXT NOT NULL DEFAULT '',
  centre_short_name TEXT NOT NULL DEFAULT '',
  work_date DATE NOT NULL,
  weekday INTEGER NOT NULL CHECK (weekday BETWEEN 0 AND 6),
  session TEXT NOT NULL CHECK (session IN ('morning', 'afternoon', 'evening')),
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (manager_email, work_date, session)
);

CREATE INDEX IF NOT EXISTS idx_manager_work_schedules_date ON manager_work_schedules(work_date);
CREATE INDEX IF NOT EXISTS idx_manager_work_schedules_centre ON manager_work_schedules(centre_id);
CREATE INDEX IF NOT EXISTS idx_manager_work_schedules_manager ON manager_work_schedules(manager_email);

ALTER TABLE manager_work_schedules ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role can manage manager schedules" ON manager_work_schedules;
CREATE POLICY "Service role can manage manager schedules"
  ON manager_work_schedules FOR ALL
  USING (auth.role() = 'service_role');

CREATE OR REPLACE FUNCTION set_manager_work_schedules_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_manager_work_schedules_updated_at ON manager_work_schedules;
CREATE TRIGGER trg_manager_work_schedules_updated_at
  BEFORE UPDATE ON manager_work_schedules
  FOR EACH ROW
  EXECUTE FUNCTION set_manager_work_schedules_updated_at();

INSERT INTO pages (key, page_name, path, description, display_order)
VALUES
  (
    'manager-schedules',
    'Đăng ký lịch Quản lý',
    '/admin/schedule',
    'Quản lý đăng ký lịch làm việc hằng tuần theo cơ sở và buổi',
    4
  ),
  (
    'admin-manager-schedules',
    'Quản trị lịch Quản lý',
    '/admin/manager-schedules',
    'Admin theo dõi lịch làm việc của quản lý theo thời gian và cơ sở',
    10
  )
ON CONFLICT (key) DO UPDATE SET
  page_name = EXCLUDED.page_name,
  path = EXCLUDED.path,
  description = EXCLUDED.description,
  display_order = EXCLUDED.display_order,
  updated_at = NOW();

INSERT INTO role_permissions (role_id, page_id, can_view, can_edit)
SELECT r.id, p.id, TRUE, TRUE
FROM roles r
JOIN pages p ON p.key IN ('manager-schedules', 'admin-manager-schedules')
WHERE LOWER(r.name) = 'admin'
ON CONFLICT (role_id, page_id) DO UPDATE SET
  can_view = TRUE,
  can_edit = TRUE;
