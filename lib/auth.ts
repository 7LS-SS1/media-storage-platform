import type { NextRequest } from "next/server"
import { createHash } from "crypto"
import { jwtVerify, SignJWT } from "jose"
import bcrypt from "bcryptjs"
import { prisma } from "@/lib/prisma"
import { getRequestingDomain, isDomainCheckRequired, isRequestDomainAllowed } from "@/lib/domain-security"

const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET || "your-secret-key-change-in-production")

export interface JWTPayload {
  userId: string
  email: string
  role: string
}

/**
 * Generate JWT Token
 */
export async function generateToken(payload: JWTPayload, expiresIn = "7d"): Promise<string> {
  return await new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime(expiresIn)
    .setIssuedAt()
    .sign(JWT_SECRET)
}

/**
 * Verify JWT Token
 */
export async function verifyToken(token: string): Promise<JWTPayload | null> {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET)
    return payload as JWTPayload
  } catch (error) {
    return null
  }
}

export function hashApiToken(token: string): string {
  return createHash("sha256").update(token).digest("hex")
}

/**
 * Get user from request
 */
export async function getUserFromRequest(request: NextRequest): Promise<JWTPayload | null> {
  const authHeader = request.headers.get("authorization")
  const headerToken = authHeader?.replace(/^Bearer\s+/i, "")
  const cookieToken = request.cookies.get("token")?.value

  if (headerToken) {
    if (isDomainCheckRequired(request.nextUrl.pathname)) {
      const requestDomain = getRequestingDomain(request)
      const isAllowedDomain = await isRequestDomainAllowed(request)
      if (!isAllowedDomain) {
        console.warn("Blocked token request from non-allowed domain", {
          path: request.nextUrl.pathname,
          domain: requestDomain,
          origin: request.headers.get("origin"),
          referer: request.headers.get("referer"),
        })
        return null
      }
      console.info("Accepted token request from allowed domain", {
        path: request.nextUrl.pathname,
        domain: requestDomain,
      })
    }

    const jwtPayload = await verifyToken(headerToken)
    if (jwtPayload) {
      return jwtPayload
    }

    const tokenHash = hashApiToken(headerToken)
    const apiToken = await prisma.apiToken.findFirst({
      where: {
        tokenHash,
        revokedAt: null,
        OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
      },
      include: {
        createdBy: {
          select: {
            id: true,
            email: true,
            role: true,
          },
        },
      },
    })

    if (!apiToken) return null

    await prisma.apiToken.update({
      where: { id: apiToken.id },
      data: { lastUsedAt: new Date() },
    })

    return {
      userId: apiToken.createdById,
      email: apiToken.createdBy.email,
      role: apiToken.createdBy.role,
    }
  }

  if (!cookieToken) return null

  return await verifyToken(cookieToken)
}

/**
 * Hash password
 */
export async function hashPassword(password: string): Promise<string> {
  return await bcrypt.hash(password, 10)
}

/**
 * Compare password
 */
export async function comparePassword(password: string, hash: string): Promise<boolean> {
  return await bcrypt.compare(password, hash)
}

/**
 * Check if user has required role
 */
export function hasRequiredRole(userRole: string, requiredRoles: string[]): boolean {
  return requiredRoles.includes(userRole)
}
