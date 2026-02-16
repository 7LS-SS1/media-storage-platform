import { type NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { getUserFromRequest } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { isSystem } from "@/lib/roles"
import { enqueueVideoTranscode, transcodeVideoToMp4 } from "@/lib/video-transcode"
import { parseStorageBucket } from "@/lib/storage-bucket"

const DEFAULT_LIMIT = 200
const MAX_LIMIT = 1000
const IS_SERVERLESS_RUNTIME = Boolean(process.env.VERCEL || process.env.AWS_EXECUTION_ENV)
const ALLOW_INLINE_TRANSCODE = process.env.ALLOW_INLINE_TRANSCODE === "true" && !IS_SERVERLESS_RUNTIME

const transcodeRequestSchema = z.object({
  limit: z.number().int().min(1).max(MAX_LIMIT).optional(),
  since: z.string().optional(),
  ids: z.array(z.string()).optional(),
  dryRun: z.boolean().optional().default(false),
  inline: z.boolean().optional().default(false),
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

    if (!isSystem(user.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const body = await request.json().catch(() => ({}))
    const validated = transcodeRequestSchema.parse(body)
    if (validated.inline && !ALLOW_INLINE_TRANSCODE) {
      return NextResponse.json(
        {
          error:
            "Inline transcode is disabled in this environment. Queue the job and run `npm run transcode:worker` on a dedicated worker host.",
        },
        { status: 400 },
      )
    }

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
        storageBucket: true,
      },
    })

    const results: Array<{ id: string; status: "queued" | "skipped" | "failed" | "completed"; error?: string }> = []

    if (!validated.dryRun) {
      for (const video of videos) {
        const bucket = parseStorageBucket(video.storageBucket)
        if (validated.inline) {
          try {
            await transcodeVideoToMp4(video.id, video.videoUrl, bucket)
            results.push({ id: video.id, status: "completed" })
          } catch (error) {
            const message = error instanceof Error ? error.message : "Transcode failed"
            try {
              await prisma.video.update({
                where: { id: video.id },
                data: { status: "FAILED" },
              })
            } catch (updateError) {
              console.error("Failed to mark transcode as failed:", updateError)
            }
            results.push({ id: video.id, status: "failed", error: message })
          }
        } else {
          enqueueVideoTranscode(video.id, video.videoUrl, video.mimeType, bucket)
          results.push({ id: video.id, status: "queued" })
        }
      }
    } else {
      for (const video of videos) {
        results.push({ id: video.id, status: "skipped" })
      }
    }

    return NextResponse.json({
      matched: videos.length,
      queued: results.filter((item) => item.status === "queued").length,
      completed: results.filter((item) => item.status === "completed").length,
      failed: results.filter((item) => item.status === "failed").length,
      mode: validated.inline ? "inline" : "queue",
      ids: videos.map((video) => video.id),
      results,
    })
  } catch (error) {
    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }
    return NextResponse.json({ error: "Failed to queue transcodes" }, { status: 500 })
  }
}
