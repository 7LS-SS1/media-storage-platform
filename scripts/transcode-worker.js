/* eslint-disable no-console */
const { spawn } = require("child_process")
const { createReadStream, promises: fs } = require("fs")
const os = require("os")
const path = require("path")
const { S3Client, PutObjectCommand, GetObjectCommand } = require("@aws-sdk/client-s3")
const { getSignedUrl } = require("@aws-sdk/s3-request-presigner")
const { PrismaClient } = require("@prisma/client")

const prisma = new PrismaClient()

const DEFAULT_STORAGE_BUCKET = "media"
const FFMPEG_PATH = process.env.FFMPEG_PATH || "ffmpeg"
const FFPROBE_PATH = process.env.FFPROBE_PATH || "ffprobe"
const TMP_DIR = process.env.TRANSCODE_TMP_DIR || os.tmpdir()
const POLL_INTERVAL_MS = Number(process.env.TRANSCODE_POLL_INTERVAL_MS || 15000)
const IDLE_DELAY_MS = Number(process.env.TRANSCODE_IDLE_DELAY_MS || POLL_INTERVAL_MS)

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

const getEnv = (name) => {
  const value = process.env[name]
  if (!value) {
    throw new Error(`Missing ${name}`)
  }
  return value
}

const normalizeEndpoint = (endpoint, bucketName) => {
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

const cachedConfigs = {}
const cachedClients = {}

const getBucketConfig = (bucket) => {
  if (cachedConfigs[bucket]) return cachedConfigs[bucket]
  const endpoint = getEnv("R2_ENDPOINT")
  const accessKeyId = getEnv("R2_ACCESS_KEY_ID")
  const secretAccessKey = getEnv("R2_SECRET_ACCESS_KEY")
  const bucketName = bucket === "jav" ? getEnv("R2_JAV_BUCKET_NAME") : getEnv("R2_BUCKET_NAME")
  const publicDomain = bucket === "jav" ? process.env.R2_JAV_PUBLIC_DOMAIN : process.env.R2_PUBLIC_DOMAIN
  const keyPrefix = (bucket === "jav" ? process.env.R2_JAV_KEY_PREFIX : process.env.R2_KEY_PREFIX) || bucketName

  const baseBucket = process.env.R2_BUCKET_NAME || bucketName
  const config = {
    endpoint: normalizeEndpoint(endpoint, baseBucket),
    accessKeyId,
    secretAccessKey,
    bucketName,
    publicDomain,
    keyPrefix,
  }
  cachedConfigs[bucket] = config
  return config
}

const getR2Client = (bucket) => {
  if (cachedClients[bucket]) return cachedClients[bucket]
  const config = getBucketConfig(bucket)
  const client = new S3Client({
    region: "auto",
    endpoint: config.endpoint,
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    },
  })
  cachedClients[bucket] = client
  return client
}

const getPublicR2Url = (bucket, key) => {
  const config = getBucketConfig(bucket)
  let base = `${config.endpoint}/${config.bucketName}`
  if (config.publicDomain) {
    try {
      const parsed = new URL(config.publicDomain)
      base = parsed.origin
    } catch {
      base = config.publicDomain.replace(/\/+$/, "")
    }
  }
  return `${base}/${key}`
}

