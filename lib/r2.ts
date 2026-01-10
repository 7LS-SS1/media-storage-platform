import { S3Client, PutObjectCommand, DeleteObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3"
import { getSignedUrl } from "@aws-sdk/s3-request-presigner"

type R2Config = {
  endpoint: string
  accessKeyId: string
  secretAccessKey: string
  bucketName: string
  publicDomain?: string
}

let cachedClient: S3Client | null = null
let cachedConfig: R2Config | null = null

function getR2Config(): R2Config {
  if (cachedConfig) return cachedConfig

  const { R2_ENDPOINT, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME, R2_PUBLIC_DOMAIN } = process.env
  const missing = [
    !R2_ENDPOINT && "R2_ENDPOINT",
    !R2_ACCESS_KEY_ID && "R2_ACCESS_KEY_ID",
    !R2_SECRET_ACCESS_KEY && "R2_SECRET_ACCESS_KEY",
    !R2_BUCKET_NAME && "R2_BUCKET_NAME",
  ].filter(Boolean) as string[]

  if (missing.length > 0) {
    throw new Error(`Missing R2 configuration: ${missing.join(", ")}`)
  }

  cachedConfig = {
    endpoint: R2_ENDPOINT!,
    accessKeyId: R2_ACCESS_KEY_ID!,
    secretAccessKey: R2_SECRET_ACCESS_KEY!,
    bucketName: R2_BUCKET_NAME!,
    publicDomain: R2_PUBLIC_DOMAIN,
  }

  return cachedConfig
}

function getR2Client(config: R2Config): S3Client {
  if (cachedClient) return cachedClient
  cachedClient = new S3Client({
    region: "auto",
    endpoint: config.endpoint,
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    },
  })
  return cachedClient
}

/**
 * Upload file to Cloudflare R2
 */
export async function uploadToR2(file: Buffer, key: string, contentType: string): Promise<string> {
  const config = getR2Config()
  const command = new PutObjectCommand({
    Bucket: config.bucketName,
    Key: key,
    Body: file,
    ContentType: contentType,
  })

  await getR2Client(config).send(command)

  // Return public URL
  if (config.publicDomain) {
    return `${config.publicDomain}/${key}`
  }
  return `${config.endpoint}/${config.bucketName}/${key}`
}

export function getPublicR2Url(key: string): string {
  const config = getR2Config()
  if (config.publicDomain) {
    return `${config.publicDomain}/${key}`
  }
  return `${config.endpoint}/${config.bucketName}/${key}`
}

/**
 * Generate signed URL for direct uploads
 */
export async function getSignedUploadUrl(key: string, contentType: string, expiresIn = 900): Promise<string> {
  const config = getR2Config()
  const command = new PutObjectCommand({
    Bucket: config.bucketName,
    Key: key,
    ContentType: contentType,
  })

  return await getSignedUrl(getR2Client(config), command, { expiresIn })
}

/**
 * Delete file from R2
 */
export async function deleteFromR2(key: string): Promise<void> {
  const config = getR2Config()
  const command = new DeleteObjectCommand({
    Bucket: config.bucketName,
    Key: key,
  })

  await getR2Client(config).send(command)
}

/**
 * Generate signed URL for private videos
 */
export async function getSignedR2Url(key: string, expiresIn = 3600): Promise<string> {
  const config = getR2Config()
  const command = new GetObjectCommand({
    Bucket: config.bucketName,
    Key: key,
  })

  return await getSignedUrl(getR2Client(config), command, { expiresIn })
}

/**
 * Generate unique filename
 */
export function generateUniqueFilename(originalName: string): string {
  const timestamp = Date.now()
  const randomString = Math.random().toString(36).substring(2, 15)
  const extension = originalName.split(".").pop()
  return `videos/${timestamp}-${randomString}.${extension}`
}
