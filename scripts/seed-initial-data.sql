-- 0) Optional: confirm you're in the schema you think you are
-- SELECT current_database(), current_schema();

-- 1) A reusable updated_at trigger (optional but nice)
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 2) categories table (required by your seed)
CREATE TABLE IF NOT EXISTS categories (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  slug        TEXT NOT NULL UNIQUE,
  description TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DROP TRIGGER IF EXISTS trg_categories_updated_at ON categories;
CREATE TRIGGER trg_categories_updated_at
BEFORE UPDATE ON categories
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- 3) users table
-- If you already use an enum elsewhere, adjust accordingly.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_role') THEN
    CREATE TYPE user_role AS ENUM ('USER', 'ADMIN');
  END IF;
END$$;

CREATE TABLE IF NOT EXISTS users (
  id          TEXT PRIMARY KEY,
  email       TEXT NOT NULL UNIQUE,
  name        TEXT,
  password    TEXT NOT NULL,      -- store bcrypt hash
  role        user_role NOT NULL DEFAULT 'USER',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DROP TRIGGER IF EXISTS trg_users_updated_at ON users;
CREATE TRIGGER trg_users_updated_at
BEFORE UPDATE ON users
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- 4) allowed_domains table
CREATE TABLE IF NOT EXISTS allowed_domains (
  id          TEXT PRIMARY KEY,
  domain      TEXT NOT NULL UNIQUE,
  is_active   BOOLEAN NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DROP TRIGGER IF EXISTS trg_allowed_domains_updated_at ON allowed_domains;
CREATE TRIGGER trg_allowed_domains_updated_at
BEFORE UPDATE ON allowed_domains
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Insert default categories
INSERT INTO categories (id, name, slug, description)
VALUES
  ('cat_1', 'Tutorial', 'tutorial', 'Tutorial and educational videos'),
  ('cat_2', 'Product Demo', 'product-demo', 'Product demonstrations and showcases'),
  ('cat_3', 'Marketing', 'marketing', 'Marketing and promotional content'),
  ('cat_4', 'Training', 'training', 'Internal training materials'),
  ('cat_5', 'General', 'general', 'General purpose videos')
ON CONFLICT (slug) DO NOTHING;

-- Insert admin user
-- IMPORTANT: replace the password with a REAL bcrypt hash (see note below)
INSERT INTO users (id, email, name, password, role)
VALUES (
  'user_admin',
  'admin@example.com',
  'Admin User',
  '$2b$10$mJrKlk7.irrHHSbhAfZ3ger63b89Ywd4j7sIeZI8TRx.CYUqzeVQm',
  'ADMIN'
)
ON CONFLICT (email) DO NOTHING;

-- Insert allowed domains
INSERT INTO allowed_domains (id, domain, is_active)
VALUES
  ('dom_1', 'localhost', true),
  ('dom_2', 'example.com', true),
  ('dom_3', 'yourdomain.com', true)
ON CONFLICT (domain) DO NOTHING;
