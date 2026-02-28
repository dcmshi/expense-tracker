import express from 'express'
import { errorHandler } from '../../middleware/errorHandler'
import expensesRouter from '../../routes/expenses'
import uploadsRouter from '../../routes/uploads'
import ingestRouter from '../../routes/ingest'
import analyticsRouter from '../../routes/analytics'
import deviceRouter from '../../routes/device'
import prisma from '../../lib/db'

/** Full Express app wired with all production routes — same as app.ts. */
export function createApp() {
  const app = express()
  app.use(express.json())
  app.use('/expenses', expensesRouter)
  app.use('/uploads', uploadsRouter)
  app.use('/ingest', ingestRouter)
  app.use('/analytics', analyticsRouter)
  app.use('/device-token', deviceRouter)
  app.use(errorHandler)
  return app
}

/** Delete all rows in FK-safe order between tests. */
export async function truncateAll() {
  await prisma.processingJob.deleteMany()
  await prisma.expense.deleteMany()
  await prisma.upload.deleteMany()
}
