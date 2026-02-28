/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testMatch: ['**/__tests__/e2e/**/*.e2e.test.ts'],
  clearMocks: true,

  // Runs in each worker process BEFORE any module is imported.
  // Sets DATABASE_URL to the test database so lib/db.ts picks it up
  // before dotenv can override it.
  setupFiles: ['<rootDir>/src/__tests__/e2e/setup.ts'],

  globalSetup: '<rootDir>/src/__tests__/e2e/globalSetup.js',
  globalTeardown: '<rootDir>/src/__tests__/e2e/globalTeardown.js',

  moduleNameMapper: {
    // uuid v13+ ships ESM-only — replace with a CJS stub using crypto.randomUUID
    // so real UUIDs are generated (unlike the deterministic unit-test stub).
    '^uuid$': '<rootDir>/src/__mocks__/uuid.real.js',
  },

  // Allow more time per test since they hit a real database.
  testTimeout: 15000,
}
