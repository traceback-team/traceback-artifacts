#!/bin/sh
set -eu

project_dir=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
cd "$project_dir"

docker compose --profile source up -d --build source-inspector
docker compose exec -T source-inspector sh -eu -c '
postgres_commit=724edf9bde9d356724ad384a2e196edc3c9f80f7
mysql_commit=8a180268d832300c09a375115dfa0ea77d83f1af

if [ ! -d /workspace/sources/postgres/.git ]; then
  git clone --depth 1 --filter=blob:none --sparse --branch REL_18_6 \
    https://github.com/postgres/postgres.git /workspace/sources/postgres
fi
git -C /workspace/sources/postgres sparse-checkout set \
  src/include/nodes src/include/access \
  src/backend/parser src/backend/rewrite src/backend/optimizer \
  src/backend/executor src/backend/storage src/backend/catalog \
  src/backend/access/table src/backend/access/index src/backend/access/heap \
  src/backend/access/nbtree src/backend/access/transam

if [ ! -d /workspace/sources/mysql/.git ]; then
  git clone --depth 1 --filter=blob:none --sparse --branch mysql-8.4.13 \
    https://github.com/mysql/mysql-server.git /workspace/sources/mysql
fi
git -C /workspace/sources/mysql sparse-checkout set \
  sql include/mysql storage/innobase/handler storage/innobase/include \
  storage/innobase/btr storage/innobase/buf storage/innobase/log \
  storage/innobase/lock storage/innobase/row storage/innobase/trx

test "$(git -C /workspace/sources/postgres rev-parse HEAD)" = "$postgres_commit"
test "$(git -C /workspace/sources/mysql rev-parse HEAD)" = "$mysql_commit"

printf "postgres=%s\n" "$(git -C /workspace/sources/postgres rev-parse HEAD)"
printf "mysql=%s\n" "$(git -C /workspace/sources/mysql rev-parse HEAD)"
'
