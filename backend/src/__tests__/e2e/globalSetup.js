// Runs once before all e2e test suites in the Jest master process.
// Creates expense_tracker_test if it does not exist, then pushes the
// Prisma schema so tables are ready for the test run.

const { execSync } = require('child_process')
const { Client } = require('pg')
const path = require('path')

const TEST_DB_URL =
  'postgresql://expense_user:expense_pass@localhost:5432/expense_tracker_test?schema=public'

// backend/ is 3 levels above src/__tests__/e2e/
const BACKEND_ROOT = path.join(__dirname, '../../../')

module.exports = async function globalSetup() {
  // 1. Create test database if it doesn't already exist.
  const client = new Client({
    host: 'localhost',
    port: 5432,
    user: 'expense_user',
    password: 'expense_pass',
    database: 'expense_tracker', // connect to default DB to run CREATE DATABASE
  })

  try {
    await client.connect()
    const res = await client.query(
      "SELECT 1 FROM pg_database WHERE datname = 'expense_tracker_test'",
    )
    if (res.rows.length === 0) {
      await client.query('CREATE DATABASE expense_tracker_test')
      console.log('\n[e2e setup] Created expense_tracker_test database')
    }
  } finally {
    await client.end()
  }

  // 2. Push the Prisma schema to the test database.
  //    --accept-data-loss is safe here: test data is ephemeral.
  execSync('npx prisma db push --accept-data-loss', {
    cwd: BACKEND_ROOT,
    env: { ...process.env, DATABASE_URL: TEST_DB_URL },
    stdio: 'inherit',
  })

  console.log('[e2e setup] Schema pushed to expense_tracker_test\n')
}
