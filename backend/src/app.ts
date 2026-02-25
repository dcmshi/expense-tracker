import express from 'express'
import helmet from 'helmet'
import cors from 'cors'

import { errorHandler } from './middleware/errorHandler'
import expensesRouter from './routes/expenses'
import uploadsRouter from './routes/uploads'
import ingestRouter from './routes/ingest'

const app = express()

app.use(helmet())
app.use(cors())
app.use(express.json())

app.use('/expenses', expensesRouter)
app.use('/uploads', uploadsRouter)
app.use('/ingest', ingestRouter)

// Centralised error handler — must be registered last
app.use(errorHandler)

export default app
