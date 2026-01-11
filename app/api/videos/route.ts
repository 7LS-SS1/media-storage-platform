import { type NextRequest, NextResponse } from "next/server"
import { getUserFromRequest } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { normalizeR2Url } from "@/lib/r2"
import { createVideoSchema, videoQuerySchema } from "@/lib/validation"
import { enqueueVideoTranscode } from "@/lib/video-transcode"

const mapPluginVideo = (video: {
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

// POST - Create new video
export async function POST(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request)
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    if (!["ADMIN", "EDITOR"].includes(user.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const body = await request.json()
    const validatedData = createVideoSchema.parse(body)

    // Create video with relations
    const video = await prisma.video.create({
      data: {
        title: validatedData.title,
        description: validatedData.description,
        videoUrl: body.videoUrl, // From upload endpoint
        thumbnailUrl: body.thumbnailUrl,
        duration: body.duration,
        fileSize: body.fileSize,
        mimeType: body.mimeType,
        visibility: validatedData.visibility,
        status: "READY",
        categoryId: validatedData.categoryId,
        createdById: user.userId,
      },
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
    })

    // Add allowed domains if visibility is DOMAIN_RESTRICTED
    if (validatedData.visibility === "DOMAIN_RESTRICTED" && validatedData.allowedDomainIds) {
      await Promise.all(
        validatedData.allowedDomainIds.map((domainId) =>
          prisma.videoAllowedDomain.create({
            data: {
              videoId: video.id,
              domainId: domainId,
            },
          }),
        ),
      )
    }

    enqueueVideoTranscode(video.id, video.videoUrl, video.mimeType)

    return NextResponse.json(
      {
        message: "Video created successfully",
        video,
      },
      { status: 201 },
    )
  } catch (error) {
    console.error("Create video error:", error)
    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }
    return NextResponse.json({ error: "Failed to create video" }, { status: 500 })
  }
}

// GET - List videos with filters
export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request)
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const query = Object.fromEntries(searchParams.entries())
    const validatedQuery = videoQuerySchema.parse(query)
    const limit = validatedQuery.per_page ?? validatedQuery.limit
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
    const userAgent = request.headers.get("user-agent") ?? ""
    const isPluginRequest =
      searchParams.has("per_page") ||
      searchParams.has("project_id") ||
      searchParams.has("since") ||
      userAgent.includes("7LS-Video-Publisher")

    // Build where clause
    const where: any = {
      status: "READY",
    }
    if (isPluginRequest) {
      const mp4Filter = { OR: [{ mimeType: "video/mp4" }, { videoUrl: { endsWith: ".mp4" } }] }
      if (Array.isArray(where.AND)) {
        where.AND.push(mp4Filter)
      } else {
        where.AND = [mp4Filter]
      }
    }

    // Search by title or description
    if (validatedQuery.search) {
      where.OR = [
        { title: { contains: validatedQuery.search, mode: "insensitive" } },
        { description: { contains: validatedQuery.search, mode: "insensitive" } },
      ]
    }

    // Filter by category
    if (validatedQuery.categoryId) {
      where.categoryId = validatedQuery.categoryId
    }

    // Filter by visibility
    if (validatedQuery.visibility) {
      where.visibility = validatedQuery.visibility
    }

    // Non-admin users can only see public videos and their own
    if (user.role !== "ADMIN") {
      where.OR = [{ visibility: "PUBLIC" }, { createdById: user.userId }]
    }

    if (validatedQuery.since) {
      const sinceDate = parseSinceDate(validatedQuery.since)
      if (sinceDate) {
        where.updatedAt = { gt: sinceDate }
      }
    }

    // Sorting
    const orderBy: any = {}
    if (validatedQuery.sort === "newest") {
      orderBy.createdAt = "desc"
    } else if (validatedQuery.sort === "oldest") {
      orderBy.createdAt = "asc"
    } else if (validatedQuery.sort === "popular") {
      orderBy.views = "desc"
    }

    // Pagination
    const skip = (validatedQuery.page - 1) * limit
    const take = limit

    // Execute query
    const [videos, total] = await Promise.all([
      prisma.video.findMany({
        where,
        orderBy,
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

    const normalizedVideos = videos.map((video) => ({
      ...video,
      videoUrl: normalizeR2Url(video.videoUrl) ?? video.videoUrl,
      thumbnailUrl: normalizeR2Url(video.thumbnailUrl),
    }))

    if (isPluginRequest) {
      const totalPages = Math.ceil(total / limit)
      const hasMore = validatedQuery.page * limit < total

      return NextResponse.json({
        data: normalizedVideos.map((video) => mapPluginVideo(video)),
        pagination: {
          page: validatedQuery.page,
          per_page: limit,
          total,
          total_pages: totalPages,
          next_page: hasMore ? validatedQuery.page + 1 : null,
          has_more: hasMore,
        },
      })
    }

    return NextResponse.json({
      videos: normalizedVideos,
      pagination: {
        page: validatedQuery.page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    })
  } catch (error) {
    console.error("List videos error:", error)
    return NextResponse.json({ error: "Failed to fetch videos" }, { status: 500 })
  }
}
