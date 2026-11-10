#!/bin/sh
set -eu

project_dir=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
cd "$project_dir"

docker compose --profile source exec -T source-inspector sh -eu -c '
pg=/workspace/sources/postgres
my=/workspace/sources/mysql

echo "## Checked revisions"
printf "postgres="; git -C "$pg" rev-parse HEAD
printf "mysql="; git -C "$my" rev-parse HEAD

echo
echo "## PostgreSQL source module folders"
tree -d -L 2 "$pg/src/backend" | sed "s#$pg/##"

echo
echo "## PostgreSQL tree and access-method structures"
rg -n -m 1 "typedef struct Query" "$pg/src/include/nodes/parsenodes.h"
rg -n -m 1 "typedef struct UpdateStmt" "$pg/src/include/nodes/parsenodes.h"
rg -n -m 1 "typedef struct Node" "$pg/src/include/nodes/nodes.h"
rg -n -m 1 "typedef struct Path$" "$pg/src/include/nodes/pathnodes.h"
rg -n -m 1 "typedef struct RelOptInfo" "$pg/src/include/nodes/pathnodes.h"
rg -n -m 1 "typedef struct Plan$" "$pg/src/include/nodes/plannodes.h"
rg -n -m 1 "typedef struct ModifyTable" "$pg/src/include/nodes/plannodes.h"
rg -n -m 1 "typedef struct PlanState" "$pg/src/include/nodes/execnodes.h"
rg -n -m 1 "typedef struct TableAmRoutine" "$pg/src/include/access/tableam.h"
rg -n -m 1 "typedef struct IndexAmRoutine" "$pg/src/include/access/amapi.h"
rg -n "\(\*tuple_(insert|update|delete)|\(\*scan_begin|\(\*index_fetch_begin" "$pg/src/include/access/tableam.h" | head -20
rg -n "ambuild|aminsert|ambeginscan|amgettuple|amgetbitmap" "$pg/src/include/access/amapi.h" | head -20
rg -n -m 1 "static const TableAmRoutine heapam_methods" "$pg/src/backend/access/heap/heapam_handler.c"
rg -n -m 1 "^bthandler\(" "$pg/src/backend/access/nbtree/nbtree.c"

echo
echo "## PostgreSQL access-method implementation files"
find "$pg/src/backend/access/table" "$pg/src/backend/access/index" -maxdepth 1 -type f -print | sed "s#$pg/src/backend/access/##" | sort

echo
echo "## MySQL source module folders"
find "$my/sql" -maxdepth 1 -type f -print | sed "s#$my/##" | sort | rg "(parse|optimizer|executor|handler|update|tree)" | head -80
find "$my/storage/innobase" -mindepth 1 -maxdepth 1 -type d -print | sed "s#$my/##" | sort

echo
echo "## MySQL parser, Handler API, and InnoDB adapter structures"
rg -n -m 1 "class PT_update" "$my/sql/parse_tree_nodes.h"
rg -n -m 1 "^struct handlerton \{" "$my/sql/handler.h"
rg -n -m 1 "^class handler \{" "$my/sql/handler.h"
rg -n -m 1 "class ha_innobase" "$my/storage/innobase/handler/ha_innodb.h"
rg -n "int (open|write_row|update_row|delete_row).*override" "$my/storage/innobase/handler/ha_innodb.h" | head -12

echo
echo "## UPDATE call paths across the boundaries"
rg -n -m 1 "table_tuple_update\(" "$pg/src/backend/executor/nodeModifyTable.c"
rg -n -m 1 "table->file->ha_update_row" "$my/sql/sql_update.cc"
rg -n -m 1 "int handler::ha_update_row" "$my/sql/handler.cc"
rg -n -m 1 "int ha_innobase::update_row" "$my/storage/innobase/handler/ha_innodb.cc"
'
