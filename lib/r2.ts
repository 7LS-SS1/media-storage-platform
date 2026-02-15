import { createReadStream } from "fs"
import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  ListObjectsV2Command,
  CreateMultipartUploadCommand,
  UploadPartCommand,
  CompleteMultipartUploadCommand,
  AbortMultipartUploadCommand,
} from "@aws-sdk/client-s3"
import { getSignedUrl } from "@aws-sdk/s3-request-presigner"
import { DEFAULT_STORAGE_BUCKET, type StorageBucket } from "@/lib/storage-bucket"

type R2Config = {
  endpoint: string
  accessKeyId: string
  secretAccessKey: string
  bucketName: string
  publicDomain?: string
  keyPrefix: string
}

let cachedClient: S3Client | null = null
const cachedConfigs: Partial<Record<StorageBucket, R2Config>> = {}

function normalizeMarker(value?: string | null): string | null {
  if (!value) return null
  const normalized = value.trim().replace(/^\/+/, "").replace(/\/+$/, "").toLowerCase()
  return normalized.length > 0 ? normalized : null
}

function parseHost(value?: string | null): string | null {
  if (!value) return null
  const candidate = value.trim()
  if (!candidate) return null
  try {
    const parsed = new URL(candidate.startsWith("//") ? `https:${candidate}` : candidate)
    return parsed.host.toLowerCase()
  } catch {
    return null
  }
}

function getBucketMarkers(bucket: StorageBucket): string[] {
  const envMarkers =
    bucket === "jav"
      ? [process.env.R2_JAV_KEY_PREFIX, process.env.R2_JAV_BUCKET_NAME]
      : [process.env.R2_KEY_PREFIX, process.env.R2_BUCKET_NAME]
  const defaults = bucket === "jav" ? ["jav-storage"] : ["media-storage"]
  return Array.from(
    new Set([...envMarkers, ...defaults].map((marker) => normalizeMarker(marker)).filter(Boolean)),
  ) as string[]
}

function findMarkerPosition(path: string, marker: string): number {
  if (path === marker || path.startsWith(`${marker}/`)) return 0
  const middleToken = `/${marker}/`
  const middleIndex = path.indexOf(middleToken)
  if (middleIndex >= 0) return middleIndex + 1
  const tailToken = `/${marker}`
  if (path.endsWith(tailToken)) return path.length - marker.length
  return -1
}

function detectBucketByPath(path: string): StorageBucket | null {
  const normalizedPath = path.trim().replace(/^\/+/, "").toLowerCase()
  if (!normalizedPath) return null

  const matchPosition = (bucket: StorageBucket) => {
    const positions = getBucketMarkers(bucket)
      .map((marker) => findMarkerPosition(normalizedPath, marker))
      .filter((position) => position >= 0)
    if (positions.length === 0) return -1
    return Math.min(...positions)
  }

  const mediaPosition = matchPosition("media")
  const javPosition = matchPosition("jav")

  if (mediaPosition < 0 && javPosition < 0) return null
  if (mediaPosition >= 0 && javPosition < 0) return "media"
  if (javPosition >= 0 && mediaPosition < 0) return "jav"
  if (mediaPosition === 0 && javPosition > 0) return "jav"
  if (javPosition === 0 && mediaPosition > 0) return "media"
  return mediaPosition <= javPosition ? "media" : "jav"
}

function inferBucketFromResource(resource: string | null | undefined): StorageBucket | null {
  if (!resource) return null
  const trimmed = resource.trim()
  if (!trimmed) return null

  if (/^https?:\/\//i.test(trimmed) || trimmed.startsWith("//")) {
    try {
      const parsed = new URL(trimmed.startsWith("//") ? `https:${trimmed}` : trimmed)
      const bucketByPath = detectBucketByPath(parsed.pathname)
      if (bucketByPath) return bucketByPath

      const host = parsed.host.toLowerCase()
      const javHost = parseHost(process.env.R2_JAV_PUBLIC_DOMAIN)
      const mediaHost = parseHost(process.env.R2_PUBLIC_DOMAIN)
      if (javHost && host === javHost) return "jav"
      if (mediaHost && host === mediaHost) return "media"
      return null
    } catch {
      return detectBucketByPath(trimmed)
    }
  }

  return detectBucketByPath(trimmed)
}

function resolveBucketFromResource(
  resource: string | null | undefined,
  bucket: StorageBucket = DEFAULT_STORAGE_BUCKET,
): StorageBucket {
  return inferBucketFromResource(resource) ?? bucket
}

