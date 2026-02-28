// Runs once after all e2e test suites.
// Each test file disconnects its own Prisma client in afterAll, so nothing
// additional is needed here.
module.exports = async function globalTeardown() {}
