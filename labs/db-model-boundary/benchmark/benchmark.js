'use strict';

const { performance } = require('node:perf_hooks');
const { writeFileSync } = require('node:fs');
const { Client } = require('pg');
const { MongoClient } = require('mongodb');

const orderCount = Number(process.env.ORDER_COUNT ?? 30000);
const itemsPerOrder = Number(process.env.ITEMS_PER_ORDER ?? 5);
const readIterations = Number(process.env.READ_ITERATIONS ?? 100);
const writeIterations = Number(process.env.WRITE_ITERATIONS ?? 50);
const seed = 20261120;
const statuses = ['PENDING', 'PAID', 'SHIPPED'];

function orderFor(id) {
  const items = [];
  let total = 0;
  for (let line = 1; line <= itemsPerOrder; line += 1) {
    const unitPrice = 1000 + ((id * 31 + line * 97 + seed) % 50000);
    const quantity = 1 + ((id + line) % 3);
    const item = {
      lineNo: line,
      sku: `SKU-${String((id * 7 + line * 13) % 2000).padStart(4, '0')}`,
      quantity,
      unitPrice
    };
    items.push(item);
    total += quantity * unitPrice;
  }
  return {
    _id: id,
    customerId: 1 + (id % 1000),
    status: statuses[id % statuses.length],
    shippingAddress: {
      city: ['Seoul', 'Busan', 'Incheon', 'Daegu'][id % 4],
      postalCode: String(10000 + (id % 80000)).padStart(5, '0')
    },
    items,
    total
  };
}

function percentile(sorted, fraction) {
  return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * fraction))];
}

async function measure(fn, iterations, warmups = 10) {
  for (let i = 0; i < warmups; i += 1) await fn(i);
  const samples = [];
  for (let i = 0; i < iterations; i += 1) {
    const started = performance.now();
    await fn(i);
    samples.push(performance.now() - started);
  }
  samples.sort((a, b) => a - b);
  return {
    iterations,
    medianMs: Number(percentile(samples, 0.5).toFixed(3)),
    p95Ms: Number(percentile(samples, 0.95).toFixed(3)),
    minMs: Number(samples[0].toFixed(3)),
    maxMs: Number(samples.at(-1).toFixed(3))
  };
}

async function measureMongoReadBoundary(mongo, readFn, iterations = 5000) {
  const admin = mongo.db('admin');
  for (let i = 0; i < 200; i += 1) await readFn();
  const before = (await admin.command({ serverStatus: 1 })).opLatencies.reads;
  const started = performance.now();
  for (let i = 0; i < iterations; i += 1) await readFn();
  const clientElapsedMs = performance.now() - started;
  const after = (await admin.command({ serverStatus: 1 })).opLatencies.reads;
  const serverOperations = Number(after.ops) - Number(before.ops);
  const serverLatencyMicros = Number(after.latency) - Number(before.latency);
  const clientAverageMs = clientElapsedMs / iterations;
  const serverAverageMs = serverLatencyMicros / serverOperations / 1000;
  return {
    iterations,
    serverOperations,
    clientAverageMs: Number(clientAverageMs.toFixed(6)),
    serverAverageMs: Number(serverAverageMs.toFixed(6)),
    outsideServerAverageMs: Number((clientAverageMs - serverAverageMs).toFixed(6)),
    outsideServerSharePercent: Number((((clientAverageMs - serverAverageMs) / clientAverageMs) * 100).toFixed(1)),
    method: 'Client wall time compared with MongoDB serverStatus.opLatencies.reads delta'
  };
}

function pgPlanSummary(planResult) {
  const root = planResult.rows[0]['QUERY PLAN'][0];
  const nodes = [];
  const visit = node => {
    nodes.push({
      nodeType: node['Node Type'],
      relation: node['Relation Name'] ?? null,
      index: node['Index Name'] ?? null,
      actualRows: node['Actual Rows'] ?? null,
      loops: node['Actual Loops'] ?? null,
      sharedHit: node['Shared Hit Blocks'] ?? 0,
      sharedRead: node['Shared Read Blocks'] ?? 0,
      walRecords: node['WAL Records'] ?? 0,
      walBytes: node['WAL Bytes'] ?? 0
    });
    for (const child of node.Plans ?? []) visit(child);
  };
  visit(root.Plan);
  return {
    planningMs: root['Planning Time'],
    executionMs: root['Execution Time'],
    nodes
  };
}