const extractR2Key = (url, bucket) => {
  if (!url) return null
  const withoutQuery = url.split("?")[0]?.split("#")[0] ?? ""
  const cleaned = withoutQuery.trim()
  if (!cleaned) return null

  if (!/^https?:\/\//i.test(cleaned) && !cleaned.startsWith("//")) {
    return cleaned.replace(/^\/+/, "")
  }

  let parsed
  try {
    parsed = new URL(cleaned.startsWith("//") ? `https:${cleaned}` : cleaned)
  } catch {
    return null
  }

  const filePath = parsed.pathname.replace(/^\/+/, "")
  if (!filePath) return null

  const prefixes = new Set()
  const addPrefix = (value) => {
    if (!value) return
    const normalized = value.replace(/\/+$/, "")
    if (normalized) prefixes.add(normalized)
  }

  const config = getBucketConfig(bucket)
  addPrefix(config.keyPrefix)
  addPrefix(process.env.R2_KEY_PREFIX)
  addPrefix(process.env.R2_BUCKET_NAME)
  addPrefix(process.env.R2_JAV_KEY_PREFIX)
  addPrefix(process.env.R2_JAV_BUCKET_NAME)
  addPrefix("media-storage")
  addPrefix("jav-storage")

  for (const prefix of prefixes) {
    const token = `${prefix}/`
    const prefixIndex = filePath.indexOf(token)
    if (prefixIndex >= 0) {
      return filePath.slice(prefixIndex)
    }
  }

  const bucketPrefix = `${config.bucketName}/`
  if (filePath.startsWith(bucketPrefix)) {
    return filePath.slice(bucketPrefix.length)
  }

  return filePath
}

const generateUploadKey = (bucket, filename, type) => {
  const config = getBucketConfig(bucket)
  const timestamp = Date.now()
  const randomString = Math.random().toString(36).substring(2, 15)
  const extension = filename.split(".").pop() || "bin"
  const prefix = type === "thumbnail" ? "thumbnails" : "videos"
  return `${config.keyPrefix}/${prefix}/${timestamp}-${randomString}.${extension}`
}

const getSignedR2Url = async (bucket, key, expiresIn = 3600) => {
  const config = getBucketConfig(bucket)
  const command = new GetObjectCommand({ Bucket: config.bucketName, Key: key })
  return await getSignedUrl(getR2Client(bucket), command, { expiresIn })
}

const uploadFileToR2 = async (bucket, filePath, key, contentType) => {
  const config = getBucketConfig(bucket)
  const stream = createReadStream(filePath)
  const command = new PutObjectCommand({
    Bucket: config.bucketName,
    Key: key,
    Body: stream,
    ContentType: contentType,
  })
  await getR2Client(bucket).send(command)
  return getPublicR2Url(bucket, key)
}

const parseFfmpegTimestamp = (value) => {
  const parts = value.split(":")
  if (parts.length !== 3) return null
  const hours = Number(parts[0])
  const minutes = Number(parts[1])
  const seconds = Number(parts[2])
  if (!Number.isFinite(hours) || !Number.isFinite(minutes) || !Number.isFinite(seconds)) {
    return null
  }
  return hours * 3600 + minutes * 60 + seconds
}

const runFfmpeg = (inputSource, outputPath, onProgress) =>
  new Promise((resolve, reject) => {
    const args = [
      "-y",
      "-i",
      inputSource,
      "-c:v",
      "libx264",
      "-c:a",
      "aac",
      "-movflags",
      "+faststart",
      outputPath,
    ]
    const processRef = spawn(FFMPEG_PATH, args, { stdio: ["ignore", "ignore", "pipe"] })
    let stderr = ""
    let stderrBuffer = ""
    let durationSeconds = null
    let lastProgress = -1

    const handleProgress = (currentSeconds) => {
      if (!durationSeconds || durationSeconds <= 0) return
      const ratio = Math.min(Math.max(currentSeconds / durationSeconds, 0), 1)
      const progress = Math.min(99, Math.floor(ratio * 100))
      if (progress <= lastProgress) return
      lastProgress = progress
      onProgress?.(progress)
    }

    processRef.stderr?.on("data", (chunk) => {
      const text = chunk.toString()
      stderr += text
      stderrBuffer += text
      const lines = stderrBuffer.split(/\r?\n/)
      stderrBuffer = lines.pop() || ""
      for (const line of lines) {
        if (!durationSeconds) {
          const durationMatch = line.match(/Duration:\s*(\d+:\d+:\d+(?:\.\d+)?)/)
          if (durationMatch) {
            durationSeconds = parseFfmpegTimestamp(durationMatch[1])
          }
        }
        const timeMatch = line.match(/time=(\d+:\d+:\d+(?:\.\d+)?)/)
        if (timeMatch) {
          const currentSeconds = parseFfmpegTimestamp(timeMatch[1])
          if (currentSeconds !== null) {
            handleProgress(currentSeconds)
          }
        }
      }
    })
    processRef.on("error", (error) => {
      reject(error)
    })
    processRef.on("close", (code) => {
      if (code === 0) {
        onProgress?.(100)
        resolve()
      } else {
        reject(new Error(stderr || `ffmpeg exited with code ${code}`))
      }
    })
  })

