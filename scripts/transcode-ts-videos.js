/* eslint-disable no-console */
const { spawn } = require("child_process")
const { createReadStream, createWriteStream, promises: fs } = require("fs")
const os = require("os")
const path = require("path")
const { pipeline } = require("stream/promises")
const { Readable } = require("stream")
const { S3Client, PutObjectCommand, GetObjectCommand } = require("@aws-sdk/client-s3")
const { getSignedUrl } = require("@aws-sdk/s3-request-presigner")
const { PrismaClient } = require("@prisma/client")

const R2_KEY_PREFIX = "media-storage"
const DEFAULT_LIMIT = 200

const prisma = new PrismaClient()

const getEnv = (name) => {
  const value = process.env[name]
  if (!value) {
    throw new Error(`Missing ${name}`)
  }
  return value
}

const parseArgs = (argv) => {
  const args = { ids: [], dryRun: false, limit: DEFAULT_LIMIT, since: null }
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i]
    if (token === "--dry-run") {
      args.dryRun = true
    } else if (token === "--limit") {
      args.limit = Number(argv[i + 1] ?? DEFAULT_LIMIT)
      i += 1
    } else if (token === "--since") {
      args.since = argv[i + 1] ?? null
      i += 1
    } else if (token === "--ids") {
      args.ids = (argv[i + 1] ?? "")
        .split(",")
        .map((value) => value.trim())
        .filter(Boolean)
      i += 1
    }
  }
  return args
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

const getR2Config = () => {
  const endpoint = getEnv("R2_ENDPOINT")
  const bucketName = getEnv("R2_BUCKET_NAME")
  return {
    endpoint: normalizeEndpoint(endpoint, bucketName),
    accessKeyId: getEnv("R2_ACCESS_KEY_ID"),
    secretAccessKey: getEnv("R2_SECRET_ACCESS_KEY"),
    bucketName,
    publicDomain: process.env.R2_PUBLIC_DOMAIN,
  }
}

const getR2Client = (config) =>
  new S3Client({
    region: "auto",
    endpoint: config.endpoint,
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    },
  })

const getPublicR2Url = (config, key) => {
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

const extractR2Key = (url) => {
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

  const prefix = `${R2_KEY_PREFIX}/`
  const prefixIndex = filePath.indexOf(prefix)
  if (prefixIndex >= 0) {
    return filePath.slice(prefixIndex)
  }

  return filePath
}

const getSignedR2Url = async (client, config, key, expiresIn = 3600) => {
  const command = new GetObjectCommand({
    Bucket: config.bucketName,
    Key: key,
  })
  return await getSignedUrl(client, command, { expiresIn })
}

const uploadFileToR2 = async (client, config, filePath, key, contentType) => {
  const stream = createReadStream(filePath)
  const command = new PutObjectCommand({
    Bucket: config.bucketName,
    Key: key,
    Body: stream,
    ContentType: contentType,
  })
  await client.send(command)
  return getPublicR2Url(config, key)
}

const downloadToFile = async (url, targetPath) => {
  const response = await fetch(url)
  if (!response.ok || !response.body) {
    throw new Error(`Failed to download source video (${response.status})`)
  }
  const fileStream = createWriteStream(targetPath)
  await pipeline(Readable.fromWeb(response.body), fileStream)
}

const runFfmpeg = (inputPath, outputPath) =>
  new Promise((resolve, reject) => {
    const args = [
      "-y",
      "-i",
      inputPath,
      "-c:v",
      "libx264",
      "-c:a",
      "aac",
      "-movflags",
      "+faststart",
      outputPath,
    ]
    const ffmpegPath = process.env.FFMPEG_PATH || "ffmpeg"
    const processRef = spawn(ffmpegPath, args, { stdio: ["ignore", "ignore", "pipe"] })
    let stderr = ""

    processRef.stderr?.on("data", (chunk) => {
      stderr += chunk.toString()
    })
    processRef.on("error", (error) => {
      reject(error)
    })
    processRef.on("close", (code) => {
      if (code === 0) {
        resolve()
      } else {
        reject(new Error(stderr || `ffmpeg exited with code ${code}`))
      }
    })
  })

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

const transcodeVideoToMp4 = async (client, config, video) => {
  const sourceKey = extractR2Key(video.videoUrl)
  if (!sourceKey) {
    throw new Error("Unable to resolve source key for transcoding")
  }

  const signedUrl = await getSignedR2Url(client, config, sourceKey)
  const tempBase = `transcode-${video.id}-${Date.now()}`
  const inputExt = path.extname(sourceKey) || ".ts"
  const inputPath = path.join(os.tmpdir(), `${tempBase}${inputExt}`)
  const outputPath = path.join(os.tmpdir(), `${tempBase}.mp4`)

  try {
    await prisma.video.update({
      where: { id: video.id },
      data: {
        status: "PROCESSING",
        transcodeProgress: 0,
      },
    })

    await downloadToFile(signedUrl, inputPath)
    await runFfmpeg(inputPath, outputPath)

    let targetKey = sourceKey.replace(/\.ts$/i, ".mp4")
    if (targetKey === sourceKey) {
      targetKey = `${R2_KEY_PREFIX}/videos/${video.id}.mp4`
    }
    const mp4Url = await uploadFileToR2(client, config, outputPath, targetKey, "video/mp4")

    await prisma.video.update({
      where: { id: video.id },
      data: {
        videoUrl: mp4Url,
        mimeType: "video/mp4",
        status: "READY",
        transcodeProgress: 100,
      },
    })
  } finally {
    await cleanupFiles(inputPath, outputPath)
  }
}

const parseSinceDate = (value) => {
  if (!value) return null
  const numeric = Number(value)
  if (Number.isFinite(numeric)) {
    const ms = numeric < 1_000_000_000_000 ? numeric * 1000 : numeric
    const date = new Date(ms)
    if (!Number.isNaN(date.getTime())) {
      return date
    }
  }
  const date = new Date(value)
  if (!Number.isNaN(date.getTime())) {
    return date
  }
  return null
}

const main = async () => {
  const args = parseArgs(process.argv.slice(2))
  const config = getR2Config()
  const client = getR2Client(config)
  const sinceDate = parseSinceDate(args.since)

  const where = {
    OR: [{ mimeType: "video/mp2t" }, { videoUrl: { endsWith: ".ts" } }],
  }

  if (args.ids.length > 0) {
    where.id = { in: args.ids }
  }

  if (sinceDate) {
    where.updatedAt = { gt: sinceDate }
  }

  const videos = await prisma.video.findMany({
    where,
    take: args.limit,
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      videoUrl: true,
      mimeType: true,
    },
  })

  console.log(`Matched ${videos.length} videos`)
  if (args.dryRun) {
    console.log("Dry run enabled. No transcodes queued.")
    return
  }

  for (const video of videos) {
    console.log(`Transcoding ${video.id}`)
    try {
      await transcodeVideoToMp4(client, config, video)
      console.log(`Updated ${video.id}`)
    } catch (error) {
      console.error(`Failed ${video.id}:`, error?.message || error)
      try {
        await prisma.video.update({
          where: { id: video.id },
          data: { status: "FAILED" },
        })
      } catch (updateError) {
        console.error(`Failed to mark ${video.id} as FAILED:`, updateError?.message || updateError)
      }
    }
  }
}

main()
  .catch((error) => {
    console.error("Transcode script failed:", error)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
