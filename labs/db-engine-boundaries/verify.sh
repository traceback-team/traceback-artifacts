#!/bin/sh
set -eu

project_dir=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
cd "$project_dir"

echo '## Container images and health'
docker compose ps
docker image inspect postgres:18 mysql:8.4 \
  --format '{{index .RepoTags 0}}|{{.Id}}|{{join .RepoDigests ","}}'

echo
echo '## PostgreSQL: version, process, access methods, table binding, physical path'
docker compose exec -T postgres psql -X -U lab -d engine_lab -v ON_ERROR_STOP=1 <<'SQL'
SELECT version();
SELECT pg_backend_pid() AS current_backend_pid;
SHOW default_table_access_method;
SELECT amname, amtype, amhandler::regproc AS handler
FROM pg_am
ORDER BY amtype, amname;
SELECT c.relname, am.amname AS table_access_method
FROM pg_class AS c
JOIN pg_am AS am ON am.oid = c.relam
WHERE c.oid = 'accounts'::regclass;
SELECT pg_relation_filepath('accounts') AS accounts_relation_file;
SELECT backend_type, count(*)
FROM pg_stat_activity
GROUP BY backend_type
ORDER BY backend_type;
SQL
docker compose exec -T postgres sh -c "printf 'pid1='; tr '\000' ' ' </proc/1/cmdline; printf '\n'; find /var/lib/postgresql -type d -name pg_wal -print"

echo
echo '## MySQL: version, process, engines, table binding, physical path'
docker compose exec -T mysql mysql -uroot -plab-mysql-root --batch --raw <<'SQL'
SELECT VERSION() AS version, @@default_storage_engine AS default_storage_engine, @@datadir AS data_directory;
SHOW ENGINES;
SELECT TABLE_SCHEMA, TABLE_NAME, ENGINE
FROM information_schema.TABLES
WHERE TABLE_SCHEMA = 'engine_lab' AND TABLE_NAME = 'accounts';
DROP TABLE IF EXISTS engine_lab.engine_switch_probe;
CREATE TABLE engine_lab.engine_switch_probe (id integer PRIMARY KEY) ENGINE=InnoDB;
SELECT TABLE_NAME, ENGINE FROM information_schema.TABLES
WHERE TABLE_SCHEMA = 'engine_lab' AND TABLE_NAME = 'engine_switch_probe';
ALTER TABLE engine_lab.engine_switch_probe ENGINE=MyISAM;
SELECT TABLE_NAME, ENGINE FROM information_schema.TABLES
WHERE TABLE_SCHEMA = 'engine_lab' AND TABLE_NAME = 'engine_switch_probe';
DROP TABLE engine_lab.engine_switch_probe;
SELECT PLUGIN_NAME, PLUGIN_STATUS, PLUGIN_TYPE, PLUGIN_LIBRARY
FROM information_schema.PLUGINS
WHERE PLUGIN_TYPE = 'STORAGE ENGINE'
ORDER BY PLUGIN_NAME;
SELECT TYPE, COUNT(*) AS thread_count
FROM performance_schema.threads
GROUP BY TYPE
ORDER BY TYPE;
SELECT NAME
FROM performance_schema.threads
WHERE NAME LIKE 'thread/innodb/%'
ORDER BY NAME
LIMIT 12;
SQL
docker compose exec -T mysql sh -c "printf 'pid1='; tr '\000' ' ' </proc/1/cmdline; printf '\n'; find /var/lib/mysql/engine_lab -maxdepth 1 -type f -print | sort"