const runProcess = (command, args) =>
  new Promise((resolve, reject) => {
    const processRef = spawn(command, args, { stdio: ["ignore", "pipe", "pipe"] })
    let stdout = ""
    let stderr = ""
    processRef.stdout?.on("data", (chunk) => {
      stdout += chunk.toString()
    })
    processRef.stderr?.on("data", (chunk) => {
      stderr += chunk.toString()
    })
    processRef.on("error", (error) => {
      reject(error)
    })
    processRef.on("close", (code) => {
      if (code === 0) {
        resolve({ stdout, stderr })
      } else {
        reject(new Error(stderr || `${command} exited with code ${code}`))
      }
    })
  })

const getDurationSeconds = async (inputPath) => {
  try {
    const { stdout } = await runProcess(FFPROBE_PATH, [
      "-v",
      "error",
      "-show_entries",
      "format=duration",
      "-of",
      "default=nk=1:nw=1",
      inputPath,
    ])
    const value = Number(stdout.trim())
    return Number.isFinite(value) && value > 0 ? value : null
  } catch {
    return null
  }
}

const pickThumbnailTimestamp = (durationSeconds) => {
  if (!durationSeconds || durationSeconds <= 0) return 0
  if (durationSeconds <= 5) {
    return Math.max(0, durationSeconds / 2)
  }
  const min = Math.min(1, durationSeconds * 0.1)
  const max = Math.max(min, durationSeconds * 0.9)
  const target = min + Math.random() * (max - min)
  return Math.min(target, Math.max(0, durationSeconds - 0.1))
}

const buildThumbnailArgs = (inputPath, outputPath, seekSeconds, withThumbnailFilter) => {
  const filters = []
  if (withThumbnailFilter) {
    filters.push("thumbnail")
  }
  filters.push("scale='min(1280,iw)':-2")
  return [
    "-y",
    "-loglevel",
    "error",
    ...(seekSeconds > 0 ? ["-ss", seekSeconds.toFixed(3)] : []),
    "-i",
    inputPath,
    "-vf",
    filters.join(","),
    "-frames:v",
    "1",
    "-q:v",
    "2",
    outputPath,
  ]
}

const extractThumbnail = async (inputPath, outputPath, seekSeconds) => {
  try {
    await runProcess(FFMPEG_PATH, buildThumbnailArgs(inputPath, outputPath, seekSeconds, true))
    const stats = await fs.stat(outputPath).catch(() => null)
    if (stats && stats.size > 0) return
  } catch {
    // Fallback below.
  }
  await runProcess(FFMPEG_PATH, buildThumbnailArgs(inputPath, outputPath, 0, false))
}

const cleanupFiles = async (...paths) => {
  await Promise.all(
    paths.map(async (filePath) => {
      try {
        await fs.unlink(filePath)
      } catch {
        // Ignore cleanup errors.
      }
    }),
  )
}

const generateThumbnailFromLocalFile = async (videoId, inputPath, bucket) => {
  const video = await prisma.video.findUnique({
    where: { id: videoId },
    select: { thumbnailUrl: true },
  })
  if (!video || video.thumbnailUrl) return null

  await fs.mkdir(TMP_DIR, { recursive: true })
  const outputPath = path.join(TMP_DIR, `thumbnail-${videoId}-${Date.now()}.jpg`)
  try {
    const durationSeconds = await getDurationSeconds(inputPath)
    const seekSeconds = pickThumbnailTimestamp(durationSeconds)

    await extractThumbnail(inputPath, outputPath, seekSeconds)
    const targetKey = generateUploadKey(bucket, `${videoId}.jpg`, "thumbnail")
    await uploadFileToR2(bucket, outputPath, targetKey, "image/jpeg")
    const thumbnailUrl = getPublicR2Url(bucket, targetKey)

    await prisma.video.updateMany({
      where: { id: videoId, thumbnailUrl: null },
      data: { thumbnailUrl },
    })

    return thumbnailUrl
  } finally {
    await cleanupFiles(outputPath)
  }
}

