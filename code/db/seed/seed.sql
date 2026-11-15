-- Deterministic seed for the Republic of Veloria (fictional).
-- Extent: lon 2.0..6.0, lat -44.0..-40.0 (EPSG:4326).
-- Re-running produces identical data: fixed setseed() and a serial plan.

\set ON_ERROR_STOP on
SET max_parallel_workers_per_gather = 0;
SET client_min_messages = warning;

BEGIN;

TRUNCATE layer_shares, layers, partners, users, addresses, parcels,
         admin_boundaries, planning_drafts, announcements RESTART IDENTITY CASCADE;

SELECT setseed(0.42);

-- Users and partners ---------------------------------------------------------

INSERT INTO users (username, display_name) VALUES
  ('alice', 'Alice Marren (Urban Planning)'),
  ('bob',   'Bob Teslov (Urban Planning)');

INSERT INTO partners (name, api_key_hash, created_at) VALUES
  ('Velorian Transit Co.', encode(sha256(convert_to('velt-transit-2b81c4e9d7a6f350', 'UTF8')), 'hex'), now() - interval '400 days'),
  ('PitLane Live',         encode(sha256(convert_to('pitlane-live-91d0a3f5e2c8b764', 'UTF8')), 'hex'), now() - interval '9 days');

-- Layer catalogue -----------------------------------------------------------

INSERT INTO layers (id, title, geometry_type, is_public, owner) VALUES
  ('parcels',          'Land parcels',               'Polygon',      true,  NULL),
  ('addresses',        'Addresses',                  'Point',        true,  NULL),
  ('admin_boundaries', 'Administrative districts',   'MultiPolygon', true,  NULL),
  ('announcements',    'Official announcements',     'Geometry',     true,  NULL),
  ('planning_drafts',  'Planning drafts (internal)', 'Polygon',      false, 'alice');

INSERT INTO layer_shares (layer_id, username) VALUES ('planning_drafts', 'bob');

-- Administrative districts: 10 x 5 grid of 0.4 x 0.8 degree cells ------------
-- Rows 0..4 run south to north. Four northern coastal districts follow the
-- surveyed coastline; the rest use their cadastral rectangles.

CREATE TEMP TABLE district_names AS
SELECT row_number() OVER () - 1 AS idx, name
FROM unnest(ARRAY[
  'Avelmar','Brisca','Caldero','Dunmere','Estrela','Faroun','Galvia','Hestor','Ilmara','Jorvik',
  'Kestra','Lunavel','Mirador','Norvane','Ostrell','Palvera','Quillon','Rosmar','Sablon','Tarvos',
  'Ulmira','Valdora','Westrel','Xandor','Yselle','Zarvik','Altamar','Beloria','Corvane','Delmont',
  'Elvaro','Fenwick','Grenmar','Halvory','Isteria','Jasmont','Korvel','Lindara','Marrow','Nesta',
  'Orvell','Portavel','Ravenna','Selmont','Tollara','Umbrin','Varos','Wyncrest','Yarrow','Zennor'
]) AS name;

CREATE TEMP TABLE district_cells AS
SELECT r * 10 + c AS idx, r, c,
       2.0 + c * 0.4 AS minx, -44.0 + r * 0.8 AS miny,
       (r = 4 AND c BETWEEN 3 AND 6) AS coastal
FROM generate_series(0, 4) r, generate_series(0, 9) c;

INSERT INTO admin_boundaries (name, region, population, geom)
SELECT n.name,
       (ARRAY['South','South Central','Central','North Central','North'])[d.r + 1],
       20000 + floor(random() * 180000)::int,
       ST_Multi(ST_MakeEnvelope(d.minx, d.miny, d.minx + 0.4, d.miny + 0.8, 4326))
FROM district_cells d JOIN district_names n USING (idx)
WHERE NOT d.coastal
ORDER BY d.idx;

-- Coastline: star-shaped ring around the cell centre, radius modulated by
-- several harmonics (always > 0, so the ring never self-intersects).
INSERT INTO admin_boundaries (name, region, population, geom)
SELECT n.name, 'North', 60000 + d.c * 9000,
       ST_Multi(ST_MakePolygon(ST_AddPoint(ring.line, ST_StartPoint(ring.line))))
FROM district_cells d
JOIN district_names n USING (idx)
CROSS JOIN LATERAL (
  SELECT ST_MakeLine(
           ST_SetSRID(ST_MakePoint(
             d.minx + 0.2 + 0.2 * rr * cos(t),
             d.miny + 0.4 + 0.4 * rr * sin(t)), 4326)
           ORDER BY i) AS line
  FROM (
    SELECT i, t,
           0.80 + 0.07 * sin(37 * t + d.c)
                + 0.04 * sin(211 * t + 2 * d.c)
                + 0.025 * sin(1499 * t + d.c)
                + 0.012 * sin(9973 * t) AS rr
    FROM (
      SELECT i, 2 * pi() * i / v.n AS t
      FROM (SELECT 150000 + (d.c - 3) * 50000 AS n) v,
           generate_series(0, v.n - 1) i
    ) s
  ) pts
) ring
WHERE d.coastal
ORDER BY d.idx;

-- Parcels: 250 x 200 grid, each a jittered quadrilateral inside its cell ----

