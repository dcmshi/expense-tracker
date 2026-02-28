// Runs in each Jest worker process BEFORE any module is imported (via setupFiles).
// By setting DATABASE_URL here, lib/db.ts will connect to the test database.
// dotenv (imported inside lib/db.ts) will not override an already-set env var.
process.env.DATABASE_URL =
  'postgresql://expense_user:expense_pass@localhost:5432/expense_tracker_test?schema=public'
