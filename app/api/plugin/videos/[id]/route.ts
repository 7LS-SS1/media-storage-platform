import { type NextRequest, NextResponse } from "next/server"
import { getUserFromRequest } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { getSignedPlaybackUrl, normalizeR2Url, toPublicPlaybackUrl } from "@/lib/r2"
import { updateVideoSchema } from "@/lib/validation"

const mapVideo = async (video: {
  id: string
  title: string
  description: string | null
  videoUrl: string
  thumbnailUrl: string | null
  duration: number | null
  createdAt: Date
  updatedAt: Date
  category?: { name: string } | null
}) => {
  const signedUrl = await getSignedPlaybackUrl(video.videoUrl)
  const publicUrl = toPublicPlaybackUrl(video.videoUrl) ?? normalizeR2Url(video.videoUrl)
  return {
    id: video.id,
    title: video.title,
    description: video.description ?? "",
    video_url: signedUrl ?? normalizeR2Url(video.videoUrl),
    playback_url: publicUrl ?? signedUrl ?? normalizeR2Url(video.videoUrl),
    thumbnail_url: normalizeR2Url(video.thumbnailUrl),
    duration: video.duration,
    tags: video.category?.name ? [video.category.name] : [],
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
        category: true,
        createdBy: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
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

    if (video.visibility === "PRIVATE" && video.createdById !== user.userId && user.role !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const normalizedVideoUrl = normalizeR2Url(video.videoUrl) ?? video.videoUrl
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

    if (!["ADMIN", "EDITOR"].includes(user.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const video = await prisma.video.findUnique({
      where: { id: params.id },
    })

    if (!video) {
      return NextResponse.json({ error: "Video not found" }, { status: 404 })
    }

    if (video.createdById !== user.userId && user.role !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const body = await request.json().catch(() => ({}))
    const validatedData = updateVideoSchema.parse(body)

    const updatedVideo = await prisma.video.update({
      where: { id: params.id },
      data: {
        title: validatedData.title,
        description: validatedData.description,
        categoryId: validatedData.categoryId,
        visibility: validatedData.visibility,
        status: validatedData.status,
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

    if (validatedData.visibility === "DOMAIN_RESTRICTED" && validatedData.allowedDomainIds) {
      await prisma.videoAllowedDomain.deleteMany({
        where: { videoId: params.id },
      })

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
    console.error("Plugin update video error:", error)
    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }
    return NextResponse.json({ error: "Failed to update video" }, { status: 500 })
  }
}
