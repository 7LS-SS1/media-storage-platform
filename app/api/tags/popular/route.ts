import { type NextRequest, NextResponse } from "next/server"
import { getUserFromRequest } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { canManageVideos } from "@/lib/roles"
import { parseStorageBucket } from "@/lib/storage-bucket"

const DEFAULT_LIMIT = 20
const MAX_LIMIT = 50

export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request)
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    if (!canManageVideos(user.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const limitParam = Number.parseInt(request.nextUrl.searchParams.get("limit") || "", 10)
    const limit =
      Number.isFinite(limitParam) && limitParam > 0 ? Math.min(limitParam, MAX_LIMIT) : DEFAULT_LIMIT
    const storageBucket = parseStorageBucket(request.nextUrl.searchParams.get("storageBucket"))

    const videos = await prisma.video.findMany({
      where: { storageBucket },
      select: { tags: true },
    })

    const tagCounts = new Map<string, { tag: string; count: number }>()

    for (const video of videos) {
      const seenInVideo = new Set<string>()

      for (const rawTag of video.tags ?? []) {
        const cleaned = rawTag.trim()
        if (!cleaned) continue

        const normalized = cleaned.toLowerCase()
        if (seenInVideo.has(normalized)) continue
        seenInVideo.add(normalized)

        const current = tagCounts.get(normalized)
        if (current) {
          current.count += 1
        } else {
          tagCounts.set(normalized, { tag: cleaned, count: 1 })
        }
      }
    }

    const tags = [...tagCounts.values()]
      .sort((left, right) => right.count - left.count || left.tag.localeCompare(right.tag, "th"))
      .slice(0, limit)

    return NextResponse.json({
      storageBucket,
      limit,
      tags,
    })
  } catch (error) {
    console.error("Popular tags error:", error)
    return NextResponse.json({ error: "Failed to fetch popular tags" }, { status: 500 })
  }
}
