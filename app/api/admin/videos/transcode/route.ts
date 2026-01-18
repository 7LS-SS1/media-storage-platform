import { type NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { getUserFromRequest } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { enqueueVideoTranscode } from "@/lib/video-transcode"

const DEFAULT_LIMIT = 200
const MAX_LIMIT = 1000

const transcodeRequestSchema = z.object({
  limit: z.number().int().min(1).max(MAX_LIMIT).optional(),
  since: z.string().optional(),
  ids: z.array(z.string()).optional(),
  dryRun: z.boolean().optional().default(false),
})

const parseSinceDate = (value?: string) => {
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
    const validated = transcodeRequestSchema.parse(body)
    const limit = validated.limit ?? DEFAULT_LIMIT
    const sinceDate = parseSinceDate(validated.since)

    const where: Record<string, unknown> = {
      OR: [{ mimeType: "video/mp2t" }, { videoUrl: { endsWith: ".ts" } }],
    }

    if (validated.ids?.length) {
      where.id = { in: validated.ids }
    }

    if (sinceDate) {
      where.updatedAt = { gt: sinceDate }
    }

    const videos = await prisma.video.findMany({
      where,
      take: limit,
      orderBy: { updatedAt: "desc" },
      select: {
        id: true,
        videoUrl: true,
        mimeType: true,
      },
    })

    if (!validated.dryRun) {
      for (const video of videos) {
        enqueueVideoTranscode(video.id, video.videoUrl, video.mimeType)
      }
    }

    return NextResponse.json({
      matched: videos.length,
      queued: validated.dryRun ? 0 : videos.length,
      ids: videos.map((video) => video.id),
    })
  } catch (error) {
    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }
    return NextResponse.json({ error: "Failed to queue transcodes" }, { status: 500 })
  }
}