function isKnownR2Host(host: string | null): boolean {
  if (!host) return false
  const knownHosts = [
    parseHost(process.env.R2_PUBLIC_DOMAIN),
    parseHost(process.env.R2_JAV_PUBLIC_DOMAIN),
    parseHost(process.env.R2_ENDPOINT),
  ].filter(Boolean) as string[]
  return knownHosts.includes(host.toLowerCase())
}

function normalizeEndpoint(endpoint: string, bucketName: string): string {
  try {
    const parsed = new URL(endpoint)
    const cleanPath = parsed.pathname.replace(/\/+$/, "")
    const bucketSuffix = `/${bucketName}`.toLowerCase()
    if (cleanPath.toLowerCase().endsWith(bucketSuffix)) {
      const nextPath = cleanPath.slice(0, -bucketSuffix.length) || "/"
      parsed.pathname = nextPath
    } else {
      parsed.pathname = cleanPath || "/"
    }
    return parsed.toString().replace(/\/$/, "")
  } catch {
    return endpoint.replace(/\/+$/, "")
  }
}

function getR2Config(bucket: StorageBucket = DEFAULT_STORAGE_BUCKET): R2Config {
  if (cachedConfigs[bucket]) return cachedConfigs[bucket] as R2Config

  const { R2_ENDPOINT, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY } = process.env
  const bucketName =
    bucket === "jav" ? process.env.R2_JAV_BUCKET_NAME : process.env.R2_BUCKET_NAME
  const publicDomain =
    bucket === "jav" ? process.env.R2_JAV_PUBLIC_DOMAIN : process.env.R2_PUBLIC_DOMAIN
  const keyPrefix =
    (bucket === "jav" ? process.env.R2_JAV_KEY_PREFIX : process.env.R2_KEY_PREFIX) || bucketName

  const missing = [
    !R2_ENDPOINT && "R2_ENDPOINT",
    !R2_ACCESS_KEY_ID && "R2_ACCESS_KEY_ID",
    !R2_SECRET_ACCESS_KEY && "R2_SECRET_ACCESS_KEY",
    !bucketName && (bucket === "jav" ? "R2_JAV_BUCKET_NAME" : "R2_BUCKET_NAME"),
  ].filter(Boolean) as string[]

  if (missing.length > 0) {
    throw new Error(`Missing R2 configuration: ${missing.join(", ")}`)
  }

  const baseBucketName = process.env.R2_BUCKET_NAME ?? bucketName
  const config: R2Config = {
    endpoint: normalizeEndpoint(R2_ENDPOINT!, baseBucketName!),
    accessKeyId: R2_ACCESS_KEY_ID!,
    secretAccessKey: R2_SECRET_ACCESS_KEY!,
    bucketName: bucketName!,
    publicDomain: publicDomain,
    keyPrefix: keyPrefix!,
  }

  cachedConfigs[bucket] = config
  return config
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
export async function uploadToR2(
  file: Buffer,
  key: string,
  contentType: string,
  bucket: StorageBucket = DEFAULT_STORAGE_BUCKET,
): Promise<string> {
  const config = getR2Config(bucket)
  const command = new PutObjectCommand({
    Bucket: config.bucketName,
    Key: key,
    Body: file,
    ContentType: contentType,
  })

  await getR2Client(config).send(command)

  return getPublicR2Url(key, bucket)
}

export async function uploadFileToR2(
  filePath: string,
  key: string,
  contentType: string,
  bucket: StorageBucket = DEFAULT_STORAGE_BUCKET,
): Promise<string> {
  const config = getR2Config(bucket)
  const stream = createReadStream(filePath)
  const command = new PutObjectCommand({
    Bucket: config.bucketName,
    Key: key,
    Body: stream,
    ContentType: contentType,
  })

  await getR2Client(config).send(command)

  return getPublicR2Url(key, bucket)
}

export function getPublicR2Url(key: string, bucket: StorageBucket = DEFAULT_STORAGE_BUCKET): string {
  const effectiveBucket = resolveBucketFromResource(key, bucket)
  const config = getR2Config(effectiveBucket)
  let base = `${config.endpoint}/${config.bucketName}`
  if (config.publicDomain) {
    try {
      const parsed = new URL(config.publicDomain)
      base = parsed.origin
    } catch {
      base = config.publicDomain.replace(/\/+$/, "")
    }
  }
  return `${base}/${key.replace(/^\/+/, "")}`
}

export function normalizeR2Url(
  url: string | null,
  bucket: StorageBucket = DEFAULT_STORAGE_BUCKET,
): string | null {
  if (!url) return url
  const effectiveBucket = resolveBucketFromResource(url, bucket)
  const keyPrefix = getR2Config(effectiveBucket).keyPrefix
  const normalized = url.replace(/(^|\/)source\//, `$1${keyPrefix}/`)
  if (/^https?:\/\//i.test(normalized) || normalized.startsWith("//")) {
    try {
      const parsed = new URL(normalized.startsWith("//") ? `https:${normalized}` : normalized)
      const key = extractR2Key(normalized, effectiveBucket)
      if (key && (isKnownR2Host(parsed.host) || detectBucketByPath(key))) {
        return getPublicR2Url(key, effectiveBucket)
      }
    } catch {
      // Fall back to the original value when URL parsing fails.
    }
    return normalized
  }
  const trimmed = normalized.replace(/^\/+/, "")
  try {
    return getPublicR2Url(trimmed, effectiveBucket)
  } catch {
    return normalized
  }
}

export function toPublicPlaybackUrl(
  url: string | null,
  bucket: StorageBucket = DEFAULT_STORAGE_BUCKET,
): string | null {
  const normalized = normalizeR2Url(url, bucket)
  if (!normalized) return normalized
  return normalized.split("?")[0].split("#")[0]
}

export function extractR2Key(url: string, bucket?: StorageBucket): string | null {
  if (!url) return null
  const effectiveBucket = resolveBucketFromResource(url, bucket ?? DEFAULT_STORAGE_BUCKET)
  const withoutQuery = url.split("?")[0]?.split("#")[0] ?? ""
  const cleaned = withoutQuery.trim()
  if (!cleaned) return null

  if (!/^https?:\/\//i.test(cleaned) && !cleaned.startsWith("//")) {
    return cleaned.replace(/^\/+/, "")
  }

  let parsed: URL
  try {
    parsed = new URL(cleaned.startsWith("//") ? `https:${cleaned}` : cleaned)
  } catch {
    return null
  }

  const path = parsed.pathname.replace(/^\/+/, "")
  if (!path) return null

  const prefixes = new Set<string>()
  const addPrefix = (value?: string) => {
    if (!value) return
    const normalized = value.replace(/\/+$/, "")
    if (normalized) prefixes.add(normalized)
  }

  try {
    addPrefix(getR2Config(effectiveBucket).keyPrefix)
  } catch {
    // Ignore config errors and fall back to env-based prefixes.
  }

  addPrefix(process.env.R2_KEY_PREFIX)
  addPrefix(process.env.R2_BUCKET_NAME)
  addPrefix(process.env.R2_JAV_KEY_PREFIX)
  addPrefix(process.env.R2_JAV_BUCKET_NAME)
  addPrefix("media-storage")
  addPrefix("jav-storage")

  for (const prefix of prefixes) {
    const token = `${prefix}/`
    const prefixIndex = path.indexOf(token)
    if (prefixIndex >= 0) {
      return path.slice(prefixIndex)
    }
  }

  try {
    const config = getR2Config(effectiveBucket)
    const bucketPrefix = `${config.bucketName}/`
    if (path.startsWith(bucketPrefix)) {
      return path.slice(bucketPrefix.length)
    }
  } catch {
    // Ignore config errors and fall back to path.
  }

  return path
}

export async function getSignedPlaybackUrl(
  url: string | null,
  expiresIn = 3600,
  bucket: StorageBucket = DEFAULT_STORAGE_BUCKET,
): Promise<string | null> {
  if (!url) return url
  const effectiveBucket = resolveBucketFromResource(url, bucket)
  const key = extractR2Key(url, effectiveBucket)
  if (!key) return normalizeR2Url(url, effectiveBucket)

  try {
    return await getSignedR2Url(key, expiresIn, effectiveBucket)
  } catch {
    return normalizeR2Url(url, effectiveBucket)
  }
}

export function generateUploadKey(
  filename: string,
  type: "video" | "thumbnail",
  bucket: StorageBucket = DEFAULT_STORAGE_BUCKET,
): string {
  const timestamp = Date.now()
  const randomString = Math.random().toString(36).substring(2, 15)
  const extension = filename.split(".").pop() || "bin"
  const keyPrefix = getR2Config(bucket).keyPrefix
  const prefix = type === "thumbnail" ? "thumbnails" : "videos"
  return `${keyPrefix}/${prefix}/${timestamp}-${randomString}.${extension}`
}

/**
 * Generate signed URL for direct uploads
 */
export async function getSignedUploadUrl(
  key: string,
  contentType: string,
  expiresIn = 900,
  bucket: StorageBucket = DEFAULT_STORAGE_BUCKET,
): Promise<string> {
  const config = getR2Config(bucket)
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
export async function deleteFromR2(key: string, bucket: StorageBucket = DEFAULT_STORAGE_BUCKET): Promise<void> {
  const config = getR2Config(bucket)
  const command = new DeleteObjectCommand({
    Bucket: config.bucketName,
    Key: key,
  })

  await getR2Client(config).send(command)
}

/**
 * Generate signed URL for private videos
 */
export async function getSignedR2Url(
  key: string,
  expiresIn = 3600,
  bucket: StorageBucket = DEFAULT_STORAGE_BUCKET,
): Promise<string> {
  const config = getR2Config(bucket)
  const command = new GetObjectCommand({
    Bucket: config.bucketName,
    Key: key,
  })

  return await getSignedUrl(getR2Client(config), command, { expiresIn })
}

export type R2Object = {
  key: string
  size?: number
  lastModified?: Date
}

export type MultipartUploadPart = {
  ETag: string
  PartNumber: number
}

export async function createMultipartUpload(
  key: string,
  contentType: string,
  bucket: StorageBucket = DEFAULT_STORAGE_BUCKET,
): Promise<string> {
  const config = getR2Config(bucket)
  const command = new CreateMultipartUploadCommand({
    Bucket: config.bucketName,
    Key: key,
    ContentType: contentType,
  })
  const response = await getR2Client(config).send(command)
  if (!response.UploadId) {
    throw new Error("Failed to create multipart upload")
  }
  return response.UploadId
}

export async function getSignedUploadPartUrl(
  key: string,
  uploadId: string,
  partNumber: number,
  expiresIn = 900,
  bucket: StorageBucket = DEFAULT_STORAGE_BUCKET,
): Promise<string> {
  const config = getR2Config(bucket)
  const command = new UploadPartCommand({
    Bucket: config.bucketName,
    Key: key,
    UploadId: uploadId,
    PartNumber: partNumber,
  })
  return await getSignedUrl(getR2Client(config), command, { expiresIn })
}

export async function completeMultipartUpload(
  key: string,
  uploadId: string,
  parts: MultipartUploadPart[],
  bucket: StorageBucket = DEFAULT_STORAGE_BUCKET,
): Promise<void> {
  const config = getR2Config(bucket)
  const sortedParts = [...parts].sort((a, b) => a.PartNumber - b.PartNumber)
  const command = new CompleteMultipartUploadCommand({
    Bucket: config.bucketName,
    Key: key,
    UploadId: uploadId,
    MultipartUpload: {
      Parts: sortedParts,
    },
  })
  await getR2Client(config).send(command)
}

export async function abortMultipartUpload(
  key: string,
  uploadId: string,
  bucket: StorageBucket = DEFAULT_STORAGE_BUCKET,
): Promise<void> {
  const config = getR2Config(bucket)
  const command = new AbortMultipartUploadCommand({
    Bucket: config.bucketName,
    Key: key,
    UploadId: uploadId,
  })
  await getR2Client(config).send(command)
}

export async function listR2Objects(options: {
  prefix?: string
  continuationToken?: string
  maxKeys?: number
  bucket?: StorageBucket
}): Promise<{ objects: R2Object[]; nextContinuationToken?: string }> {
  const config = getR2Config(options.bucket ?? DEFAULT_STORAGE_BUCKET)
  const command = new ListObjectsV2Command({
    Bucket: config.bucketName,
    Prefix: options.prefix,
    ContinuationToken: options.continuationToken,
    MaxKeys: options.maxKeys ?? 1000,
  })

  const response = await getR2Client(config).send(command)
  const objects =
    response.Contents?.flatMap((item) => {
      if (!item.Key || item.Key.endsWith("/")) return []
      return [
        {
          key: item.Key,
          size: item.Size,
          lastModified: item.LastModified,
        },
      ]
    }) ?? []

  return {
    objects,
    nextContinuationToken: response.NextContinuationToken,
  }
}

export async function listR2VideoObjects(options: {
  continuationToken?: string
  maxKeys?: number
  bucket?: StorageBucket
}) {
  const config = getR2Config(options.bucket ?? DEFAULT_STORAGE_BUCKET)
  return await listR2Objects({
    prefix: `${config.keyPrefix}/videos/`,
    continuationToken: options.continuationToken,
    maxKeys: options.maxKeys,
    bucket: options.bucket,
  })
}

/**
 * Generate unique filename
 */
export function generateUniqueFilename(originalName: string, bucket: StorageBucket = DEFAULT_STORAGE_BUCKET): string {
  return generateUploadKey(originalName, "video", bucket)
}
