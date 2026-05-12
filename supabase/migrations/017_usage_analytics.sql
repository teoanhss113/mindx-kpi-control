-- Usage analytics telemetry for admin visibility

CREATE TABLE IF NOT EXISTS usage_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_email TEXT NOT NULL,
  user_id TEXT,
  event_type TEXT NOT NULL CHECK (event_type IN ('page_view', 'heartbeat')),
  page_path TEXT NOT NULL,
  page_key TEXT,
  page_title TEXT,
  device_type TEXT,
  browser_name TEXT,
  os_name TEXT,
  viewport_width INTEGER,
  viewport_height INTEGER,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_usage_events_occurred_at ON usage_events(occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_usage_events_user_email ON usage_events(user_email);
CREATE INDEX IF NOT EXISTS idx_usage_events_page_path ON usage_events(page_path);
CREATE INDEX IF NOT EXISTS idx_usage_events_event_type ON usage_events(event_type);

ALTER TABLE usage_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role can manage usage events" ON usage_events;
CREATE POLICY "Service role can manage usage events"
  ON usage_events FOR ALL
  USING (auth.role() = 'service_role');

COMMENT ON TABLE usage_events IS 'Authenticated usage telemetry for admin analytics dashboards.';
COMMENT ON COLUMN profiles.last_login_at IS 'Last observed activity timestamp, updated on login and periodic client heartbeat.';

INSERT INTO pages (key, page_name, path, description, display_order)
VALUES (
  'admin-usage-analytics',
  'Phân tích Sử dụng',
  '/admin/usage-analytics',
  'Theo dõi tần suất sử dụng, nhu cầu, thiết bị và tải hệ thống',
  15
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
JOIN pages p ON p.key = 'admin-usage-analytics'
WHERE LOWER(r.name) = 'admin'
ON CONFLICT (role_id, page_id) DO UPDATE SET
  can_view = TRUE,
  can_edit = TRUE;
