// ocrClient.ts — Google Vision API wrapper for receipt OCR.
//
// Uses the REST API (TEXT_DETECTION) with a base64-encoded image payload.
// Returns the full concatenated text string from the first annotation,
// which is the complete raw OCR output of the image.

import { VISION_API_KEY, VISION_API_URL } from '../lib/vision'
import { GetObjectCommand } from '@aws-sdk/client-s3'
import s3, { S3_BUCKET } from '../lib/s3'

// ---------------------------------------------------------------------------
// S3 image fetching
// ---------------------------------------------------------------------------

export async function fetchImageFromS3(objectKey: string): Promise<Buffer> {
  const response = await s3.send(
    new GetObjectCommand({ Bucket: S3_BUCKET, Key: objectKey }),
  )

  if (!response.Body) {
    throw new Error(`S3 returned empty body for key: ${objectKey}`)
  }

  const chunks: Buffer[] = []
  for await (const chunk of response.Body as AsyncIterable<Uint8Array>) {
    chunks.push(Buffer.from(chunk))
  }
  return Buffer.concat(chunks)
}

// ---------------------------------------------------------------------------
// Vision API — TEXT_DETECTION
// ---------------------------------------------------------------------------

interface VisionResponse {
  responses: Array<{
    textAnnotations?: Array<{ description: string }>
    error?: { code: number; message: string }
  }>
}

export async function extractOcrText(imageBuffer: Buffer): Promise<string> {
  if (!VISION_API_KEY) {
    throw new Error('GOOGLE_VISION_API_KEY is not configured')
  }

  const body = JSON.stringify({
    requests: [{
      image:    { content: imageBuffer.toString('base64') },
      features: [{ type: 'TEXT_DETECTION' }],
    }],
  })

  const res = await fetch(`${VISION_API_URL}?key=${VISION_API_KEY}`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body,
  })

  if (!res.ok) {
    throw new Error(`Vision API HTTP error: ${res.status} ${res.statusText}`)
  }

  const data = (await res.json()) as VisionResponse
  const response = data.responses[0]

  if (response?.error) {
    throw new Error(`Vision API error ${response.error.code}: ${response.error.message}`)
  }

  const annotations = response?.textAnnotations
  if (!annotations || annotations.length === 0) {
    throw new Error('Vision API returned no text — image may be unreadable')
  }

  // The first annotation contains the full concatenated text of the image.
  return annotations[0].description
}