function mongoPlanSummary(explain) {
  const text = JSON.stringify(explain.queryPlanner.winningPlan);
  const stages = [...text.matchAll(/"stage":"([A-Z0-9_]+)"/g)].map(match => match[1]);
  return {
    stages: [...new Set(stages)],
    indexNames: ['_id_', 'customer_status', 'items_sku'].filter(name => text.includes(name)),
    nReturned: explain.executionStats.nReturned,
    keysExamined: explain.executionStats.totalKeysExamined,
    docsExamined: explain.executionStats.totalDocsExamined,
    executionTimeMillis: explain.executionStats.executionTimeMillis
  };
}

async function setupPostgres(pg) {
  await pg.query(`
    DROP TABLE IF EXISTS order_items_norm, order_shipping_norm, orders_norm, orders_jsonb CASCADE;
    CREATE TABLE orders_norm (
      id bigint PRIMARY KEY,
      customer_id integer NOT NULL,
      status text NOT NULL CHECK (status IN ('PENDING','PAID','SHIPPED')),
      total integer NOT NULL CHECK (total >= 0)
    );
    CREATE TABLE order_shipping_norm (
      order_id bigint PRIMARY KEY REFERENCES orders_norm(id) ON DELETE CASCADE,
      city text NOT NULL,
      postal_code text NOT NULL
    );
    CREATE TABLE order_items_norm (
      order_id bigint NOT NULL REFERENCES orders_norm(id) ON DELETE CASCADE,
      line_no integer NOT NULL,
      sku text NOT NULL,
      quantity integer NOT NULL CHECK (quantity > 0),
      unit_price integer NOT NULL CHECK (unit_price >= 0),
      PRIMARY KEY (order_id, line_no)
    );
    CREATE INDEX norm_customer_status ON orders_norm(customer_id, status);
    CREATE INDEX norm_items_sku ON order_items_norm(sku, order_id);

    CREATE TABLE orders_jsonb (
      id bigint PRIMARY KEY,
      doc jsonb NOT NULL
    );
    CREATE INDEX jsonb_customer_status ON orders_jsonb (
      ((doc->>'customerId')::integer), (doc->>'status')
    );
    CREATE INDEX jsonb_items_gin ON orders_jsonb USING gin ((doc->'items') jsonb_path_ops);
  `);

  const batchSize = 500;
  for (let start = 1; start <= orderCount; start += batchSize) {
    const ids = [], customers = [], states = [], totals = [], cities = [], postals = [], docs = [];
    const itemOrderIds = [], lines = [], skus = [], quantities = [], prices = [];
    const end = Math.min(orderCount, start + batchSize - 1);
    for (let id = start; id <= end; id += 1) {
      const order = orderFor(id);
      ids.push(id);
      customers.push(order.customerId);
      states.push(order.status);
      totals.push(order.total);
      cities.push(order.shippingAddress.city);
      postals.push(order.shippingAddress.postalCode);
      docs.push(JSON.stringify({
        customerId: order.customerId,
        status: order.status,
        shippingAddress: order.shippingAddress,
        items: order.items,
        total: order.total
      }));
      for (const item of order.items) {
        itemOrderIds.push(id);
        lines.push(item.lineNo);
        skus.push(item.sku);
        quantities.push(item.quantity);
        prices.push(item.unitPrice);
      }
    }
    await pg.query('BEGIN');
    try {
      await pg.query('INSERT INTO orders_norm SELECT * FROM unnest($1::bigint[], $2::int[], $3::text[], $4::int[])', [ids, customers, states, totals]);
      await pg.query('INSERT INTO order_shipping_norm SELECT * FROM unnest($1::bigint[], $2::text[], $3::text[])', [ids, cities, postals]);
      await pg.query('INSERT INTO order_items_norm SELECT * FROM unnest($1::bigint[], $2::int[], $3::text[], $4::int[], $5::int[])', [itemOrderIds, lines, skus, quantities, prices]);
      await pg.query('INSERT INTO orders_jsonb SELECT * FROM unnest($1::bigint[], $2::jsonb[])', [ids, docs]);
      await pg.query('COMMIT');
    } catch (error) {
      await pg.query('ROLLBACK');
      throw error;
    }
    if (start % 5000 === 1) console.log(JSON.stringify({ progress: 'postgres-load', inserted: end }));
  }
  await pg.query('VACUUM (ANALYZE) orders_norm');
  await pg.query('VACUUM (ANALYZE) order_shipping_norm');
  await pg.query('VACUUM (ANALYZE) order_items_norm');
  await pg.query('VACUUM (ANALYZE) orders_jsonb');
  await pg.query('CHECKPOINT');
}

