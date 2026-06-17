CREATE TABLE IF NOT EXISTS members (
  id            SERIAL PRIMARY KEY,
  circle_id     TEXT UNIQUE NOT NULL,
  name          TEXT NOT NULL,
  email         TEXT NOT NULL,
  plan          TEXT NOT NULL DEFAULT 'Membro',
  member_since  DATE NOT NULL DEFAULT CURRENT_DATE,
  valid_until   DATE NOT NULL,
  status        TEXT NOT NULL DEFAULT 'active',
  member_code   TEXT UNIQUE NOT NULL,
  google_object_id TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_members_circle_id ON members(circle_id);
CREATE INDEX IF NOT EXISTS idx_members_status ON members(status);
CREATE INDEX IF NOT EXISTS idx_members_valid_until ON members(valid_until);
