import { type NextRequest, NextResponse } from "next/server"
import { getUserFromRequest } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { createVideoSchema, videoQuerySchema } from "@/lib/validation"

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

    // Build where clause
    const where: any = {
      status: "READY",
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
    const skip = (validatedQuery.page - 1) * validatedQuery.limit
    const take = validatedQuery.limit

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

    return NextResponse.json({
      videos,
      pagination: {
        page: validatedQuery.page,
        limit: validatedQuery.limit,
        total,
        totalPages: Math.ceil(total / validatedQuery.limit),
      },
    })
  } catch (error) {
    console.error("List videos error:", error)
    return NextResponse.json({ error: "Failed to fetch videos" }, { status: 500 })
  }
}
