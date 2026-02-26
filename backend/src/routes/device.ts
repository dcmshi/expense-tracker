import { Router } from 'express'
import { z } from 'zod'
import { validate } from '../middleware/validate'
import { setToken } from '../services/notificationService'

const router = Router()

const deviceTokenSchema = z.object({
  token: z.string().min(1, 'token is required'),
})

// PUT /device-token — register or update the Expo push token for this device.
router.put('/', validate(deviceTokenSchema), (req, res) => {
  setToken(req.body.token)
  res.status(204).send()
})

export default router
