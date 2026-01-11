import { createReadStream, createWriteStream, promises as fs } from "fs"
import { Readable } from "stream"
import { pipeline } from "stream/promises"
import { spawn } from "child_process"
import os from "os"
import path from "path"
import { prisma } from "@/lib/prisma"
import { extractR2Key, generateUploadKey, getPublicR2Url, getSignedR2Url, uploadFileToR2 } from "@/lib/r2"

const FFMPEG_PATH = process.env.FFMPEG_PATH || "ffmpeg"

const shouldTranscodeToMp4 = (videoUrl: string, mimeType?: string | null) => {
  if (!videoUrl) return false
  if (mimeType?.toLowerCase() === "video/mp2t") return true
  const cleanUrl = videoUrl.split("?")[0]?.toLowerCase() ?? ""
  return cleanUrl.endsWith(".ts")
}

const downloadToFile = async (url: string, targetPath: string) => {
  const response = await fetch(url)
  if (!response.ok || !response.body) {
    throw new Error(`Failed to download source video (${response.status})`)
  }

  const fileStream = createWriteStream(targetPath)
  await pipeline(Readable.fromWeb(response.body as unknown as ReadableStream), fileStream)
}

const runFfmpeg = (inputPath: string, outputPath: string) =>
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

    process.stderr?.on("data", (chunk) => {
      stderr += chunk.toString()
    })
    process.on("error", (error) => {
      reject(error)
    })
    process.on("close", (code) => {
      if (code === 0) {
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

  try {
    await downloadToFile(signedUrl, inputPath)
    await runFfmpeg(inputPath, outputPath)

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
    transcodeVideoToMp4(videoId, videoUrl).catch((error) => {
      console.error("Video transcode failed:", error)
    })
  }, 0)
}
