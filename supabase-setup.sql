-- ================================================================
-- SOARER REGISTRY — SUPABASE DATABASE SETUP
-- ================================================================
-- Run this entire file in: Supabase Dashboard → SQL Editor → New Query
-- ================================================================

-- ── PROFILES TABLE ────────────────────────────────────────────────────────────
-- Extends Supabase auth.users with public profile data

CREATE TABLE IF NOT EXISTS profiles (
  id           UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username     TEXT UNIQUE NOT NULL,
  email        TEXT,  -- stored for username-based login lookup
  display_name TEXT,
  location     TEXT,
  bio          TEXT,
  is_admin     BOOLEAN DEFAULT FALSE,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  updated_at   TIMESTAMPTZ DEFAULT NOW()
);

-- ── CARS TABLE ────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS cars (
  id                 BIGSERIAL PRIMARY KEY,
  user_id            UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  vin                TEXT,
  frame_number       TEXT,
  chassis            TEXT NOT NULL,
  model              TEXT NOT NULL,
  trim               TEXT,
  color              TEXT,
  color_code         TEXT,
  mfg_year           INTEGER,
  mfg_month          INTEGER,
  transmission       TEXT,
  engine             TEXT,
  drive_side         TEXT,
  location           TEXT,
  country            TEXT,
  body_type          TEXT,
  targa_top          BOOLEAN DEFAULT FALSE,
  current_owner_name TEXT,
  notes              TEXT,
  primary_image_url  TEXT,  -- denormalised for fast listing queries
  status             TEXT DEFAULT 'active',
  created_at         TIMESTAMPTZ DEFAULT NOW(),
  updated_at         TIMESTAMPTZ DEFAULT NOW()
);

-- Unique constraints that allow multiple NULLs (NULL ≠ NULL in SQL)
CREATE UNIQUE INDEX IF NOT EXISTS cars_vin_unique
  ON cars(vin) WHERE vin IS NOT NULL AND vin <> '';

CREATE UNIQUE INDEX IF NOT EXISTS cars_frame_unique
  ON cars(frame_number) WHERE frame_number IS NOT NULL AND frame_number <> '';

-- ── CAR IMAGES TABLE ──────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS car_images (
  id           BIGSERIAL PRIMARY KEY,
  car_id       BIGINT NOT NULL REFERENCES cars(id) ON DELETE CASCADE,
  storage_path TEXT NOT NULL,  -- e.g. user_id/car_id/uuid.jpg
  public_url   TEXT NOT NULL,
  caption      TEXT,
  is_primary   BOOLEAN DEFAULT FALSE,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_cars_chassis   ON cars(chassis);
CREATE INDEX IF NOT EXISTS idx_cars_status    ON cars(status);
CREATE INDEX IF NOT EXISTS idx_cars_user      ON cars(user_id);
CREATE INDEX IF NOT EXISTS idx_images_car     ON car_images(car_id);
CREATE INDEX IF NOT EXISTS idx_images_primary ON car_images(car_id, is_primary);

-- ── TRIGGER: create profile on signup ────────────────────────────────────────

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, username, email, display_name)
  VALUES (
    NEW.id,
    LOWER(COALESCE(
      NEW.raw_user_meta_data->>'username',
      split_part(NEW.email, '@', 1)
    )),
    NEW.email,
    COALESCE(
      NEW.raw_user_meta_data->>'display_name',
      NEW.raw_user_meta_data->>'username',
      split_part(NEW.email, '@', 1)
    )
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ── ROW LEVEL SECURITY ────────────────────────────────────────────────────────

ALTER TABLE profiles   ENABLE ROW LEVEL SECURITY;
ALTER TABLE cars       ENABLE ROW LEVEL SECURITY;
ALTER TABLE car_images ENABLE ROW LEVEL SECURITY;

-- Profiles
DROP POLICY IF EXISTS "profiles_select"    ON profiles;
DROP POLICY IF EXISTS "profiles_insert"    ON profiles;
DROP POLICY IF EXISTS "profiles_update"    ON profiles;

CREATE POLICY "profiles_select" ON profiles FOR SELECT USING (true);
CREATE POLICY "profiles_insert" ON profiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "profiles_update" ON profiles FOR UPDATE USING (auth.uid() = id);

-- Cars: public read, owners write
DROP POLICY IF EXISTS "cars_select" ON cars;
DROP POLICY IF EXISTS "cars_insert" ON cars;
DROP POLICY IF EXISTS "cars_update" ON cars;
DROP POLICY IF EXISTS "cars_delete" ON cars;

CREATE POLICY "cars_select" ON cars FOR SELECT USING (true);
CREATE POLICY "cars_insert" ON cars FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "cars_update" ON cars FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "cars_delete" ON cars FOR DELETE USING (auth.uid() = user_id);

-- Car images: public read, owner of the car can write
DROP POLICY IF EXISTS "images_select" ON car_images;
DROP POLICY IF EXISTS "images_insert" ON car_images;
DROP POLICY IF EXISTS "images_delete" ON car_images;

CREATE POLICY "images_select" ON car_images FOR SELECT USING (true);
CREATE POLICY "images_insert" ON car_images FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM cars WHERE id = car_id AND user_id = auth.uid())
  );
