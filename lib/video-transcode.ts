import { createReadStream, createWriteStream, promises as fs } from "fs"
import { Readable } from "stream"
import { pipeline } from "stream/promises"
import { spawn } from "child_process"
import os from "os"
import path from "path"
import { prisma } from "@/lib/prisma"
import { extractR2Key, generateUploadKey, getPublicR2Url, getSignedR2Url, uploadFileToR2 } from "@/lib/r2"

const FFMPEG_PATH = process.env.FFMPEG_PATH || "ffmpeg"

export const shouldTranscodeToMp4 = (videoUrl: string, mimeType?: string | null) => {
  if (!videoUrl) return false
  if (mimeType?.toLowerCase() === "video/mp2t") return true
  const cleanUrl = videoUrl.split("?")[0]?.toLowerCase() ?? ""
  return cleanUrl.endsWith(".ts")
}

const parseFfmpegTimestamp = (value: string) => {
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

const downloadToFile = async (url: string, targetPath: string) => {
  const response = await fetch(url)
  if (!response.ok || !response.body) {
    throw new Error(`Failed to download source video (${response.status})`)
  }

  const fileStream = createWriteStream(targetPath)
  await pipeline(Readable.fromWeb(response.body as unknown as ReadableStream), fileStream)
}

const runFfmpeg = (inputPath: string, outputPath: string, onProgress?: (progress: number) => void) =>
  new Promise<void>((resolve, reject) => {
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
    const process = spawn(FFMPEG_PATH, args, { stdio: ["ignore", "ignore", "pipe"] })
    let stderr = ""
    let stderrBuffer = ""
    let durationSeconds: number | null = null
    let lastProgress = -1

    const handleProgress = (currentSeconds: number) => {
      if (!durationSeconds || durationSeconds <= 0) return
      const ratio = Math.min(Math.max(currentSeconds / durationSeconds, 0), 1)
      const progress = Math.min(99, Math.floor(ratio * 100))
      if (progress <= lastProgress) return
      lastProgress = progress
      onProgress?.(progress)
    }

    process.stderr?.on("data", (chunk) => {
      const text = chunk.toString()
      stderr += text
      stderrBuffer += text
      const lines = stderrBuffer.split(/\r?\n/)
      stderrBuffer = lines.pop() ?? ""
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
    process.on("error", (error) => {
      reject(error)
    })
    process.on("close", (code) => {
      if (code === 0) {
        onProgress?.(100)
        resolve()
      } else {
        reject(new Error(stderr || `ffmpeg exited with code ${code}`))
      }
    })
  })

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

const transcodeVideoToMp4 = async (videoId: string, videoUrl: string) => {
  const sourceKey = extractR2Key(videoUrl)
  if (!sourceKey) {
    throw new Error("Unable to resolve source key for transcoding")
  }

  const signedUrl = await getSignedR2Url(sourceKey)
  const tempBase = `transcode-${videoId}-${Date.now()}`
  const inputExt = path.extname(sourceKey) || ".ts"
  const inputPath = path.join(os.tmpdir(), `${tempBase}${inputExt}`)
  const outputPath = path.join(os.tmpdir(), `${tempBase}.mp4`)

  let lastPersistedProgress = -1
  const persistProgress = (progress: number) => {
    if (progress <= lastPersistedProgress) return
    if (progress < 100 && progress - lastPersistedProgress < 5) return
    lastPersistedProgress = progress
    void prisma.video
      .update({
        where: { id: videoId },
        data: { transcodeProgress: progress },
      })
      .catch((error) => {
        console.error("Failed to persist transcode progress:", error)
      })
  }

  try {
    await prisma.video.update({
      where: { id: videoId },
      data: {
        status: "PROCESSING",
        transcodeProgress: 0,
      },
    })

    await downloadToFile(signedUrl, inputPath)
    await runFfmpeg(inputPath, outputPath, persistProgress)

    let targetKey = sourceKey.replace(/\.ts$/i, ".mp4")
    if (targetKey === sourceKey) {
      targetKey = generateUploadKey(`${videoId}.mp4`, "video")
    }

    await uploadFileToR2(outputPath, targetKey, "video/mp4")
    const mp4Url = getPublicR2Url(targetKey)

    await prisma.video.update({
      where: { id: videoId },
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

export const enqueueVideoTranscode = (videoId: string, videoUrl: string, mimeType?: string | null) => {
  if (!shouldTranscodeToMp4(videoUrl, mimeType)) {
    return
  }

  setTimeout(() => {
    transcodeVideoToMp4(videoId, videoUrl).catch(async (error) => {
      console.error("Video transcode failed:", error)
      try {
        await prisma.video.update({
          where: { id: videoId },
          data: { status: "FAILED" },
        })
      } catch (updateError) {
        console.error("Failed to mark video transcode as failed:", updateError)
      }
    })
  }, 0)
}