async function setupMongo(mongo) {
  const db = mongo.db('model_lab');
  await db.dropDatabase();
  await db.createCollection('orders');
  const orders = db.collection('orders');
  await orders.createIndex({ customerId: 1, status: 1 }, { name: 'customer_status' });
  await orders.createIndex({ 'items.sku': 1 }, { name: 'items_sku' });
  const batchSize = 1000;
  for (let start = 1; start <= orderCount; start += batchSize) {
    const documents = [];
    const end = Math.min(orderCount, start + batchSize - 1);
    for (let id = start; id <= end; id += 1) documents.push(orderFor(id));
    await orders.insertMany(documents, { ordered: true, writeConcern: { w: 'majority', j: true } });
    if (start % 5000 === 1) console.log(JSON.stringify({ progress: 'mongo-load', inserted: end }));
  }
  await db.admin().command({ fsync: 1 });
  return orders;
}

async function main() {
  const pg = new Client({ connectionString: process.env.PG_URL });
  const mongo = new MongoClient(process.env.MONGODB_URI);
  await pg.connect();
  await mongo.connect();
  try {
    const versions = {
      postgres: (await pg.query('SHOW server_version')).rows[0].server_version,
      mongo: (await mongo.db('admin').command({ buildInfo: 1 })).version,
      node: process.version,
      pgDriver: require('pg/package.json').version,
      mongoDriver: require('mongodb/package.json').version
    };
    const loadStarted = performance.now();
    await setupPostgres(pg);
    const orders = await setupMongo(mongo);
    const loadSeconds = Number(((performance.now() - loadStarted) / 1000).toFixed(2));

    const targetId = Math.min(1001, orderCount);
    const targetCustomer = orderFor(targetId).customerId;
    const targetStatus = orderFor(targetId).status;
    const targetSku = orderFor(targetId).items[1].sku;

    const normalizedRead = () => pg.query(`
      SELECT jsonb_build_object(
        '_id', o.id, 'customerId', o.customer_id, 'status', o.status,
        'shippingAddress', jsonb_build_object('city', s.city, 'postalCode', s.postal_code),
        'items', jsonb_agg(jsonb_build_object('lineNo', i.line_no, 'sku', i.sku, 'quantity', i.quantity, 'unitPrice', i.unit_price) ORDER BY i.line_no),
        'total', o.total
      ) AS doc
      FROM orders_norm o
      JOIN order_shipping_norm s ON s.order_id = o.id
      JOIN order_items_norm i ON i.order_id = o.id
      WHERE o.id = $1 GROUP BY o.id, s.city, s.postal_code`, [targetId]);
    const jsonbRead = () => pg.query('SELECT doc FROM orders_jsonb WHERE id = $1', [targetId]);
    const mongoRead = () => orders.findOne({ _id: targetId });

    const normalizedFilter = () => pg.query('SELECT id, total FROM orders_norm WHERE customer_id=$1 AND status=$2 ORDER BY id DESC LIMIT 20', [targetCustomer, targetStatus]);
    const jsonbFilter = () => pg.query("SELECT id, (doc->>'total')::int AS total FROM orders_jsonb WHERE (doc->>'customerId')::int=$1 AND doc->>'status'=$2 ORDER BY id DESC LIMIT 20", [targetCustomer, targetStatus]);
    const mongoFilter = () => orders.find({ customerId: targetCustomer, status: targetStatus }, { projection: { total: 1 } }).sort({ _id: -1 }).limit(20).toArray();

    let statusToggle = false;
    const normalizedStatusUpdate = () => pg.query('UPDATE orders_norm SET status=$1 WHERE id=$2', [(statusToggle = !statusToggle) ? 'PAID' : 'PENDING', targetId]);
    let jsonbStatusToggle = false;
    const jsonbStatusUpdate = () => pg.query("UPDATE orders_jsonb SET doc=jsonb_set(doc, '{status}', to_jsonb($1::text), false) WHERE id=$2", [(jsonbStatusToggle = !jsonbStatusToggle) ? 'PAID' : 'PENDING', targetId]);
    let mongoStatusToggle = false;
    const mongoStatusUpdate = () => orders.updateOne({ _id: targetId }, { $set: { status: (mongoStatusToggle = !mongoStatusToggle) ? 'PAID' : 'PENDING' } }, { writeConcern: { w: 'majority', j: true } });

    let qty = 1;
    const normalizedItemUpdate = () => pg.query('UPDATE order_items_norm SET quantity=$1 WHERE order_id=$2 AND line_no=2', [qty = qty === 1 ? 2 : 1, targetId]);
    let jsonbQty = 1;
    const jsonbItemUpdate = () => pg.query("UPDATE orders_jsonb SET doc=jsonb_set(doc, '{items,1,quantity}', to_jsonb($1::int), false) WHERE id=$2", [jsonbQty = jsonbQty === 1 ? 2 : 1, targetId]);
    let mongoQty = 1;
    const mongoItemUpdate = () => orders.updateOne({ _id: targetId }, { $set: { 'items.1.quantity': mongoQty = mongoQty === 1 ? 2 : 1 } }, { writeConcern: { w: 'majority', j: true } });

    const normalizedSku = () => pg.query('SELECT count(DISTINCT order_id)::int AS count FROM order_items_norm WHERE sku=$1', [targetSku]);
    const jsonbSku = () => pg.query("SELECT count(*)::int AS count FROM orders_jsonb WHERE doc->'items' @> $1::jsonb", [JSON.stringify([{ sku: targetSku }])]);
    const mongoSku = () => orders.countDocuments({ 'items.sku': targetSku });

    const latency = {
      aggregateRead: {
        normalized: await measure(normalizedRead, readIterations),
        jsonb: await measure(jsonbRead, readIterations),
        mongo: await measure(mongoRead, readIterations)
      },
      customerStatusRead: {
        normalized: await measure(normalizedFilter, readIterations),
        jsonb: await measure(jsonbFilter, readIterations),
        mongo: await measure(mongoFilter, readIterations)
      },
      statusUpdate: {
        normalized: await measure(normalizedStatusUpdate, writeIterations, 5),
        jsonb: await measure(jsonbStatusUpdate, writeIterations, 5),
        mongo: await measure(mongoStatusUpdate, writeIterations, 5)
      },
      itemUpdate: {
        normalized: await measure(normalizedItemUpdate, writeIterations, 5),
        jsonb: await measure(jsonbItemUpdate, writeIterations, 5),
        mongo: await measure(mongoItemUpdate, writeIterations, 5)
      },
      skuCount: {
        normalized: await measure(normalizedSku, readIterations),
        jsonb: await measure(jsonbSku, readIterations),
        mongo: await measure(mongoSku, readIterations)
      }
    };
    const diagnostics = {
      mongoAggregateReadBoundary: await measureMongoReadBoundary(mongo, mongoRead)
    };

    const pgNormalizedPlan = await pg.query(`EXPLAIN (ANALYZE, BUFFERS, WAL, FORMAT JSON)
      SELECT jsonb_build_object(
        '_id', o.id, 'customerId', o.customer_id, 'status', o.status,
        'shippingAddress', jsonb_build_object('city', s.city, 'postalCode', s.postal_code),
        'items', jsonb_agg(jsonb_build_object('lineNo', i.line_no, 'sku', i.sku, 'quantity', i.quantity, 'unitPrice', i.unit_price) ORDER BY i.line_no),
        'total', o.total
      ) AS doc
      FROM orders_norm o
      JOIN order_shipping_norm s ON s.order_id = o.id
      JOIN order_items_norm i ON i.order_id = o.id
      WHERE o.id = $1 GROUP BY o.id, s.city, s.postal_code`, [targetId]);
    const pgJsonbPlan = await pg.query('EXPLAIN (ANALYZE, BUFFERS, WAL, FORMAT JSON) SELECT doc FROM orders_jsonb WHERE id=$1', [targetId]);
    const pgNormalizedSkuPlan = await pg.query('EXPLAIN (ANALYZE, BUFFERS, WAL, FORMAT JSON) SELECT count(DISTINCT order_id) FROM order_items_norm WHERE sku=$1', [targetSku]);
    const pgJsonbSkuPlan = await pg.query("EXPLAIN (ANALYZE, BUFFERS, WAL, FORMAT JSON) SELECT count(*) FROM orders_jsonb WHERE doc->'items' @> $1::jsonb", [JSON.stringify([{ sku: targetSku }])]);
    const mongoReadPlan = await orders.find({ _id: targetId }).explain('executionStats');
    const mongoSkuPlan = await orders.find({ 'items.sku': targetSku }).explain('executionStats');

    await pg.query('CHECKPOINT');
    await mongo.db('admin').command({ fsync: 1 });
    const pgSizes = await pg.query(`
      SELECT model,
             sum(pg_table_size(oid))::bigint AS data_bytes,
             sum(pg_indexes_size(oid))::bigint AS index_bytes
      FROM (
        SELECT 'normalized' AS model, oid FROM pg_class WHERE relname IN ('orders_norm','order_shipping_norm','order_items_norm')
        UNION ALL
        SELECT 'jsonb' AS model, oid FROM pg_class WHERE relname='orders_jsonb'
      ) selected GROUP BY model ORDER BY model`);
    const mongoStats = await mongo.db('model_lab').command({ collStats: 'orders', scale: 1 });

    const results = {
      observedAt: new Date().toISOString(),
      versions,
      conditions: { orderCount, itemsPerOrder, readIterations, writeIterations, seed, loadSeconds, cache: 'warm', topology: 'single-node containers' },
      target: { targetId, targetCustomer, targetStatus, targetSku },
      latency,
      diagnostics,
      plans: {
        aggregateRead: {
          normalized: pgPlanSummary(pgNormalizedPlan),
          jsonb: pgPlanSummary(pgJsonbPlan),
          mongo: mongoPlanSummary(mongoReadPlan)
        },
        skuCount: {
          normalized: pgPlanSummary(pgNormalizedSkuPlan),
          jsonb: pgPlanSummary(pgJsonbSkuPlan),
          mongo: mongoPlanSummary(mongoSkuPlan)
        }
      },
      sizes: {
        postgres: Object.fromEntries(pgSizes.rows.map(row => [row.model, { dataBytes: Number(row.data_bytes), indexBytes: Number(row.index_bytes) }])),
        mongo: { dataBytes: mongoStats.storageSize, indexBytes: mongoStats.totalIndexSize, avgObjectBytes: mongoStats.avgObjSize }
      },
      limitations: [
        'Warm-cache exploratory benchmark on one Docker host; not a production capacity test.',
        'PostgreSQL and MongoDB use different drivers, wire protocols, binary formats, compression, and execution-stat units.',
        'Single-node PostgreSQL and a single-node MongoDB replica set; sharding, failover, and cross-shard work were not measured.',
        'Client latency includes each product driver and local Docker network but excludes a real application and internet network.',
        'Storage sizes reflect each engine default representation and compression and are not raw logical payload sizes.'
      ]
    };
    writeFileSync('/results/results.json', `${JSON.stringify(results, null, 2)}\n`);
    console.log(JSON.stringify({ completed: true, results: '/results/results.json', versions, conditions: results.conditions, sizes: results.sizes }));
  } finally {
    await pg.end();
    await mongo.close();
  }
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
