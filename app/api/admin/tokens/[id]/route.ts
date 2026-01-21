import { type NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { getUserFromRequest } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { canManageTokens } from "@/lib/roles"

const MAX_EXPIRY_DAYS = 365

const updateTokenSchema = z
  .object({
    name: z.string().min(1).max(100).optional(),
    expiresInDays: z.number().int().min(1).max(MAX_EXPIRY_DAYS).optional(),
    expiresAt: z.string().optional(),
  })
  .refine((data) => data.name || data.expiresInDays || data.expiresAt, {
    message: "No fields to update",
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

export async function PATCH(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params
  try {
    const user = await getUserFromRequest(request)
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    if (!canManageTokens(user.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const body = await request.json().catch(() => ({}))
    const validatedData = updateTokenSchema.parse(body)

    let expiresAt: Date | undefined
    if (validatedData.expiresAt) {
      const parsed = new Date(validatedData.expiresAt)
      if (Number.isNaN(parsed.getTime())) {
        return NextResponse.json({ error: "Invalid expiresAt value" }, { status: 400 })
      }
      expiresAt = parsed
    } else if (validatedData.expiresInDays) {
      expiresAt = new Date(Date.now() + validatedData.expiresInDays * 24 * 60 * 60 * 1000)
    }

    if (expiresAt && expiresAt <= new Date()) {
      return NextResponse.json({ error: "expiresAt must be in the future" }, { status: 400 })
    }

    const updateData: { name?: string; expiresAt?: Date } = {}
    if (validatedData.name) {
      updateData.name = validatedData.name.trim()
    }
    if (expiresAt) {
      updateData.expiresAt = expiresAt
    }

    const apiToken = await prisma.apiToken.update({
      where: { id: params.id },
      data: updateData,
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

    return NextResponse.json({ apiToken: shapeTokenResponse(apiToken) })
  } catch (error) {
    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }
    return NextResponse.json({ error: "Failed to update token" }, { status: 500 })
  }
}