CREATE POLICY "images_delete" ON car_images FOR DELETE USING (
  EXISTS (SELECT 1 FROM cars WHERE id = car_id AND user_id = auth.uid())
);

-- ── STORAGE POLICIES ─────────────────────────────────────────────────────────
-- Storage bucket "car-images" must be created manually in:
--   Supabase Dashboard → Storage → New Bucket
--   Name: car-images   │   Public: ✅ ON
--
-- Then run these policies:

DROP POLICY IF EXISTS "storage_read"   ON storage.objects;
DROP POLICY IF EXISTS "storage_insert" ON storage.objects;
DROP POLICY IF EXISTS "storage_delete" ON storage.objects;

CREATE POLICY "storage_read" ON storage.objects
  FOR SELECT USING (bucket_id = 'car-images');

CREATE POLICY "storage_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'car-images'
    AND auth.uid()::text = split_part(name, '/', 1)
  );

CREATE POLICY "storage_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'car-images'
    AND auth.uid()::text = split_part(name, '/', 1)
  );

-- ================================================================
-- MIGRATION — add columns introduced in the redesign
-- Safe to run on an existing database (IF NOT EXISTS / IF NOT EXISTS guard)
-- ================================================================

ALTER TABLE cars ADD COLUMN IF NOT EXISTS interior_color    TEXT;
ALTER TABLE cars ADD COLUMN IF NOT EXISTS interior_material TEXT;
ALTER TABLE cars ADD COLUMN IF NOT EXISTS plant             TEXT;
ALTER TABLE cars ADD COLUMN IF NOT EXISTS body_shape        TEXT;
ALTER TABLE cars ADD COLUMN IF NOT EXISTS gear_shift        TEXT;
ALTER TABLE cars ADD COLUMN IF NOT EXISTS fuel_system       TEXT;
ALTER TABLE cars ADD COLUMN IF NOT EXISTS grade             TEXT;
ALTER TABLE cars ADD COLUMN IF NOT EXISTS market            TEXT;
ALTER TABLE cars ADD COLUMN IF NOT EXISTS destination       TEXT;
ALTER TABLE cars ADD COLUMN IF NOT EXISTS trim_code         TEXT;
ALTER TABLE cars ADD COLUMN IF NOT EXISTS title_status      TEXT;
ALTER TABLE cars ADD COLUMN IF NOT EXISTS verification      TEXT;
ALTER TABLE cars ADD COLUMN IF NOT EXISTS vin_matched       BOOLEAN DEFAULT NULL;

