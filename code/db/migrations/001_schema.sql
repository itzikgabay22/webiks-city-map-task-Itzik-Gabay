-- CityMap core schema. All geometries are stored in EPSG:4326.

CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE TABLE IF NOT EXISTS users (
  username      text PRIMARY KEY,
  display_name  text NOT NULL
);

CREATE TABLE IF NOT EXISTS partners (
  id            serial PRIMARY KEY,
  name          text NOT NULL,
  api_key_hash  text NOT NULL UNIQUE,
  active        boolean NOT NULL DEFAULT true,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS layers (
  id             text PRIMARY KEY,
  title          text NOT NULL,
  geometry_type  text NOT NULL,
  is_public      boolean NOT NULL DEFAULT true,
  owner          text REFERENCES users (username),
  updated_at     timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS layers_owner_idx ON layers (owner);
CREATE INDEX IF NOT EXISTS layers_public_idx ON layers (id) WHERE is_public;

CREATE TABLE IF NOT EXISTS layer_shares (
  layer_id  text NOT NULL REFERENCES layers (id) ON DELETE CASCADE,
  username  text NOT NULL REFERENCES users (username) ON DELETE CASCADE,
  PRIMARY KEY (layer_id, username)
);
CREATE INDEX IF NOT EXISTS layer_shares_username_idx ON layer_shares (username, layer_id);

CREATE TABLE IF NOT EXISTS admin_boundaries (
  id          serial PRIMARY KEY,
  name        text NOT NULL,
  region      text NOT NULL,
  population  integer NOT NULL,
  geom        geometry(MultiPolygon, 4326) NOT NULL
);
CREATE INDEX IF NOT EXISTS admin_boundaries_geom_idx ON admin_boundaries USING gist (geom);

CREATE TABLE IF NOT EXISTS parcels (
  id           serial PRIMARY KEY,
  parcel_code  text NOT NULL UNIQUE,
  land_use     text NOT NULL,
  area_m2      numeric(12, 1) NOT NULL,
  geom         geometry(Polygon, 4326) NOT NULL
);
CREATE INDEX IF NOT EXISTS parcels_geom_idx ON parcels USING gist (geom);
CREATE INDEX IF NOT EXISTS parcels_land_use_idx ON parcels (land_use);

CREATE TABLE IF NOT EXISTS addresses (
  id            serial PRIMARY KEY,
  parcel_id     integer REFERENCES parcels (id),
  house_number  integer NOT NULL,
  street        text NOT NULL,
  locality      text NOT NULL,
  postcode      text NOT NULL,
  search_text   text GENERATED ALWAYS AS (lower(street || ' ' || house_number || ' ' || locality)) STORED,
  geom          geometry(Point, 4326) NOT NULL
);
CREATE INDEX IF NOT EXISTS addresses_geom_idx ON addresses USING gist (geom);
CREATE INDEX IF NOT EXISTS addresses_search_idx ON addresses USING gin (search_text gin_trgm_ops);
CREATE INDEX IF NOT EXISTS addresses_parcel_idx ON addresses (parcel_id);

CREATE TABLE IF NOT EXISTS announcements (
  id               serial PRIMARY KEY,
  dataset_version  text NOT NULL,
  kind             text NOT NULL,
  title            text NOT NULL,
  properties       jsonb NOT NULL DEFAULT '{}',
  published_at     timestamptz NOT NULL DEFAULT now(),
  geom             geometry(Geometry, 4326) NOT NULL
);
CREATE INDEX IF NOT EXISTS announcements_geom_idx ON announcements USING gist (geom);
CREATE INDEX IF NOT EXISTS announcements_version_idx ON announcements (published_at DESC, dataset_version);

CREATE TABLE IF NOT EXISTS planning_drafts (
  id          serial PRIMARY KEY,
  title       text NOT NULL,
  status      text NOT NULL,
  notes       text NOT NULL,
  geom        geometry(Polygon, 4326) NOT NULL
);
CREATE INDEX IF NOT EXISTS planning_drafts_geom_idx ON planning_drafts USING gist (geom);
