import { type NextRequest, NextResponse } from "next/server"
import { Prisma } from "@prisma/client"
import { createHash, randomUUID } from "crypto"
import { getUserFromRequest } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { canViewAllVideos } from "@/lib/roles"
import { shouldUseSecureCookies } from "@/lib/cookie-security"

const VIEW_COOKIE = "viewer_id"

const hashViewerKey = (value: string) => createHash("sha256").update(value).digest("hex")

const getViewBucket = (date = new Date()) => date.toISOString().slice(0, 10)

export async function POST(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params
  const user = await getUserFromRequest(request)
  const body = await request.json().catch(() => ({} as Record<string, unknown>))
  const cookieViewerId = request.cookies.get(VIEW_COOKIE)?.value
  const headerViewerId = request.headers.get("x-viewer-id")?.trim()
  const bodyViewerId = typeof body?.viewerId === "string" ? body.viewerId.trim() : ""
  const toNonNegativeInteger = (value: unknown) => {
    const number = Number(value)
    return Number.isFinite(number) ? Math.max(0, Math.round(number)) : 0
  }
  const cdnBytes = BigInt(toNonNegativeInteger(body?.cdnBytes))
  const p2pBytes = BigInt(toNonNegativeInteger(body?.p2pBytes))
  const watchedSec = toNonNegativeInteger(body?.watchedSec)
  const domain = typeof body?.domain === "string" ? body.domain.trim().toLowerCase().slice(0, 255) : null

  const isAuthenticated = Boolean(user)
  const anonymousId = bodyViewerId || headerViewerId || cookieViewerId || randomUUID()
  const viewerKey = hashViewerKey(isAuthenticated ? `user:${user!.userId}` : `anon:${anonymousId}`)

  const video = await prisma.video.findUnique({
    where: { id: params.id },
    select: {
      id: true,
      status: true,
      visibility: true,
      createdById: true,
    },
  })

  if (!video) {
    return NextResponse.json({ error: "Video not found" }, { status: 404 })
  }

  if (video.visibility === "PRIVATE") {
    if (!user || (video.createdById !== user.userId && !canViewAllVideos(user.role))) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }
  }

  if (video.status !== "READY") {
    return NextResponse.json({ counted: false, reason: "not_ready" })
  }

  const viewBucket = getViewBucket()
  let counted = false

  try {
    await prisma.videoView.create({
      data: {
        videoId: video.id,
        viewerKey,
        viewBucket,
        domain,
        cdnBytes,
        p2pBytes,
        watchedSec,
      },
    })

    await prisma.video.update({
      where: { id: video.id },
      data: { views: { increment: 1 } },
    })
    counted = true
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      await prisma.videoView.update({
        where: {
          videoId_viewerKey_viewBucket: {
            videoId: video.id,
            viewerKey,
            viewBucket,
          },
        },
        data: {
          domain,
          cdnBytes,
          p2pBytes,
          watchedSec,
        },
      })
      counted = false
    } else {
      throw error
    }
  }

  const response = NextResponse.json({ counted })
  if (!cookieViewerId && !isAuthenticated) {
    const secureCookie = shouldUseSecureCookies(request)
    response.cookies.set(VIEW_COOKIE, anonymousId, {
      httpOnly: true,
      sameSite: secureCookie ? "none" : "lax",
      secure: secureCookie,
      maxAge: 60 * 60 * 24 * 365,
      path: "/",
    })
  }

  return response
}