-- Extended vehicle data (from combined CSV sources)
ALTER TABLE cars ADD COLUMN IF NOT EXISTS make                  TEXT;
ALTER TABLE cars ADD COLUMN IF NOT EXISTS manufacturer          TEXT;
ALTER TABLE cars ADD COLUMN IF NOT EXISTS model_code            TEXT;
ALTER TABLE cars ADD COLUMN IF NOT EXISTS production_from       TEXT;
ALTER TABLE cars ADD COLUMN IF NOT EXISTS production_to         TEXT;
ALTER TABLE cars ADD COLUMN IF NOT EXISTS plant_city            TEXT;
ALTER TABLE cars ADD COLUMN IF NOT EXISTS plant_company         TEXT;
ALTER TABLE cars ADD COLUMN IF NOT EXISTS plant_country         TEXT;
ALTER TABLE cars ADD COLUMN IF NOT EXISTS plant_state           TEXT;
ALTER TABLE cars ADD COLUMN IF NOT EXISTS displacement_cc       INTEGER;
ALTER TABLE cars ADD COLUMN IF NOT EXISTS displacement_cid      TEXT;
ALTER TABLE cars ADD COLUMN IF NOT EXISTS engine_configuration  TEXT;
ALTER TABLE cars ADD COLUMN IF NOT EXISTS engine_cylinders      INTEGER;
ALTER TABLE cars ADD COLUMN IF NOT EXISTS engine_hp             INTEGER;
ALTER TABLE cars ADD COLUMN IF NOT EXISTS engine_make           TEXT;
ALTER TABLE cars ADD COLUMN IF NOT EXISTS engine_model          TEXT;
ALTER TABLE cars ADD COLUMN IF NOT EXISTS doors                 INTEGER;
ALTER TABLE cars ADD COLUMN IF NOT EXISTS airbag_location       TEXT;

-- Extend the VIN directory with the same additional fields
ALTER TABLE vin_directory ADD COLUMN IF NOT EXISTS make                 TEXT;
ALTER TABLE vin_directory ADD COLUMN IF NOT EXISTS manufacturer         TEXT;
ALTER TABLE vin_directory ADD COLUMN IF NOT EXISTS model_code           TEXT;
ALTER TABLE vin_directory ADD COLUMN IF NOT EXISTS production_from      TEXT;
ALTER TABLE vin_directory ADD COLUMN IF NOT EXISTS production_to        TEXT;
ALTER TABLE vin_directory ADD COLUMN IF NOT EXISTS grade                TEXT;
ALTER TABLE vin_directory ADD COLUMN IF NOT EXISTS market               TEXT;
ALTER TABLE vin_directory ADD COLUMN IF NOT EXISTS destination          TEXT;
ALTER TABLE vin_directory ADD COLUMN IF NOT EXISTS trim_code            TEXT;
ALTER TABLE vin_directory ADD COLUMN IF NOT EXISTS plant                TEXT;
ALTER TABLE vin_directory ADD COLUMN IF NOT EXISTS plant_city           TEXT;
ALTER TABLE vin_directory ADD COLUMN IF NOT EXISTS plant_company        TEXT;
ALTER TABLE vin_directory ADD COLUMN IF NOT EXISTS plant_country        TEXT;
ALTER TABLE vin_directory ADD COLUMN IF NOT EXISTS plant_state          TEXT;
ALTER TABLE vin_directory ADD COLUMN IF NOT EXISTS displacement_cc      INTEGER;
ALTER TABLE vin_directory ADD COLUMN IF NOT EXISTS displacement_cid     TEXT;
ALTER TABLE vin_directory ADD COLUMN IF NOT EXISTS engine_configuration TEXT;
ALTER TABLE vin_directory ADD COLUMN IF NOT EXISTS engine_cylinders     INTEGER;
ALTER TABLE vin_directory ADD COLUMN IF NOT EXISTS engine_hp            INTEGER;
ALTER TABLE vin_directory ADD COLUMN IF NOT EXISTS engine_make          TEXT;
ALTER TABLE vin_directory ADD COLUMN IF NOT EXISTS engine_model         TEXT;
ALTER TABLE vin_directory ADD COLUMN IF NOT EXISTS doors                INTEGER;
ALTER TABLE vin_directory ADD COLUMN IF NOT EXISTS airbag_location      TEXT;

