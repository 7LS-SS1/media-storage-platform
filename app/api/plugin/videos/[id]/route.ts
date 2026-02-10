import { type NextRequest, NextResponse } from "next/server"
import { getUserFromRequest } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { getSignedPlaybackUrl, normalizeR2Url, toPublicPlaybackUrl } from "@/lib/r2"
import { canManageVideos, canViewAllVideos } from "@/lib/roles"
import { normalizeActors, toActorNames } from "@/lib/actors"
import { mergeTags, normalizeTags } from "@/lib/tags"
import { normalizeIdList, updateVideoSchema } from "@/lib/validation"
import { parseStorageBucket } from "@/lib/storage-bucket"

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
    toPublicPlaybackUrl(video.videoUrl, bucket) ?? normalizeR2Url(video.videoUrl, bucket)
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

// GET /videos/{id}
export async function GET(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params
  try {
    const user = await getUserFromRequest(request)
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const video = await prisma.video.findUnique({
      where: { id: params.id },
      include: {
        categories: true,
        createdBy: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
          },
        },
        actors: {
          select: {
            name: true,
          },
        },
        allowedDomains: {
          include: {
            domain: true,
          },
        },
      },
    })

    if (!video) {
      return NextResponse.json({ error: "Video not found" }, { status: 404 })
    }

    if (video.visibility === "PRIVATE" && video.createdById !== user.userId && !canViewAllVideos(user.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const bucket = parseStorageBucket(video.storageBucket)
    const normalizedVideoUrl = normalizeR2Url(video.videoUrl, bucket) ?? video.videoUrl
    const isMp4 =
      video.mimeType?.toLowerCase() === "video/mp4" || normalizedVideoUrl.toLowerCase().endsWith(".mp4")
    if (!isMp4) {
      return NextResponse.json({ error: "Video is still processing" }, { status: 409 })
    }

    const payload = await mapVideo(video)
    return NextResponse.json({ data: payload })
  } catch (error) {
    console.error("Plugin get video error:", error)
    return NextResponse.json({ error: "Failed to fetch video" }, { status: 500 })
  }
}

// PUT /videos/{id}
export async function PUT(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params
  try {
    const user = await getUserFromRequest(request)
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    if (!canManageVideos(user.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const video = await prisma.video.findUnique({
      where: { id: params.id },
    })

    if (!video) {
      return NextResponse.json({ error: "Video not found" }, { status: 404 })
    }

    if (video.createdById !== user.userId && !canViewAllVideos(user.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const body = await request.json().catch(() => ({}))
    const validatedData = updateVideoSchema.parse(body)

    const actors = validatedData.actors === undefined ? null : normalizeActors(validatedData.actors)
    const nextCategoryIds =
      validatedData.categoryIds ??
      (validatedData.categoryId === null
        ? []
        : validatedData.categoryId
          ? [validatedData.categoryId]
          : null)
    const normalizedCategoryIds = nextCategoryIds === null ? null : normalizeIdList(nextCategoryIds)
    const allowedDomainIds =
      validatedData.allowedDomainIds === undefined ? undefined : normalizeIdList(validatedData.allowedDomainIds)

    if (normalizedCategoryIds && normalizedCategoryIds.length > 0) {
      const categories = await prisma.category.findMany({
        where: { id: { in: normalizedCategoryIds } },
        select: { id: true },
      })
      const foundIds = new Set(categories.map((category) => category.id))
      const missingCategoryIds = normalizedCategoryIds.filter((id) => !foundIds.has(id))
      if (missingCategoryIds.length > 0) {
        return NextResponse.json(
          { error: "Invalid categoryIds", missingCategoryIds },
          { status: 400 },
        )
      }
    }

    if (allowedDomainIds && allowedDomainIds.length > 0) {
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
    const updatedVideo = await prisma.video.update({
      where: { id: params.id },
      data: {
        title: validatedData.title,
        description: validatedData.description,
        tags: validatedData.tags === undefined ? undefined : normalizeTags(validatedData.tags),
        visibility: validatedData.visibility,
        status: validatedData.status,
        thumbnailUrl: validatedData.thumbnailUrl === undefined ? undefined : validatedData.thumbnailUrl,
        categories:
          normalizedCategoryIds === null
            ? undefined
            : {
                set: [],
                ...(normalizedCategoryIds.length > 0
                  ? {
                      connect: normalizedCategoryIds.map((id) => ({ id })),
                    }
                  : {}),
              },
        actors:
          actors === null
            ? undefined
            : {
                set: [],
                ...(actors.length > 0
                  ? {
                      connectOrCreate: actors.map((name) => ({
                        where: { name },
                        create: { name },
                      })),
                    }
                  : {}),
              },
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

    if (validatedData.visibility === "DOMAIN_RESTRICTED" && allowedDomainIds && allowedDomainIds.length > 0) {
      await prisma.videoAllowedDomain.deleteMany({
        where: { videoId: params.id },
      })

      await Promise.all(
        allowedDomainIds.map((domainId) =>
          prisma.videoAllowedDomain.create({
            data: {
              videoId: params.id,
              domainId: domainId,
            },
          }),
        ),
      )
    }

    return NextResponse.json({
      message: "Video updated successfully",
      video: {
        ...updatedVideo,
        actors: toActorNames(updatedVideo.actors),
      },
    })
  } catch (error) {
    console.error("Plugin update video error:", error)
    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }
    return NextResponse.json({ error: "Failed to update video" }, { status: 500 })
  }
}
