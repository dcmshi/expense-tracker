import request from 'supertest'
import express from 'express'
import deviceRouter from '../../routes/device'
import { errorHandler } from '../../middleware/errorHandler'
import * as notificationService from '../../services/notificationService'

jest.mock('../../services/notificationService', () => ({
  setToken:              jest.fn(),
  sendProcessingComplete: jest.fn(),
  sendProcessingFailed:  jest.fn(),
}))

const app = express()
app.use(express.json())
app.use('/device-token', deviceRouter)
app.use(errorHandler)

const mockSetToken = notificationService.setToken as jest.Mock

describe('PUT /device-token', () => {
  it('returns 204 and registers the push token', async () => {
    const res = await request(app)
      .put('/device-token')
      .send({ token: 'ExponentPushToken[abc123]' })
    expect(res.status).toBe(204)
    expect(mockSetToken).toHaveBeenCalledWith('ExponentPushToken[abc123]')
  })

  it('returns 400 when token is missing', async () => {
    const res = await request(app).put('/device-token').send({})
    expect(res.status).toBe(400)
  })

  it('returns 400 when token is an empty string', async () => {
    const res = await request(app).put('/device-token').send({ token: '' })
    expect(res.status).toBe(400)
  })

  it('returns 400 with no body at all', async () => {
    const res = await request(app).put('/device-token')
    expect(res.status).toBe(400)
  })
})
