// Google Vision API client
// Used by the processing worker for receipt OCR text extraction.
//
// Integration: REST API — TEXT_DETECTION feature
// Endpoint:    https://vision.googleapis.com/v1/images:annotate
// Auth:        GOOGLE_VISION_API_KEY environment variable
//
// The worker calls annotateImage() with the S3 object URL and receives
// raw OCR text, which is then passed to the receipt parser.

export const VISION_API_KEY = process.env.GOOGLE_VISION_API_KEY
export const VISION_API_URL = 'https://vision.googleapis.com/v1/images:annotate'
