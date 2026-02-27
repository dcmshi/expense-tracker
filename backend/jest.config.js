/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testMatch: ['**/__tests__/**/*.test.ts'],
  clearMocks: true,
  // Map infrastructure modules to lightweight mocks so tests never
  // attempt a real DB or S3 connection.
  moduleNameMapper: {
    '^.+/lib/db$': '<rootDir>/src/__mocks__/db.ts',
    '^.+/lib/s3$': '<rootDir>/src/__mocks__/s3.ts',
    // uuid v13+ ships ESM-only — replace with a CommonJS stub for Jest
    '^uuid$': '<rootDir>/src/__mocks__/uuid.js',
  },
}
