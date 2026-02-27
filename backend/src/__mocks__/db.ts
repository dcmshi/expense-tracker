// Shared in-memory Prisma mock — injected via moduleNameMapper in jest.config.js.
// $transaction calls the callback immediately with the same mock client so
// service code that wraps writes in transactions works without modification.

const prisma = {
  expense: {
    findMany:           jest.fn(),
    findUnique:         jest.fn(),
    findUniqueOrThrow:  jest.fn(),
    create:             jest.fn(),
    update:             jest.fn(),
    updateMany:         jest.fn(),
    delete:             jest.fn(),
    groupBy:            jest.fn(),
  },
  processingJob: {
    findMany:    jest.fn(),
    findUnique:  jest.fn(),
    create:      jest.fn(),
    update:      jest.fn(),
    updateMany:  jest.fn(),
  },
  upload: {
    findUnique: jest.fn(),
    create:     jest.fn(),
    update:     jest.fn(),
  },
  $queryRaw:    jest.fn(),
  $transaction: jest.fn().mockImplementation((fn: (tx: unknown) => Promise<unknown>) => fn(prisma)),
  $disconnect:  jest.fn(),
}

export default prisma
