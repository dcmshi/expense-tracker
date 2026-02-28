// CJS stub for uuid v13 (ESM-only) that generates real UUIDs via Node's
// built-in crypto module. Used by e2e tests where the deterministic
// 'test-uuid-v4' stub would cause unique-constraint violations in the DB.
const { randomUUID } = require('crypto')

module.exports = { v4: () => randomUUID() }
