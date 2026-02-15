import { type NextRequest, NextResponse } from "next/server"
import { getUserFromRequest } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { canViewAllVideos } from "@/lib/roles"
import { getSignedPlaybackUrl, normalizeR2Url, toPublicPlaybackUrl } from "@/lib/r2"
import { toActorNames } from "@/lib/actors"
import { mergeTags } from "@/lib/tags"
import { markMp4VideosReady } from "@/lib/video-status"
import { parseStorageBucket, resolveStorageBucketFilter } from "@/lib/storage-bucket"

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

const mapVideo = async (video: {
  id: string
  title: string
  description: string | null
  videoUrl: string
  thumbnailUrl: string | null
  storageBucket: string
  duration: number | null
  createdAt: Date
  updatedAt: Date
  tags: string[]
  categories?: Array<{ id: string; name: string }> | null
  actors?: Array<{ name: string }> | string[] | null
}) => {
  const bucket = parseStorageBucket(video.storageBucket)
  const signedUrl = await getSignedPlaybackUrl(video.videoUrl, 3600, bucket)
  const publicUrl =
    toPublicPlaybackUrl(video.videoUrl, bucket) ??
    normalizeR2Url(video.videoUrl, bucket)
  return {
    id: video.id,
    title: video.title,
    description: video.description ?? "",
    video_url: signedUrl ?? normalizeR2Url(video.videoUrl, bucket) ?? video.videoUrl,
    playback_url:
      publicUrl ??
      signedUrl ??
      normalizeR2Url(video.videoUrl, bucket) ??
      video.videoUrl,
    thumbnail_url: normalizeR2Url(video.thumbnailUrl, bucket),
    duration: video.duration,
    tags: mergeTags(video.tags, video.categories ?? []),
    categories: (video.categories ?? []).map((category) => ({ id: category.id, name: category.name })),
    actors: toActorNames(video.actors),
    created_at: video.createdAt,
    updated_at: video.updatedAt,
  }
}

// GET /videos?page={n}&per_page={n}&since={timestamp}
export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request)
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    await markMp4VideosReady()

    const { searchParams } = new URL(request.url)
    const page = parsePositiveInt(searchParams.get("page"), DEFAULT_PAGE)
    const perPage = Math.min(parsePositiveInt(searchParams.get("per_page"), DEFAULT_PER_PAGE), MAX_PER_PAGE)
    const since = parseSinceDate(searchParams.get("since"))
    const storageBucketFilter = resolveStorageBucketFilter({
      storageBucket: searchParams.get("storageBucket"),
      bucket: searchParams.get("bucket"),
      type: searchParams.get("type"),
    })

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
    if (storageBucketFilter) {
      where.storageBucket = storageBucketFilter
    }

    if (!canViewAllVideos(user.role)) {
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
          categories: true,
          actors: {
            select: {
              name: true,
            },
          },
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

    const payload = await Promise.all(videos.map((video) => mapVideo(video)))

    return NextResponse.json({
      data: payload,
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
