import { createWriteStream, promises as fs } from "fs"
import { Readable } from "stream"
import { pipeline } from "stream/promises"
import { spawn } from "child_process"
import os from "os"
import path from "path"
import { prisma } from "@/lib/prisma"
import { extractR2Key, generateUploadKey, getPublicR2Url, getSignedR2Url, uploadFileToR2 } from "@/lib/r2"
import { DEFAULT_STORAGE_BUCKET, type StorageBucket } from "@/lib/storage-bucket"

const FFMPEG_PATH = process.env.FFMPEG_PATH || "ffmpeg"
const FFPROBE_PATH = process.env.FFPROBE_PATH || "ffprobe"
const THUMBNAIL_MAX_WIDTH = 1280

const downloadToFile = async (url: string, targetPath: string) => {
  const response = await fetch(url)
  if (!response.ok || !response.body) {
    throw new Error(`Failed to download source video (${response.status})`)
  }

  const fileStream = createWriteStream(targetPath)
  await pipeline(Readable.fromWeb(response.body as unknown as ReadableStream), fileStream)
}

const runProcess = (command: string, args: string[]) =>
  new Promise<{ stdout: string; stderr: string }>((resolve, reject) => {
    const process = spawn(command, args, { stdio: ["ignore", "pipe", "pipe"] })
    let stdout = ""
    let stderr = ""

    process.stdout?.on("data", (chunk) => {
      stdout += chunk.toString()
    })
    process.stderr?.on("data", (chunk) => {
      stderr += chunk.toString()
    })
    process.on("error", (error) => {
      reject(error)
    })
    process.on("close", (code) => {
      if (code === 0) {
        resolve({ stdout, stderr })
      } else {
        reject(new Error(stderr || `${command} exited with code ${code}`))
      }
    })
  })

const getDurationSeconds = async (inputPath: string): Promise<number | null> => {
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

const pickThumbnailTimestamp = (durationSeconds: number | null) => {
  if (!durationSeconds || durationSeconds <= 0) return 0
  if (durationSeconds <= 5) {
    return Math.max(0, durationSeconds / 2)
  }
  const min = Math.min(1, durationSeconds * 0.1)
  const max = Math.max(min, durationSeconds * 0.9)
  const target = min + Math.random() * (max - min)
  return Math.min(target, Math.max(0, durationSeconds - 0.1))
}

const buildThumbnailArgs = (inputPath: string, outputPath: string, seekSeconds: number, withThumbnailFilter: boolean) => {
  const filters: string[] = []
  if (withThumbnailFilter) {
    filters.push("thumbnail")
  }
  filters.push(`scale='min(${THUMBNAIL_MAX_WIDTH},iw)':-2`)

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

const extractThumbnail = async (inputPath: string, outputPath: string, seekSeconds: number) => {
  const primaryArgs = buildThumbnailArgs(inputPath, outputPath, seekSeconds, true)
  try {
    await runProcess(FFMPEG_PATH, primaryArgs)
    const stats = await fs.stat(outputPath).catch(() => null)
    if (stats && stats.size > 0) {
      return
    }
  } catch {
    // Fallback to a simpler extract below.
  }

  const fallbackArgs = buildThumbnailArgs(inputPath, outputPath, 0, false)
  await runProcess(FFMPEG_PATH, fallbackArgs)
}

const cleanupFiles = async (...paths: string[]) => {
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

const shouldGenerateThumbnail = async (videoId: string) => {
  const video = await prisma.video.findUnique({
    where: { id: videoId },
    select: { thumbnailUrl: true },
  })
  return Boolean(video && !video.thumbnailUrl)
}

type ThumbnailOptions = {
  skipExistingCheck?: boolean
  storageBucket?: StorageBucket
}

export const generateThumbnailFromLocalFile = async (
  videoId: string,
  inputPath: string,
  options?: ThumbnailOptions,
) => {
  const shouldGenerate = options?.skipExistingCheck ? true : await shouldGenerateThumbnail(videoId)
  if (!shouldGenerate) return null
  const storageBucket = options?.storageBucket ?? DEFAULT_STORAGE_BUCKET

  const outputPath = path.join(os.tmpdir(), `thumbnail-${videoId}-${Date.now()}.jpg`)
  try {
    const durationSeconds = await getDurationSeconds(inputPath)
    const seekSeconds = pickThumbnailTimestamp(durationSeconds)

    await extractThumbnail(inputPath, outputPath, seekSeconds)

    const targetKey = generateUploadKey(`${videoId}.jpg`, "thumbnail", storageBucket)
    await uploadFileToR2(outputPath, targetKey, "image/jpeg", storageBucket)
    const thumbnailUrl = getPublicR2Url(targetKey, storageBucket)

    await prisma.video.updateMany({
      where: { id: videoId, thumbnailUrl: null },
      data: { thumbnailUrl },
    })

    return thumbnailUrl
  } finally {
    await cleanupFiles(outputPath)
  }
}

export const generateThumbnailFromVideo = async (videoId: string, videoUrl: string) => {
  return await generateThumbnailFromVideoWithBucket(videoId, videoUrl, DEFAULT_STORAGE_BUCKET)
}

export const generateThumbnailFromVideoWithBucket = async (
  videoId: string,
  videoUrl: string,
  storageBucket: StorageBucket,
) => {
  const shouldGenerate = await shouldGenerateThumbnail(videoId)
  if (!shouldGenerate) return null

  const sourceKey = extractR2Key(videoUrl, storageBucket)
  if (!sourceKey) return null

  const signedUrl = await getSignedR2Url(sourceKey, 3600, storageBucket)
  const tempBase = `thumbnail-${videoId}-${Date.now()}`
  const inputExt = path.extname(sourceKey) || ".mp4"
  const inputPath = path.join(os.tmpdir(), `${tempBase}${inputExt}`)

  try {
    await downloadToFile(signedUrl, inputPath)
    return await generateThumbnailFromLocalFile(videoId, inputPath, {
      skipExistingCheck: true,
      storageBucket,
    })
  } finally {
    await cleanupFiles(inputPath)
  }
}

export const enqueueVideoThumbnail = (
  videoId: string,
  videoUrl: string,
  existingThumbnailUrl?: string | null,
  storageBucket: StorageBucket = DEFAULT_STORAGE_BUCKET,
) => {
  if (existingThumbnailUrl) return
  setTimeout(() => {
    generateThumbnailFromVideoWithBucket(videoId, videoUrl, storageBucket).catch((error) => {
      console.error("Video thumbnail generation failed:", error)
    })
  }, 0)
}
