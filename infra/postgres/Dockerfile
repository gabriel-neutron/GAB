# PostgreSQL 17 with both extensions the project needs.
#
# No published image carries PostGIS and pgvector together, so this image adds the
# second one to the first. See docs/adr/0002-local-runtime.md.
#
# Proven on 7 August 2026: PostgreSQL 17.5, PostGIS 3.5.2, pgvector 0.8.6.
FROM postgis/postgis:17-3.5

# The base is Debian bullseye, which is end of life. The pgdg repository moved the bullseye packages
# to the archive host, so the live host has no Release file for them.
RUN sed -i 's#http://apt.postgresql.org/pub/repos/apt/#http://apt-archive.postgresql.org/pub/repos/apt/#' /etc/apt/sources.list.d/pgdg.list \
 && apt-get update \
 && apt-get install -y --no-install-recommends postgresql-17-pgvector \
 && rm -rf /var/lib/apt/lists/*
