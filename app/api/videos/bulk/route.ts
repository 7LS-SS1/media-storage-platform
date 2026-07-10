import { type NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { getUserFromRequest } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { canManageVideos, canViewAllVideos } from "@/lib/roles"
import { deleteFromR2, extractR2Key } from "@/lib/r2"
import { normalizeTags } from "@/lib/tags"
import { normalizeIdList } from "@/lib/validation"
import { parseStorageBucket } from "@/lib/storage-bucket"

const bulkVideoSchema = z
  .object({
    ids: z.array(z.string().min(1)).min(1).max(100),
    action: z.enum(["update", "delete"]),
    updates: z
      .object({
        visibility: z.enum(["PUBLIC", "PRIVATE", "DOMAIN_RESTRICTED"]).optional(),
        status: z.enum(["PROCESSING", "READY", "FAILED"]).optional(),
        tags: z.array(z.string().min(1).max(50)).max(50).optional(),
        categoryIds: z.array(z.string().min(1)).optional(),
        allowedDomainIds: z.array(z.string().min(1)).optional(),
      })
      .optional(),
  })
  .superRefine((data, ctx) => {
    if (data.action === "update" && !data.updates) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Updates are required",
        path: ["updates"],
      })
    }

    if (
      data.action === "update" &&
      data.updates?.visibility === "DOMAIN_RESTRICTED" &&
      (!data.updates.allowedDomainIds || data.updates.allowedDomainIds.length === 0)
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Allowed domains are required for domain-restricted videos",
        path: ["updates", "allowedDomainIds"],
      })
    }
  })

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
    const payload = bulkVideoSchema.parse(body)
    const ids = normalizeIdList(payload.ids)

    const videos = await prisma.video.findMany({
      where: {
        id: { in: ids },
        ...(canViewAllVideos(user.role) ? {} : { createdById: user.userId }),
      },
      select: {
        id: true,
        videoUrl: true,
        thumbnailUrl: true,
        storageBucket: true,
      },
    })

    if (videos.length === 0) {
      return NextResponse.json({ error: "No matching videos found" }, { status: 404 })
    }

    const foundIds = new Set(videos.map((video) => video.id))
    const skippedIds = ids.filter((id) => !foundIds.has(id))

    if (payload.action === "delete") {
      await Promise.all(
        videos.map(async (video) => {
          const bucket = parseStorageBucket(video.storageBucket)
          const videoKey = extractR2Key(video.videoUrl, bucket)
          const thumbnailKey = video.thumbnailUrl ? extractR2Key(video.thumbnailUrl, bucket) : null

          try {
            if (videoKey) {
              await deleteFromR2(videoKey, bucket)
            }
            if (thumbnailKey) {
              await deleteFromR2(thumbnailKey, bucket)
            }
          } catch (error) {
            console.error("Failed to delete bulk video files:", { videoId: video.id, error })
          }
        }),
      )

      await prisma.video.deleteMany({
        where: { id: { in: videos.map((video) => video.id) } },
      })

      return NextResponse.json({
        message: "Videos deleted successfully",
        deleted: videos.length,
        skippedIds,
      })
    }

    const updates = payload.updates ?? {}
    const categoryIds = updates.categoryIds === undefined ? undefined : normalizeIdList(updates.categoryIds)
    const allowedDomainIds =
      updates.allowedDomainIds === undefined ? undefined : normalizeIdList(updates.allowedDomainIds)

    if (categoryIds && categoryIds.length > 0) {
      const categories = await prisma.category.findMany({
        where: { id: { in: categoryIds } },
        select: { id: true },
      })
      const validCategoryIds = new Set(categories.map((category) => category.id))
      const missingCategoryIds = categoryIds.filter((id) => !validCategoryIds.has(id))
      if (missingCategoryIds.length > 0) {
        return NextResponse.json({ error: "Invalid categoryIds", missingCategoryIds }, { status: 400 })
      }
    }

    if (allowedDomainIds && allowedDomainIds.length > 0) {
      const domains = await prisma.allowedDomain.findMany({
        where: { id: { in: allowedDomainIds } },
        select: { id: true },
      })
      const validDomainIds = new Set(domains.map((domain) => domain.id))
      const missingDomainIds = allowedDomainIds.filter((id) => !validDomainIds.has(id))
      if (missingDomainIds.length > 0) {
        return NextResponse.json({ error: "Invalid allowedDomainIds", missingDomainIds }, { status: 400 })
      }
    }

    await prisma.$transaction(
      videos.map((video) =>
        prisma.video.update({
          where: { id: video.id },
          data: {
            visibility: updates.visibility,
            status: updates.status,
            tags: updates.tags === undefined ? undefined : normalizeTags(updates.tags),
            categories:
              categoryIds === undefined
                ? undefined
                : {
                    set: [],
                    ...(categoryIds.length > 0 ? { connect: categoryIds.map((id) => ({ id })) } : {}),
                  },
            allowedDomains:
              allowedDomainIds === undefined
                ? undefined
                : {
                    deleteMany: {},
                    ...(allowedDomainIds.length > 0
                      ? {
                          create: allowedDomainIds.map((domainId) => ({
                            domain: { connect: { id: domainId } },
                          })),
                        }
                      : {}),
                  },
          },
        }),
      ),
    )

    return NextResponse.json({
      message: "Videos updated successfully",
      updated: videos.length,
      skippedIds,
    })
  } catch (error) {
    console.error("Bulk video action error:", error)
    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }
    return NextResponse.json({ error: "Failed to run bulk video action" }, { status: 500 })
  }
}