-- ================================================================
-- SETUP COMPLETE — return to config.js and fill in your credentials
-- ================================================================

-- ── FEEDBACK TABLE ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS feedback (
  id         BIGSERIAL PRIMARY KEY,
  user_id    UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  category   TEXT NOT NULL DEFAULT 'other',
  name       TEXT,
  email      TEXT,
  message    TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE feedback ENABLE ROW LEVEL SECURITY;

-- Anyone (including anonymous) can submit feedback
DROP POLICY IF EXISTS "feedback_insert" ON feedback;
CREATE POLICY "feedback_insert" ON feedback FOR INSERT WITH CHECK (true);

-- Only admins can read feedback (check profiles.is_admin)
DROP POLICY IF EXISTS "feedback_select" ON feedback;
CREATE POLICY "feedback_select" ON feedback FOR SELECT
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true));

-- ================================================================
-- ADMIN SETUP
-- ================================================================
-- Helper function to check admin status (SECURITY DEFINER avoids
-- recursive RLS when querying profiles from within a profiles policy)
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT is_admin FROM profiles WHERE id = auth.uid()),
    false
  );
$$;

-- Admins can update/delete any car (regular policies still apply for owners)
DROP POLICY IF EXISTS "cars_update_admin" ON cars;
DROP POLICY IF EXISTS "cars_delete_admin" ON cars;
CREATE POLICY "cars_update_admin" ON cars FOR UPDATE
  USING (is_admin());
CREATE POLICY "cars_delete_admin" ON cars FOR DELETE
  USING (is_admin());

-- Admins can update any profile (e.g. toggle is_admin on other accounts)
DROP POLICY IF EXISTS "profiles_update_admin" ON profiles;
CREATE POLICY "profiles_update_admin" ON profiles FOR UPDATE
  USING (is_admin());

-- Admins can manage images on any car
DROP POLICY IF EXISTS "images_insert_admin" ON car_images;
DROP POLICY IF EXISTS "images_delete_admin" ON car_images;
CREATE POLICY "images_insert_admin" ON car_images FOR INSERT TO authenticated
  WITH CHECK (is_admin());
CREATE POLICY "images_delete_admin" ON car_images FOR DELETE
  USING (is_admin());

-- ── TO GRANT YOURSELF ADMIN ACCESS ────────────────────────────────────────────
-- Run this in the Supabase SQL Editor after creating your account:
--
--   UPDATE profiles SET is_admin = true WHERE username = 'your_username';
--
-- ──────────────────────────────────────────────────────────────────────────────

-- ── VIN DIRECTORY TABLE ─────────────────────────────────────────────────────
-- Master list of known Soarer / SC VINs. Users search this list when
-- registering a car; matching entries auto-fill chassis details.

CREATE TABLE IF NOT EXISTS vin_directory (
  id           BIGSERIAL PRIMARY KEY,
  vin          TEXT UNIQUE NOT NULL,
  frame_number TEXT,
  chassis      TEXT,
  model        TEXT,
  mfg_year     INTEGER,
  mfg_month    INTEGER,
  engine       TEXT,
  transmission TEXT,
  color        TEXT,
  color_code   TEXT,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE vin_directory ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_vin_dir_vin ON vin_directory(vin);

-- Everyone can search
DROP POLICY IF EXISTS "vin_dir_select" ON vin_directory;
CREATE POLICY "vin_dir_select" ON vin_directory FOR SELECT USING (true);

-- Only admins can manage the directory
DROP POLICY IF EXISTS "vin_dir_insert" ON vin_directory;
DROP POLICY IF EXISTS "vin_dir_update" ON vin_directory;
DROP POLICY IF EXISTS "vin_dir_delete" ON vin_directory;
CREATE POLICY "vin_dir_insert" ON vin_directory FOR INSERT TO authenticated
  WITH CHECK (is_admin());
CREATE POLICY "vin_dir_update" ON vin_directory FOR UPDATE
  USING (is_admin());
CREATE POLICY "vin_dir_delete" ON vin_directory FOR DELETE
  USING (is_admin());
