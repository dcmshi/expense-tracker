import { Request, Response, NextFunction } from 'express'
import { ZodSchema } from 'zod'

// Validates req.body against a Zod schema.
// On success, replaces req.body with the parsed (typed) data.
// On failure, returns 400 with flattened Zod error details.
export function validate(schema: ZodSchema) {
  return (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.body)
    if (!result.success) {
      return res.status(400).json({
        error: 'Validation error',
        details: result.error.flatten(),
      })
    }
    req.body = result.data
    next()
  }
}
