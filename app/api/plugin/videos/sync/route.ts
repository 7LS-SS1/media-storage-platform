import { type NextRequest, NextResponse } from "next/server"
import path from "path"
import { getUserFromRequest } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { isSystem } from "@/lib/roles"
import { extractR2Key, getPublicR2Url, listR2VideoObjects } from "@/lib/r2"
import { parseStorageBucket, resolveStorageBucketFilter } from "@/lib/storage-bucket"
import { enqueueVideoTranscode } from "@/lib/video-transcode"

const MAX_BATCH = 1000

const toTitle = (key: string) => {
  const base = path.basename(key).replace(/\.[^.]+$/, "")
  return base.replace(/[-_]+/g, " ").trim().slice(0, 200) || "Untitled video"
}

const parseLimit = (value: unknown) => {
  if (typeof value === "number" && Number.isFinite(value)) return value
  if (typeof value === "string") {
    const numeric = Number(value)
    if (Number.isFinite(numeric)) return numeric
  }
  return undefined
}

const buildSyncOptions = (input: {
  cursor?: unknown
  limit?: unknown
  bucket?: unknown
  storageBucket?: unknown
  type?: unknown
}) => {
  const continuationToken = typeof input.cursor === "string" && input.cursor.length > 0 ? input.cursor : undefined
  const limitValue = parseLimit(input.limit)
  const maxKeys =
    typeof limitValue === "number"
      ? Math.min(Math.max(Math.floor(limitValue), 1), MAX_BATCH)
      : MAX_BATCH
  const bucketFilter = resolveStorageBucketFilter({
    bucket: typeof input.bucket === "string" ? input.bucket : undefined,
    storageBucket: typeof input.storageBucket === "string" ? input.storageBucket : undefined,
    type: typeof input.type === "string" ? input.type : undefined,
  })
  const fallbackBucketValue =
    typeof input.bucket === "string"
      ? input.bucket
      : typeof input.storageBucket === "string"
        ? input.storageBucket
        : undefined
  const bucket = bucketFilter ?? parseStorageBucket(fallbackBucketValue)

  return { continuationToken, maxKeys, bucket }
}

const handleSync = async (
  request: NextRequest,
  options: { continuationToken?: string; maxKeys: number; bucket: "media" | "jav" },
) => {
  try {
    const user = await getUserFromRequest(request)
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    if (!isSystem(user.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const { objects, nextContinuationToken } = await listR2VideoObjects({
      continuationToken: options.continuationToken,
      maxKeys: options.maxKeys,
      bucket: options.bucket,
    })

    const mp4Objects = objects.filter((item) => item.key.toLowerCase().endsWith(".mp4"))
    const tsObjects = objects.filter((item) => item.key.toLowerCase().endsWith(".ts"))
    const mp4KeySet = new Set(mp4Objects.map((item) => item.key))

    const existingVideos = await prisma.video.findMany({
      select: { id: true, videoUrl: true, storageBucket: true },
    })
    const existingKeyMap = new Map<string, { id: string }>()
    for (const video of existingVideos) {
      const key = extractR2Key(video.videoUrl, parseStorageBucket(video.storageBucket))
      if (key) {
        existingKeyMap.set(key, { id: video.id })
      }
    }

    const toCreate: typeof mp4Objects = []
    const toUpdate: Array<{ id: string; key: string; size?: number }> = []
    const toCreateTs: typeof tsObjects = []

    for (const item of mp4Objects) {
      if (existingKeyMap.has(item.key)) {
        continue
      }

      const tsKey = item.key.replace(/\.mp4$/i, ".ts")
      const existingTs = existingKeyMap.get(tsKey)
      if (existingTs) {
        toUpdate.push({ id: existingTs.id, key: item.key, size: item.size })
        continue
      }

      toCreate.push(item)
    }

    for (const item of tsObjects) {
      if (existingKeyMap.has(item.key)) {
        continue
      }

      const mp4Key = item.key.replace(/\.ts$/i, ".mp4")
      if (existingKeyMap.has(mp4Key) || mp4KeySet.has(mp4Key)) {
        continue
      }

      toCreateTs.push(item)
    }

    if (toUpdate.length > 0) {
      await Promise.all(
        toUpdate.map((item) =>
          prisma.video.update({
            where: { id: item.id },
            data: {
              videoUrl: getPublicR2Url(item.key, options.bucket),
              mimeType: "video/mp4",
              status: "READY",
              transcodeProgress: 100,
              fileSize: item.size === undefined ? undefined : BigInt(item.size),
              storageBucket: options.bucket,
            },
          }),
        ),
      )
    }

    if (toCreate.length > 0) {
      await prisma.video.createMany({
        data: toCreate.map((item) => ({
          title: toTitle(item.key),
          description: null,
          videoUrl: getPublicR2Url(item.key, options.bucket),
          thumbnailUrl: null,
          duration: null,
          fileSize: item.size === undefined ? null : BigInt(item.size),
          mimeType: "video/mp4",
          visibility: "PUBLIC",
          status: "READY",
          transcodeProgress: 100,
          storageBucket: options.bucket,
          createdById: user.userId,
        })),
      })
    }

    if (toCreateTs.length > 0) {
      await Promise.all(
        toCreateTs.map(async (item) => {
          const video = await prisma.video.create({
            data: {
              title: toTitle(item.key),
              description: null,
              videoUrl: getPublicR2Url(item.key, options.bucket),
              thumbnailUrl: null,
              duration: null,
              fileSize: item.size === undefined ? null : BigInt(item.size),
              mimeType: "video/mp2t",
              visibility: "PUBLIC",
              status: "PROCESSING",
              transcodeProgress: 0,
              storageBucket: options.bucket,
              createdById: user.userId,
            },
          })

          enqueueVideoTranscode(video.id, video.videoUrl, video.mimeType, options.bucket)
        }),
      )
    }

    const discovered = mp4Objects.length + tsObjects.length
    const created = toCreate.length + toCreateTs.length
    const skipped = discovered - created - toUpdate.length

    return NextResponse.json({
      message: "Sync completed",
      scanned: objects.length,
      discovered,
      created,
      updated: toUpdate.length,
      skipped,
      nextCursor: nextContinuationToken ?? null,
    })
  } catch (error) {
    console.error("Sync videos error:", error)
    return NextResponse.json({ error: "Failed to sync videos" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}))
  const options = buildSyncOptions({
    cursor: body.cursor,
    limit: body.limit,
    bucket: body.bucket,
    storageBucket: body.storageBucket,
    type: body.type,
  })
  return await handleSync(request, options)
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const options = buildSyncOptions({
    cursor: searchParams.get("cursor"),
    limit: searchParams.get("limit"),
    bucket: searchParams.get("bucket"),
    storageBucket: searchParams.get("storageBucket"),
    type: searchParams.get("type"),
  })
  return await handleSync(request, options)
}
