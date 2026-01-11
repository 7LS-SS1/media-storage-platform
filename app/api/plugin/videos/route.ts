import { type NextRequest, NextResponse } from "next/server"
import { getUserFromRequest } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { normalizeR2Url } from "@/lib/r2"

const DEFAULT_PAGE = 1
const DEFAULT_PER_PAGE = 20
const MAX_PER_PAGE = 100

const parsePositiveInt = (value: string | null, fallback: number) => {
  const parsed = Number(value)
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback
  }
  return Math.floor(parsed)
}

const parseSinceDate = (value: string | null) => {
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

const mapVideo = (video: {
  id: string
  title: string
  description: string | null
  videoUrl: string
  thumbnailUrl: string | null
  duration: number | null
  createdAt: Date
  updatedAt: Date
  category?: { name: string } | null
}) => ({
  id: video.id,
  title: video.title,
  description: video.description ?? "",
  video_url: normalizeR2Url(video.videoUrl),
  thumbnail_url: normalizeR2Url(video.thumbnailUrl),
  duration: video.duration,
  tags: video.category?.name ? [video.category.name] : [],
  created_at: video.createdAt,
  updated_at: video.updatedAt,
})

// GET /videos?page={n}&per_page={n}&since={timestamp}
export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request)
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const page = parsePositiveInt(searchParams.get("page"), DEFAULT_PAGE)
    const perPage = Math.min(parsePositiveInt(searchParams.get("per_page"), DEFAULT_PER_PAGE), MAX_PER_PAGE)
    const since = parseSinceDate(searchParams.get("since"))

    const where: Record<string, unknown> = {
      status: "READY",
      AND: [
        {
          OR: [{ mimeType: "video/mp4" }, { videoUrl: { endsWith: ".mp4" } }],
        },
      ],
    }

    if (since) {
      where.updatedAt = { gt: since }
    }

    if (user.role !== "ADMIN") {
      where.OR = [{ visibility: "PUBLIC" }, { createdById: user.userId }]
    }

    const skip = (page - 1) * perPage
    const take = perPage

    const [videos, total] = await Promise.all([
      prisma.video.findMany({
        where,
        orderBy: { updatedAt: "desc" },
        skip,
        take,
        include: {
          category: true,
          createdBy: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
      }),
      prisma.video.count({ where }),
    ])

    const totalPages = Math.ceil(total / perPage)
    const hasMore = page * perPage < total

    return NextResponse.json({
      data: videos.map((video) => mapVideo(video)),
      pagination: {
        page,
        per_page: perPage,
        total,
        total_pages: totalPages,
        next_page: hasMore ? page + 1 : null,
        has_more: hasMore,
      },
    })
  } catch (error) {
    console.error("Plugin list videos error:", error)
    return NextResponse.json({ error: "Failed to fetch videos" }, { status: 500 })
  }
}