INSERT INTO parcels (parcel_code, land_use, area_m2, geom)
SELECT format('VL-%s-%s', lpad(gy::text, 3, '0'), lpad(gx::text, 3, '0')),
       (ARRAY['residential','residential','residential','commercial','industrial',
              'agricultural','agricultural','park','public','mixed'])[1 + floor(random() * 10)::int],
       0,
       ST_SetSRID(ST_MakePolygon(ST_MakeLine(ARRAY[
         ST_MakePoint(x0 + dx * (0.05 + j[1] * 0.15), y0 + dy * (0.05 + j[2] * 0.15)),
         ST_MakePoint(x0 + dx * (0.80 + j[3] * 0.15), y0 + dy * (0.05 + j[4] * 0.15)),
         ST_MakePoint(x0 + dx * (0.80 + j[5] * 0.15), y0 + dy * (0.80 + j[6] * 0.15)),
         ST_MakePoint(x0 + dx * (0.05 + j[7] * 0.15), y0 + dy * (0.80 + j[8] * 0.15)),
         ST_MakePoint(x0 + dx * (0.05 + j[1] * 0.15), y0 + dy * (0.05 + j[2] * 0.15))
       ])), 4326)
FROM (
  SELECT gx, gy, 0.016 AS dx, 0.02 AS dy, 2.0 + gx * 0.016 AS x0, -44.0 + gy * 0.02 AS y0,
         ARRAY[random(), random(), random(), random(), random(), random(), random(), random()] AS j
  FROM generate_series(0, 199) gy, generate_series(0, 249) gx
  ORDER BY gy, gx
) g;

UPDATE parcels SET area_m2 = round(ST_Area(geom::geography)::numeric, 1);

-- Addresses: two per parcel ------------------------------------------------

CREATE TEMP TABLE street_names AS
SELECT row_number() OVER () - 1 AS idx, name
FROM unnest(ARRAY[
  'Olive','Harbour','Market','Chapel','Mill','Station','Garden','Quarry','Lantern','Cedar',
  'Fountain','Bridge','Orchard','Saltmarsh','Copper','Signal','Meadow','Granary','Beacon','Willow',
  'Circuit','Grandstand','Chicane','Paddock','Hairpin','Tannery','Weaver','Foundry','Ropewalk','Clocktower',
  'Juniper','Heron','Kiln','Lighthouse','Vineyard','Pottery','Dockside','Almond','Sundial','Bellfounder'
]) AS name;

INSERT INTO addresses (parcel_id, house_number, street, locality, postcode, geom)
SELECT p.id,
       1 + floor(random() * 240)::int,
       s.name || (ARRAY[' Street',' Road',' Lane',' Avenue',' Way'])[1 + (p.id + k) % 5],
       dn.name,
       format('VL%s%s %s', cell_r, cell_c, lpad(((p.id * 7 + k) % 1000)::text, 3, '0')),
       pt.geom
FROM parcels p
CROSS JOIN generate_series(0, 1) k
CROSS JOIN LATERAL (
  SELECT ST_SetSRID(ST_MakePoint(
           ST_XMin(p.geom) + (ST_XMax(p.geom) - ST_XMin(p.geom)) * (0.35 + random() * 0.3),
           ST_YMin(p.geom) + (ST_YMax(p.geom) - ST_YMin(p.geom)) * (0.35 + random() * 0.3)), 4326) AS geom
) pt
CROSS JOIN LATERAL (
  SELECT least(4, floor((ST_Y(pt.geom) + 44.0) / 0.8))::int AS cell_r,
         least(9, floor((ST_X(pt.geom) - 2.0) / 0.4))::int AS cell_c
) cell
JOIN district_names dn ON dn.idx = cell.cell_r * 10 + cell.cell_c
JOIN street_names s ON s.idx = (p.id * 13 + k * 7) % 40
ORDER BY p.id, k;

-- Planning drafts (private to alice, shared with bob) ------------------------

INSERT INTO planning_drafts (title, status, notes, geom)
VALUES ('Grandstand east access widening', 'draft',
        'Compulsory purchase of 4 frontages under review; owners not yet notified.',
        ST_MakeEnvelope(4.095, -42.105, 4.110, -42.090, 4326));

INSERT INTO planning_drafts (title, status, notes, geom)
SELECT format('Draft proposal %s', i),
       (ARRAY['draft','in review','on hold'])[1 + i % 3],
       'Internal working copy. Not for publication.',
       ST_MakeEnvelope(cx, cy, cx + 0.01 + random() * 0.02, cy + 0.01 + random() * 0.02, 4326)
FROM (
  SELECT i, 2.1 + random() * 3.7 AS cx, -43.9 + random() * 3.7 AS cy
  FROM generate_series(1, 39) i
  ORDER BY i
) d;

COMMIT;

ANALYZE;

SELECT 'admin_boundaries' AS layer, count(*) AS rows, sum(ST_NPoints(geom)) AS vertices FROM admin_boundaries
UNION ALL SELECT 'parcels', count(*), sum(ST_NPoints(geom)) FROM parcels
UNION ALL SELECT 'addresses', count(*), count(*) FROM addresses
UNION ALL SELECT 'planning_drafts', count(*), sum(ST_NPoints(geom)) FROM planning_drafts;
