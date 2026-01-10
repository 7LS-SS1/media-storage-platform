import { type NextRequest, NextResponse } from "next/server"
import { randomBytes } from "crypto"
import { z } from "zod"
import { getUserFromRequest, hashApiToken } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

const DEFAULT_EXPIRY_DAYS = 30
const MAX_EXPIRY_DAYS = 365

const adminTokenSchema = z.object({
  name: z.string().min(1).max(100),
  expiresInDays: z.number().int().min(1).max(MAX_EXPIRY_DAYS).optional(),
})

const shapeTokenResponse = (token: {
  id: string
  name: string
  tokenLast4: string
  createdAt: Date
  expiresAt: Date
  lastUsedAt: Date | null
  revokedAt: Date | null
  createdBy: { id: string; name: string | null; email: string }
}) => ({
  id: token.id,
  name: token.name,
  last4: token.tokenLast4,
  createdAt: token.createdAt,
  expiresAt: token.expiresAt,
  lastUsedAt: token.lastUsedAt,
  revokedAt: token.revokedAt,
  createdBy: token.createdBy,
})

export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request)
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    if (user.role !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const tokens = await prisma.apiToken.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        createdBy: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    })

    return NextResponse.json({
      tokens: tokens.map((token) => shapeTokenResponse(token)),
    })
  } catch (error) {
    console.error("List admin tokens error:", error)
    return NextResponse.json({ error: "Failed to fetch tokens" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request)
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    if (user.role !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const body = await request.json().catch(() => ({}))
    const validatedData = adminTokenSchema.parse(body)
    const expiresInDays = validatedData.expiresInDays ?? DEFAULT_EXPIRY_DAYS
    const expiresAt = new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000)

    const rawToken = `api_${randomBytes(32).toString("hex")}`
    const tokenHash = hashApiToken(rawToken)

    const apiToken = await prisma.apiToken.create({
      data: {
        name: validatedData.name.trim(),
        tokenHash,
        tokenLast4: rawToken.slice(-4),
        expiresAt,
        createdById: user.userId,
      },
      include: {
        createdBy: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    })

    return NextResponse.json({
      token: rawToken,
      apiToken: shapeTokenResponse(apiToken),
    })
  } catch (error) {
    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }
    return NextResponse.json({ error: "Failed to generate token" }, { status: 500 })
  }
}
