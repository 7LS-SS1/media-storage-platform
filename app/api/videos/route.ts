import { type NextRequest, NextResponse } from "next/server"
import { getUserFromRequest } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { canManageVideos, canViewAllVideos } from "@/lib/roles"
import { getSignedPlaybackUrl, normalizeR2Url, toPublicPlaybackUrl } from "@/lib/r2"
import { normalizeActors, toActorNames } from "@/lib/actors"
import { mergeTags, normalizeTags } from "@/lib/tags"
import { createVideoSchema, normalizeIdList, videoQuerySchema } from "@/lib/validation"
import { enqueueVideoTranscode, shouldTranscodeToMp4 } from "@/lib/video-transcode"
import { markMp4VideosReady } from "@/lib/video-status"

const mapCategories = (categories?: Array<{ id: string; name: string }> | null) =>
  (categories ?? []).map((category) => ({ id: category.id, name: category.name }))

const mapPluginVideo = (video: {
  id: string
  title: string
  description: string | null
  videoUrl: string
  thumbnailUrl: string | null
  duration: number | null
  createdAt: Date
  updatedAt: Date
  tags: string[]
  categories?: Array<{ id: string; name: string }> | null
  actors?: Array<{ name: string }> | string[] | null
}) => ({
  id: video.id,
  title: video.title,
  description: video.description ?? "",
  video_url: normalizeR2Url(video.videoUrl),
  playback_url: toPublicPlaybackUrl(video.videoUrl) ?? normalizeR2Url(video.videoUrl),
  thumbnail_url: normalizeR2Url(video.thumbnailUrl),
  duration: video.duration,
  tags: mergeTags(video.tags, video.categories ?? []),
  categories: mapCategories(video.categories),
  actors: toActorNames(video.actors),
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

    if (!canManageVideos(user.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const body = await request.json()
    const validatedData = createVideoSchema.parse(body)

    // Create video with relations
    const tags = normalizeTags(validatedData.tags)
    const actors = normalizeActors(validatedData.actors)
    const categoryIds = normalizeIdList(
      validatedData.categoryIds ?? (validatedData.categoryId ? [validatedData.categoryId] : []),
    )
    const allowedDomainIds = normalizeIdList(validatedData.allowedDomainIds)

    if (categoryIds.length > 0) {
      const categories = await prisma.category.findMany({
        where: { id: { in: categoryIds } },
        select: { id: true },
      })
      const foundIds = new Set(categories.map((category) => category.id))
      const missingCategoryIds = categoryIds.filter((id) => !foundIds.has(id))
      if (missingCategoryIds.length > 0) {
        return NextResponse.json(
          { error: "Invalid categoryIds", missingCategoryIds },
          { status: 400 },
        )
      }
    }

    if (allowedDomainIds.length > 0) {
      const domains = await prisma.allowedDomain.findMany({
        where: { id: { in: allowedDomainIds } },
        select: { id: true },
      })
      const foundIds = new Set(domains.map((domain) => domain.id))
      const missingDomainIds = allowedDomainIds.filter((id) => !foundIds.has(id))
      if (missingDomainIds.length > 0) {
        return NextResponse.json(
          { error: "Invalid allowedDomainIds", missingDomainIds },
          { status: 400 },
        )
      }
    }
    const cleanVideoUrl = validatedData.videoUrl.split("?")[0]?.toLowerCase() ?? ""
    const isMp4 = validatedData.mimeType?.toLowerCase() === "video/mp4" || cleanVideoUrl.endsWith(".mp4")
    const shouldTranscode = shouldTranscodeToMp4(validatedData.videoUrl, validatedData.mimeType)

    const video = await prisma.video.create({
      data: {
        title: validatedData.title,
        description: validatedData.description,
        tags,
        videoUrl: validatedData.videoUrl,
        thumbnailUrl: validatedData.thumbnailUrl ?? undefined,
        duration: validatedData.duration,
        fileSize: validatedData.fileSize,
        mimeType: validatedData.mimeType,
        visibility: validatedData.visibility,
        status: shouldTranscode ? "PROCESSING" : "READY",
        transcodeProgress: shouldTranscode ? 0 : isMp4 ? 100 : null,
        createdById: user.userId,
        categories:
          categoryIds.length > 0
            ? {
                connect: categoryIds.map((id) => ({ id })),
              }
            : undefined,
        actors:
          actors.length > 0
            ? {
                connectOrCreate: actors.map((name) => ({
                  where: { name },
                  create: { name },
                })),
              }
            : undefined,
      },
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
    })

    // Add allowed domains if visibility is DOMAIN_RESTRICTED
    if (validatedData.visibility === "DOMAIN_RESTRICTED" && allowedDomainIds.length > 0) {
      await Promise.all(
        allowedDomainIds.map((domainId) =>
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

    const responseVideo = {
      ...video,
      actors: toActorNames(video.actors),
    }

    return NextResponse.json(
      {
        message: "Video created successfully",
        video: responseVideo,
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
    await markMp4VideosReady()

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
      where.categories = { some: { id: validatedQuery.categoryId } }
    }

    // Filter by visibility
    if (validatedQuery.visibility) {
      where.visibility = validatedQuery.visibility
    }

    // Non-admin users can only see public videos and their own
    if (!canViewAllVideos(user.role)) {
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

    const include: Record<string, unknown> = {
      categories: true,
      createdBy: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
    }

    if (isPluginRequest) {
      include.actors = {
        select: {
          name: true,
        },
      }
    }

    // Execute query
    const [videos, total] = await Promise.all([
      prisma.video.findMany({
        where,
        orderBy,
        skip,
        take,
        include,
      }),
      prisma.video.count({ where }),
    ])

    const normalizedVideos = await Promise.all(
      videos.map(async (video) => {
        const resolvedVideoUrl = isPluginRequest ? await getSignedPlaybackUrl(video.videoUrl) : null
        return {
          ...video,
          videoUrl: resolvedVideoUrl ?? normalizeR2Url(video.videoUrl) ?? video.videoUrl,
          thumbnailUrl: normalizeR2Url(video.thumbnailUrl),
        }
      }),
    )

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
