import { type NextRequest, NextResponse } from "next/server"
import { getUserFromRequest } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { canViewAllVideos } from "@/lib/roles"

export async function GET(request: NextRequest) {
  const user = await getUserFromRequest(request)
  if (!user || !canViewAllVideos(user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const [totalVideos, totalDomains, totals] = await Promise.all([
    prisma.video.count({ where: { status: "READY" } }),
    prisma.allowedDomain.count({ where: { isActive: true } }),
    prisma.videoView.aggregate({
      _count: { id: true },
      _sum: { cdnBytes: true, p2pBytes: true },
    }),
  ])

  const cdnBytes = Number(totals._sum.cdnBytes ?? BigInt(0))
  const p2pBytes = Number(totals._sum.p2pBytes ?? BigInt(0))
  const transferredBytes = cdnBytes + p2pBytes

  return NextResponse.json({
    data: {
      total_videos: totalVideos,
      total_domains: totalDomains,
      total_views: totals._count.id,
      total_cdn_bytes: cdnBytes,
      total_p2p_bytes: p2pBytes,
      p2p_ratio: transferredBytes > 0 ? (p2pBytes / transferredBytes) * 100 : 0,
      bandwidth_saved: p2pBytes,
    },
  })
}
