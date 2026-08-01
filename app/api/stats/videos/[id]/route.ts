import { type NextRequest, NextResponse } from "next/server"
import { getUserFromRequest } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { canViewAllVideos } from "@/lib/roles"

export async function GET(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const user = await getUserFromRequest(request)
  if (!user || !canViewAllVideos(user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const { id } = await props.params
  const rows = await prisma.videoView.findMany({
    where: { videoId: id },
    orderBy: { createdAt: "desc" },
    take: 1000,
    select: {
      createdAt: true,
      cdnBytes: true,
      p2pBytes: true,
      watchedSec: true,
      domain: true,
    },
  })

  const byDate = new Map<string, { views: number; cdn: number; p2p: number; watched: number }>()
  for (const row of rows) {
    const date = row.createdAt.toISOString().slice(0, 10)
    const current = byDate.get(date) ?? { views: 0, cdn: 0, p2p: 0, watched: 0 }
    current.views += 1
    current.cdn += Number(row.cdnBytes)
    current.p2p += Number(row.p2pBytes)
    current.watched += row.watchedSec
    byDate.set(date, current)
  }

  return NextResponse.json({
    data: Array.from(byDate, ([date, value]) => ({
      date,
      views: value.views,
      cdn: value.cdn,
      p2p: value.p2p,
      avg_watch: value.views > 0 ? value.watched / value.views : 0,
    })),
  })
}