const transcodeVideoToMp4 = async (video) => {
  const bucket = video.storageBucket === "jav" ? "jav" : DEFAULT_STORAGE_BUCKET
  const sourceKey = extractR2Key(video.videoUrl, bucket)
  if (!sourceKey) {
    throw new Error("Unable to resolve source key for transcoding")
  }

  await fs.mkdir(TMP_DIR, { recursive: true })
  const signedUrl = await getSignedR2Url(bucket, sourceKey, 3600)
  const tempBase = `transcode-${video.id}-${Date.now()}`
  const outputPath = path.join(TMP_DIR, `${tempBase}.mp4`)

  let lastPersistedProgress = -1
  const persistProgress = (progress) => {
    if (progress <= lastPersistedProgress) return
    if (progress < 100 && progress - lastPersistedProgress < 5) return
    lastPersistedProgress = progress
    void prisma.video
      .update({
        where: { id: video.id },
        data: { transcodeProgress: progress },
      })
      .catch((error) => {
        console.error("Failed to persist transcode progress:", error)
      })
  }

  try {
    await prisma.video.update({
      where: { id: video.id },
      data: {
        status: "PROCESSING",
        transcodeProgress: 0,
      },
    })

    await runFfmpeg(signedUrl, outputPath, persistProgress)

    let targetKey = sourceKey.replace(/\.ts$/i, ".mp4")
    if (targetKey === sourceKey) {
      targetKey = generateUploadKey(bucket, `${video.id}.mp4`, "video")
    }

    const mp4Url = await uploadFileToR2(bucket, outputPath, targetKey, "video/mp4")

    await prisma.video.update({
      where: { id: video.id },
      data: {
        videoUrl: mp4Url,
        mimeType: "video/mp4",
        status: "READY",
        transcodeProgress: 100,
      },
    })

    try {
      await generateThumbnailFromLocalFile(video.id, outputPath, bucket)
    } catch (error) {
      console.error("Failed to generate thumbnail after transcode:", error)
    }
  } finally {
    await cleanupFiles(outputPath)
  }
}

const fetchNextVideo = async () => {
  return await prisma.video.findFirst({
    where: {
      status: "PROCESSING",
      OR: [{ transcodeProgress: null }, { transcodeProgress: { lt: 100 } }],
      AND: [
        {
          OR: [{ mimeType: "video/mp2t" }, { videoUrl: { endsWith: ".ts" } }],
        },
      ],
    },
    orderBy: { updatedAt: "asc" },
    select: {
      id: true,
      videoUrl: true,
      mimeType: true,
      storageBucket: true,
    },
  })
}

const startWorker = async () => {
  console.log(`[transcode-worker] starting (tmp: ${TMP_DIR})`)
  await fs.mkdir(TMP_DIR, { recursive: true })
  while (true) {
    const job = await fetchNextVideo()
    if (!job) {
      await sleep(IDLE_DELAY_MS)
      continue
    }

    console.log(`[transcode-worker] transcoding ${job.id}`)
    try {
      await transcodeVideoToMp4(job)
      console.log(`[transcode-worker] completed ${job.id}`)
    } catch (error) {
      const message = error?.message || error
      console.error(`[transcode-worker] failed ${job.id}:`, message)
      try {
        await prisma.video.update({
          where: { id: job.id },
          data: { status: "FAILED" },
        })
      } catch (updateError) {
        console.error(`[transcode-worker] failed to mark ${job.id} as FAILED:`, updateError?.message || updateError)
      }
      await sleep(POLL_INTERVAL_MS)
    }
  }
}

startWorker()
  .catch((error) => {
    console.error("[transcode-worker] fatal:", error)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
