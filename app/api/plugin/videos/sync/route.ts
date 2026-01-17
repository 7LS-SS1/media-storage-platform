import { type NextRequest, NextResponse } from "next/server"
import path from "path"
import { getUserFromRequest } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { extractR2Key, getPublicR2Url, listR2VideoObjects } from "@/lib/r2"

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

const buildSyncOptions = (input: { cursor?: unknown; limit?: unknown }) => {
  const continuationToken = typeof input.cursor === "string" && input.cursor.length > 0 ? input.cursor : undefined
  const limitValue = parseLimit(input.limit)
  const maxKeys =
    typeof limitValue === "number"
      ? Math.min(Math.max(Math.floor(limitValue), 1), MAX_BATCH)
      : MAX_BATCH

  return { continuationToken, maxKeys }
}

const handleSync = async (
  request: NextRequest,
  options: { continuationToken?: string; maxKeys: number },
) => {
  try {
    const user = await getUserFromRequest(request)
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    if (user.role !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const { objects, nextContinuationToken } = await listR2VideoObjects({
      continuationToken: options.continuationToken,
      maxKeys: options.maxKeys,
    })

    const mp4Objects = objects.filter((item) => item.key.toLowerCase().endsWith(".mp4"))

    const existingVideos = await prisma.video.findMany({
      select: { id: true, videoUrl: true },
    })
    const existingKeyMap = new Map<string, { id: string }>()
    for (const video of existingVideos) {
      const key = extractR2Key(video.videoUrl)
      if (key) {
        existingKeyMap.set(key, { id: video.id })
      }
    }

    const toCreate: typeof mp4Objects = []
    const toUpdate: Array<{ id: string; key: string; size?: number }> = []

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

    if (toUpdate.length > 0) {
      await Promise.all(
        toUpdate.map((item) =>
          prisma.video.update({
            where: { id: item.id },
            data: {
              videoUrl: getPublicR2Url(item.key),
              mimeType: "video/mp4",
              status: "READY",
              fileSize: item.size ?? undefined,
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
          videoUrl: getPublicR2Url(item.key),
          thumbnailUrl: null,
          duration: null,
          fileSize: item.size ?? null,
          mimeType: "video/mp4",
          visibility: "PUBLIC",
          status: "READY",
          categoryId: null,
          createdById: user.userId,
        })),
      })
    }

    return NextResponse.json({
      message: "Sync completed",
      scanned: objects.length,
      discovered: mp4Objects.length,
      created: toCreate.length,
      updated: toUpdate.length,
      skipped: mp4Objects.length - toCreate.length - toUpdate.length,
      nextCursor: nextContinuationToken ?? null,
    })
  } catch (error) {
    console.error("Sync videos error:", error)
    return NextResponse.json({ error: "Failed to sync videos" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}))
  const options = buildSyncOptions({ cursor: body.cursor, limit: body.limit })
  return await handleSync(request, options)
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const options = buildSyncOptions({
    cursor: searchParams.get("cursor"),
    limit: searchParams.get("limit"),
  })
  return await handleSync(request, options)
}
