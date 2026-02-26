import { manipulateAsync, SaveFormat } from 'expo-image-manipulator'

// Resize to max 1600 px wide and compress to ~85 % quality JPEG.
// expo-image-manipulator preserves aspect ratio when only width is given.
export async function preprocessImage(uri: string): Promise<string> {
  const result = await manipulateAsync(
    uri,
    [{ resize: { width: 1600 } }],
    { compress: 0.85, format: SaveFormat.JPEG },
  )
  return result.uri
}

// Fetch the local file as a blob then PUT it directly to S3.
export async function uploadToPresignedUrl(presignedUrl: string, imageUri: string): Promise<void> {
  const localResponse = await fetch(imageUri)
  const blob = await localResponse.blob()
  const uploadResponse = await fetch(presignedUrl, {
    method: 'PUT',
    body: blob,
    headers: { 'Content-Type': 'image/jpeg' },
  })
  if (!uploadResponse.ok) {
    throw new Error(`Storage upload failed (${uploadResponse.status})`)
  }
}
