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

export async function POST(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request)
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    if (user.role !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const body = await request.json().catch(() => ({}))
    const continuationToken =
      typeof body.cursor === "string" && body.cursor.length > 0 ? body.cursor : undefined
    const maxKeys =
      typeof body.limit === "number" && Number.isFinite(body.limit)
        ? Math.min(Math.max(Math.floor(body.limit), 1), MAX_BATCH)
        : MAX_BATCH

    const { objects, nextContinuationToken } = await listR2VideoObjects({
      continuationToken,
      maxKeys,
    })

    const mp4Objects = objects.filter((item) => item.key.toLowerCase().endsWith(".mp4"))

    const existingVideos = await prisma.video.findMany({
      select: { videoUrl: true },
    })
    const existingKeys = new Set(
      existingVideos
        .map((video) => extractR2Key(video.videoUrl))
        .filter((value): value is string => Boolean(value)),
    )

    const toCreate = mp4Objects.filter((item) => !existingKeys.has(item.key))

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
      skipped: mp4Objects.length - toCreate.length,
      nextCursor: nextContinuationToken ?? null,
    })
  } catch (error) {
    console.error("Sync videos error:", error)
    return NextResponse.json({ error: "Failed to sync videos" }, { status: 500 })
  }
}
