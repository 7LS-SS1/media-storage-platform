import { type NextRequest, NextResponse } from "next/server"
import { getUserFromRequest } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { canManageVideos, canViewAllVideos } from "@/lib/roles"
import { extractR2Key, getSignedPlaybackUrl, normalizeR2Url, toPublicPlaybackUrl } from "@/lib/r2"
import { normalizeActors, toActorNames } from "@/lib/actors"
import { mergeTags, normalizeTags } from "@/lib/tags"
import { normalizeIdList, updateVideoSchema } from "@/lib/validation"
import { markMp4VideosReady } from "@/lib/video-status"
import { parseStorageBucket } from "@/lib/storage-bucket"

const mapCategories = (categories?: Array<{ id: string; name: string }> | null) =>
  (categories ?? []).map((category) => ({ id: category.id, name: category.name }))

const mapPluginVideo = (video: {
  id: string
  title: string
  targetKeyword: string
  description: string | null
  movieCode: string | null
  studio: string | null
  releaseDate: Date | null
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
  return {
    id: video.id,
    title: video.title,
    target_keyword: video.targetKeyword,
    description: video.description ?? "",
    movie_code: video.movieCode ?? null,
    studio: video.studio ?? null,
    release_date: video.releaseDate ?? null,
    video_url: normalizeR2Url(video.videoUrl, bucket) ?? video.videoUrl,
    playback_url:
      toPublicPlaybackUrl(video.videoUrl, bucket) ?? normalizeR2Url(video.videoUrl, bucket) ?? video.videoUrl,
    thumbnail_url: normalizeR2Url(video.thumbnailUrl, bucket),
    duration: video.duration,
    tags: mergeTags(video.tags, video.categories ?? []),
    categories: mapCategories(video.categories),
    actors: toActorNames(video.actors),
    created_at: video.createdAt,
    updated_at: video.updatedAt,
  }
}
import { deleteFromR2 } from "@/lib/r2"

// GET - Get video by ID
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
        categories: {
          select: {
            id: true,
            name: true,
          },
        },
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

    const bucket = parseStorageBucket(video.storageBucket)

    // Check access permissions
    if (video.visibility === "PRIVATE" && video.createdById !== user.userId && !canViewAllVideos(user.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const statusUpdate = await markMp4VideosReady({ ids: [params.id] })
    if (statusUpdate.count > 0) {
      video.status = "READY"
      video.transcodeProgress = 100
    }

    const userAgent = request.headers.get("user-agent") ?? ""
    const isPluginRequest = Boolean(request.headers.get("authorization")) || userAgent.includes("7LS-Video-Publisher")
    const resolvedVideoUrl = await getSignedPlaybackUrl(video.videoUrl, 3600, bucket)
    const actorNames = video.actors.map((actor) => actor.name)
    const normalizedVideo = {
      ...video,
      actors: actorNames,
      fileSize: video.fileSize === null || video.fileSize === undefined ? null : Number(video.fileSize),
      videoUrl: resolvedVideoUrl ?? normalizeR2Url(video.videoUrl, bucket) ?? video.videoUrl,
      thumbnailUrl: normalizeR2Url(video.thumbnailUrl, bucket),
    }

    if (isPluginRequest) {
      const cleanUrl = normalizedVideo.videoUrl.split("?")[0].toLowerCase()
      const isMp4 = video.mimeType?.toLowerCase() === "video/mp4" || cleanUrl.endsWith(".mp4")
      if (!isMp4) {
        return NextResponse.json({ error: "Video is still processing" }, { status: 409 })
      }
      return NextResponse.json({ data: mapPluginVideo(normalizedVideo) })
    }

    return NextResponse.json({ video: normalizedVideo })
  } catch (error) {
    console.error("Get video error:", error)
    return NextResponse.json({ error: "Failed to fetch video" }, { status: 500 })
  }
}

// PUT - Update video
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

    const bucket = parseStorageBucket(video.storageBucket)

    // Only admin or owner can update
    if (video.createdById !== user.userId && !canViewAllVideos(user.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const body = await request.json()
    const validatedData = updateVideoSchema.parse(body)
    const actors = validatedData.actors === undefined ? null : normalizeActors(validatedData.actors)
    const shouldUpdateThumbnail = validatedData.thumbnailUrl !== undefined
    const previousThumbnailUrl = video.thumbnailUrl ?? null
    const shouldUpdateMovieFields =
      validatedData.movieCode !== undefined ||
      validatedData.studio !== undefined ||
      validatedData.releaseDate !== undefined

    if (validatedData.studio) {
      const studioName = validatedData.studio.trim()
      if (studioName) {
        await prisma.studio.upsert({
          where: { name: studioName },
          update: {},
          create: { name: studioName },
        })
      }
    }

    // Update video
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
        targetKeyword: validatedData.targetKeyword,
        description: validatedData.description,
        movieCode: shouldUpdateMovieFields ? validatedData.movieCode : undefined,
        studio: shouldUpdateMovieFields ? validatedData.studio : undefined,
        releaseDate: shouldUpdateMovieFields ? validatedData.releaseDate : undefined,
        tags: validatedData.tags === undefined ? undefined : normalizeTags(validatedData.tags),
        visibility: validatedData.visibility,
        status: validatedData.status,
        thumbnailUrl: shouldUpdateThumbnail ? validatedData.thumbnailUrl : undefined,
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
        categories: {
          select: {
            id: true,
            name: true,
          },
        },
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

    // Update allowed domains if needed
    if (validatedData.visibility === "DOMAIN_RESTRICTED" && allowedDomainIds && allowedDomainIds.length > 0) {
      // Remove existing relations
      await prisma.videoAllowedDomain.deleteMany({
        where: { videoId: params.id },
      })

      // Add new relations
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

    if (shouldUpdateThumbnail && previousThumbnailUrl && previousThumbnailUrl !== validatedData.thumbnailUrl) {
      try {
        const thumbnailKey = extractR2Key(previousThumbnailUrl, bucket)
        if (thumbnailKey) {
          await deleteFromR2(thumbnailKey, bucket)
        }
      } catch (error) {
        console.error("Failed to delete old thumbnail:", error)
      }
    }

    return NextResponse.json({
      message: "Video updated successfully",
      video: {
        ...updatedVideo,
        fileSize:
          updatedVideo.fileSize === null || updatedVideo.fileSize === undefined
            ? null
            : Number(updatedVideo.fileSize),
        actors: toActorNames(updatedVideo.actors),
      },
    })
  } catch (error) {
    console.error("Update video error:", error)
    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }
    return NextResponse.json({ error: "Failed to update video" }, { status: 500 })
  }
}

// DELETE - Delete video
export async function DELETE(request: NextRequest, props: { params: Promise<{ id: string }> }) {
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

    const bucket = parseStorageBucket(video.storageBucket)

    if (video.createdById !== user.userId && !canViewAllVideos(user.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    // Delete video file from R2
    try {
      const videoKey = extractR2Key(video.videoUrl, bucket)
      if (videoKey) {
        await deleteFromR2(videoKey, bucket)
      }

      // Delete thumbnail if exists
      if (video.thumbnailUrl) {
        const thumbnailKey = extractR2Key(video.thumbnailUrl, bucket)
        if (thumbnailKey) {
          await deleteFromR2(thumbnailKey, bucket)
        }
      }
    } catch (error) {
      console.error("Failed to delete files from R2:", error)
    }

    // Delete video from database (cascade will handle relations)
    await prisma.video.delete({
      where: { id: params.id },
    })

    return NextResponse.json({
      message: "Video deleted successfully",
    })
  } catch (error) {
    console.error("Delete video error:", error)
    return NextResponse.json({ error: "Failed to delete video" }, { status: 500 })
  }
}
