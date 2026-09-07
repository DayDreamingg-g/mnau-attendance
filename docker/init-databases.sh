#!/bin/sh
set -eu
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname postgres \
  -v app_password="$APP_DB_PASSWORD" -v n8n_password="$N8N_DB_PASSWORD" <<'SQL'
CREATE ROLE attendance_app LOGIN PASSWORD :'app_password' NOSUPERUSER NOCREATEDB NOCREATEROLE;
CREATE ROLE n8n_app LOGIN PASSWORD :'n8n_password' NOSUPERUSER NOCREATEDB NOCREATEROLE;
CREATE DATABASE mnau_attendance OWNER attendance_app;
CREATE DATABASE mnau_n8n OWNER n8n_app;
REVOKE ALL ON DATABASE mnau_attendance FROM PUBLIC;
REVOKE ALL ON DATABASE mnau_n8n FROM PUBLIC;
GRANT CONNECT ON DATABASE mnau_attendance TO attendance_app;
GRANT CONNECT ON DATABASE mnau_n8n TO n8n_app;
\connect mnau_attendance
REVOKE CREATE ON SCHEMA public FROM PUBLIC;
ALTER SCHEMA public OWNER TO attendance_app;
\connect mnau_n8n
REVOKE CREATE ON SCHEMA public FROM PUBLIC;
ALTER SCHEMA public OWNER TO n8n_app;
SQL
