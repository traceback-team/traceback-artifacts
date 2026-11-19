'use strict';

const { BSON, MongoClient } = require('mongodb');
const driverVersion = require('mongodb/package.json').version;

const uri = process.env.MONGODB_URI;
const client = new MongoClient(uri, { monitorCommands: true });
const observedCommands = new Set([
  'create', 'createIndexes', 'insert', 'find', 'update',
  'commitTransaction', 'abortTransaction'
]);

client.on('commandStarted', event => {
  if (!observedCommands.has(event.commandName)) return;
  const keys = Object.keys(event.command).filter(key => !key.startsWith('$'));
  console.log(JSON.stringify({
    event: 'commandStarted',
    commandName: event.commandName,
    databaseName: event.databaseName,
    requestId: event.requestId,
    commandKeys: keys,
    hasSessionId: Boolean(event.command.lsid),
    transactionNumber: event.command.txnNumber?.toString() ?? null,
    autocommit: event.command.autocommit ?? null
  }));
});

async function waitForPrimary() {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    try {
      const hello = await client.db('admin').command({ hello: 1 });
      if (hello.isWritablePrimary) return hello;
    } catch (_) {
      // The single-node replica set can accept connections before election completes.
    }
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  throw new Error('replica set did not elect a writable primary');
}

async function main() {
  await client.connect();
  const hello = await waitForPrimary();
  const db = client.db('architecture_lab');
  await db.dropDatabase();

  const order = {
    _id: 1001,
    customerId: 7,
    status: 'PAID',
    shippingAddress: { city: 'Seoul', postalCode: '04524' },
    items: [
      { sku: 'BOOK-01', quantity: 1, unitPrice: 32000 },
      { sku: 'PEN-02', quantity: 2, unitPrice: 2500 }
    ],
    total: 37000
  };
  const bson = BSON.serialize(order);
  console.log(JSON.stringify({
    observation: 'client-object-to-bson',
    driverVersion,
    javascriptType: typeof order,
    bsonBytes: bson.length,
    bsonLengthPrefixLittleEndian: bson.readInt32LE(0),
    bsonHexPrefix: bson.subarray(0, 24).toString('hex')
  }));

  await db.createCollection('orders', {
    validator: {
      $jsonSchema: {
        bsonType: 'object',
        required: ['customerId', 'status', 'items', 'total'],
        properties: {
          customerId: { bsonType: 'int' },
          status: { enum: ['PENDING', 'PAID', 'SHIPPED'] },
          items: { bsonType: 'array', minItems: 1 },
          total: { bsonType: 'int', minimum: 0 }
        }
      }
    }
  });
  const orders = db.collection('orders');
  await orders.createIndex({ customerId: 1, status: 1 }, { name: 'customer_status' });
  await orders.insertOne(order, { writeConcern: { w: 'majority', j: true } });

  const explain = await orders.find({ customerId: 7, status: 'PAID' })
    .explain('executionStats');
  console.log(JSON.stringify({
    observation: 'query-plan',
    winningStage: explain.queryPlanner.winningPlan.queryPlan?.stage
      ?? explain.queryPlanner.winningPlan.stage,
    indexName: JSON.stringify(explain.queryPlanner.winningPlan).includes('customer_status')
      ? 'customer_status'
      : null,
    documentsExamined: explain.executionStats.totalDocsExamined,
    keysExamined: explain.executionStats.totalKeysExamined,
    returned: explain.executionStats.nReturned
  }));

  const wallets = db.collection('wallets');
  await wallets.insertMany([
    { _id: 'alice', balance: 100000 },
    { _id: 'bob', balance: 30000 }
  ]);
  const session = client.startSession();
  try {
    await session.withTransaction(async () => {
      await wallets.updateOne({ _id: 'alice' }, { $inc: { balance: -15000 } }, { session });
      await wallets.updateOne({ _id: 'bob' }, { $inc: { balance: 15000 } }, { session });
    }, {
      readConcern: { level: 'snapshot' },
      writeConcern: { w: 'majority', j: true }
    });
  } finally {
    await session.endSession();
  }
  const balances = await wallets.find({}).sort({ _id: 1 }).toArray();
  console.log(JSON.stringify({ observation: 'transaction-committed', balances }));

  console.log(JSON.stringify({
    observation: 'server-handshake',
    serverVersion: (await db.admin().serverInfo()).version,
    setName: hello.setName,
    maxBsonObjectSize: hello.maxBsonObjectSize,
    maxMessageSizeBytes: hello.maxMessageSizeBytes,
    maxWireVersion: hello.maxWireVersion
  }));
}

main()
  .catch(error => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => client.close());
