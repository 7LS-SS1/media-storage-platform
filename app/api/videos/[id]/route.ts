import { type NextRequest, NextResponse } from "next/server"
import { getUserFromRequest } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { getSignedPlaybackUrl, normalizeR2Url, toPublicPlaybackUrl } from "@/lib/r2"
import { normalizeActors } from "@/lib/actors"
import { mergeTags, normalizeTags } from "@/lib/tags"
import { updateVideoSchema } from "@/lib/validation"

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
  category?: { name: string } | null
}) => ({
  id: video.id,
  title: video.title,
  description: video.description ?? "",
  video_url: normalizeR2Url(video.videoUrl),
  playback_url: toPublicPlaybackUrl(video.videoUrl) ?? normalizeR2Url(video.videoUrl),
  thumbnail_url: normalizeR2Url(video.thumbnailUrl),
  duration: video.duration,
  tags: mergeTags(video.tags, video.category),
  created_at: video.createdAt,
  updated_at: video.updatedAt,
})
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
        category: true,
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

    // Check access permissions
    if (video.visibility === "PRIVATE" && video.createdById !== user.userId && user.role !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    // Increment view count
    await prisma.video.update({
      where: { id: params.id },
      data: { views: { increment: 1 } },
    })

    const userAgent = request.headers.get("user-agent") ?? ""
    const isPluginRequest = Boolean(request.headers.get("authorization")) || userAgent.includes("7LS-Video-Publisher")
    const resolvedVideoUrl = await getSignedPlaybackUrl(video.videoUrl)
    const actorNames = video.actors.map((actor) => actor.name)
    const normalizedVideo = {
      ...video,
      actors: actorNames,
      videoUrl: resolvedVideoUrl ?? normalizeR2Url(video.videoUrl) ?? video.videoUrl,
      thumbnailUrl: normalizeR2Url(video.thumbnailUrl),
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

    if (!["ADMIN", "EDITOR"].includes(user.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const video = await prisma.video.findUnique({
      where: { id: params.id },
    })

    if (!video) {
      return NextResponse.json({ error: "Video not found" }, { status: 404 })
    }

    // Only admin or owner can update
    if (video.createdById !== user.userId && user.role !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const body = await request.json()
    const validatedData = updateVideoSchema.parse(body)
    const actors =
      validatedData.actors === undefined ? null : normalizeActors(validatedData.actors)

    // Update video
    const updatedVideo = await prisma.video.update({
      where: { id: params.id },
      data: {
        title: validatedData.title,
        description: validatedData.description,
        tags: validatedData.tags === undefined ? undefined : normalizeTags(validatedData.tags),
        categoryId: validatedData.categoryId,
        visibility: validatedData.visibility,
        status: validatedData.status,
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

    // Update allowed domains if needed
    if (validatedData.visibility === "DOMAIN_RESTRICTED" && validatedData.allowedDomainIds) {
      // Remove existing relations
      await prisma.videoAllowedDomain.deleteMany({
        where: { videoId: params.id },
      })

      // Add new relations
      await Promise.all(
        validatedData.allowedDomainIds.map((domainId) =>
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
      video: updatedVideo,
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

    if (user.role !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden - Only admin can delete videos" }, { status: 403 })
    }

    const video = await prisma.video.findUnique({
      where: { id: params.id },
    })

    if (!video) {
      return NextResponse.json({ error: "Video not found" }, { status: 404 })
    }

    // Delete video file from R2
    try {
      const videoKey = video.videoUrl.split("/").pop()
      if (videoKey) {
        await deleteFromR2(videoKey)
      }

      // Delete thumbnail if exists
      if (video.thumbnailUrl) {
        const thumbnailKey = video.thumbnailUrl.split("/").pop()
        if (thumbnailKey) {
          await deleteFromR2(thumbnailKey)
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
