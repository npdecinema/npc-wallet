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

ALTER TABLE members ADD COLUMN IF NOT EXISTS apple_update_tag INTEGER NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS apple_device_registrations (
  id            SERIAL PRIMARY KEY,
  device_id     TEXT NOT NULL,
  pass_type_id  TEXT NOT NULL,
  serial_number TEXT NOT NULL,
  push_token    TEXT NOT NULL,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(device_id, serial_number)
);

CREATE INDEX IF NOT EXISTS idx_apple_reg_serial ON apple_device_registrations(serial_number);
CREATE INDEX IF NOT EXISTS idx_apple_reg_device ON apple_device_registrations(device_id);