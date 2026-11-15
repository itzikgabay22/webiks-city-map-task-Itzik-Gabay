# PostGIS 3.7 (PGDG, November 2026) is built against PostgreSQL 17.12.
# 17.11 fails at CREATE EXTENSION with: undefined symbol: heap_datum_check.
FROM postgres:17.12-bookworm

RUN apt-get update \
 && apt-get install -y --no-install-recommends postgresql-17-postgis-3 \
 && rm -rf /var/lib/apt/lists/*

COPY migrations/ /docker-entrypoint-initdb.d/
COPY postgres.conf /etc/postgresql/postgres.conf

CMD ["postgres", "-c", "config_file=/etc/postgresql/postgres.conf"]
