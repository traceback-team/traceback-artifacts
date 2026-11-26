#!/bin/sh
set -eu

lab_dir=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
cd "$lab_dir"

docker compose build client
docker compose up -d --wait mongo

echo '## Runtime images and versions'
docker compose ps
docker image inspect mongo:7.0.41-jammy \
  --format '{{index .RepoTags 0}}|{{.Id}}|{{join .RepoDigests ","}}'

echo
echo '## Driver boundary, query plan, and transaction'
docker compose run --rm client

echo
echo '## MongoDB server, storage engine, cache, and transaction metrics'
docker compose exec -T mongo mongosh --quiet --eval '
const status = db.serverStatus();
const build = db.adminCommand({buildInfo: 1});
printjson({
  version: build.version,
  gitVersion: build.gitVersion,
  modules: build.modules,
  storageEngine: status.storageEngine,
  wiredTigerCache: {
    maximumBytes: status.wiredTiger.cache["maximum bytes configured"],
    bytesInCache: status.wiredTiger.cache["bytes currently in the cache"],
    pagesRead: status.wiredTiger.cache["pages read into cache"],
    pagesWritten: status.wiredTiger.cache["pages written from cache"]
  },
  transactionMetrics: status.transactions
});'

echo
echo '## Logical metadata and index definitions'
docker compose exec -T mongo mongosh --quiet architecture_lab --eval '
const stats = db.orders.stats({scale: 1});
printjson({collections: db.getCollectionInfos().map(info => ({name: info.name, options: info.options}))});
printjson({ordersIndexes: db.orders.getIndexes()});
printjson({ordersStorage: {
  count: stats.count,
  logicalDataBytes: stats.size,
  allocatedStorageBytes: stats.storageSize,
  totalIndexBytes: stats.totalIndexSize,
  indexSizes: stats.indexSizes,
  wiredTigerCreationString: stats.wiredTiger.creationString
}});'

echo
echo '## Physical WiredTiger and journal files'
docker compose exec -T mongo sh -c \
  "find /data/db -maxdepth 2 -type f -printf '%P|%s bytes\\n' | sort"
