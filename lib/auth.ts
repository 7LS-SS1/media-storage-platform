import type { NextRequest } from "next/server"
import { createHash } from "crypto"
import { jwtVerify, SignJWT } from "jose"
import bcrypt from "bcryptjs"
import { prisma } from "@/lib/prisma"
import {
  domainsMatch,
  getRequestingDomain,
  isDomainCheckRequired,
  isDomainGloballyAllowed,
} from "@/lib/domain-security"

const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET || "your-secret-key-change-in-production")

export interface JWTPayload {
  userId: string
  email: string
  role: string
}

export type AuthFailure = {
  code:
    | "missing_token"
    | "invalid_token"
    | "missing_domain"
    | "domain_mismatch"
    | "domain_not_allowed"
  message: string
  status: 401 | 403
  domain?: string | null
  boundDomain?: string | null
  origin?: string | null
  referer?: string | null
}

const authFailures = new WeakMap<NextRequest, AuthFailure>()

const setAuthFailure = (request: NextRequest, failure: AuthFailure) => {
  authFailures.set(request, failure)
}

const shouldLogAcceptedRequests = () => process.env.AUTH_LOG_ACCEPTED_REQUESTS === "true"

export function getAuthFailureFromRequest(request: NextRequest): AuthFailure | null {
  return authFailures.get(request) ?? null
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
  authFailures.delete(request)
  const authHeader = request.headers.get("authorization")
  const headerToken = authHeader?.replace(/^Bearer\s+/i, "")
  const cookieToken = request.cookies.get("token")?.value
  const requiresDomainCheck = isDomainCheckRequired(request.nextUrl.pathname)
  const requestDomain = requiresDomainCheck ? getRequestingDomain(request) : null

  if (headerToken) {
    const jwtPayload = await verifyToken(headerToken)
    if (jwtPayload) {
      if (requiresDomainCheck) {
        if (!requestDomain) {
          setAuthFailure(request, {
            code: "missing_domain",
            message: "Request domain is required for this API token.",
            status: 403,
            origin: request.headers.get("origin"),
            referer: request.headers.get("referer"),
          })
          console.warn("Blocked JWT request without origin/referer domain", {
            path: request.nextUrl.pathname,
            origin: request.headers.get("origin"),
            referer: request.headers.get("referer"),
          })
          return null
        }

        const isAllowedDomain = await isDomainGloballyAllowed(requestDomain)
        if (!isAllowedDomain) {
          setAuthFailure(request, {
            code: "domain_not_allowed",
            message: "Request domain is not globally allowed.",
            status: 403,
            domain: requestDomain,
            origin: request.headers.get("origin"),
            referer: request.headers.get("referer"),
          })
          console.warn("Blocked JWT request from non-allowed domain", {
            path: request.nextUrl.pathname,
            domain: requestDomain,
            origin: request.headers.get("origin"),
            referer: request.headers.get("referer"),
          })
          return null
        }

        if (shouldLogAcceptedRequests()) {
          console.info("Accepted JWT request from allowed domain", {
            path: request.nextUrl.pathname,
            domain: requestDomain,
            strategy: "global_domain_allowlist",
          })
        }
      }

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

    if (!apiToken) {
      setAuthFailure(request, {
        code: "invalid_token",
        message: "API token is invalid, revoked, or expired.",
        status: 401,
      })
      return null
    }

    if (requiresDomainCheck) {
      if (!requestDomain) {
        setAuthFailure(request, {
          code: "missing_domain",
          message: "Request domain is required for this API token.",
          status: 403,
          origin: request.headers.get("origin"),
          referer: request.headers.get("referer"),
        })
        console.warn("Blocked API token request without origin/referer domain", {
          path: request.nextUrl.pathname,
          tokenId: apiToken.id,
          origin: request.headers.get("origin"),
          referer: request.headers.get("referer"),
        })
        return null
      }

      const isAllowedDomain = apiToken.boundDomain
        ? domainsMatch(requestDomain, apiToken.boundDomain)
        : await isDomainGloballyAllowed(requestDomain)

      if (!isAllowedDomain) {
        const isBoundToken = Boolean(apiToken.boundDomain)
        setAuthFailure(request, {
          code: isBoundToken ? "domain_mismatch" : "domain_not_allowed",
          message: isBoundToken
            ? `API token is bound to ${apiToken.boundDomain}, but the request came from ${requestDomain}.`
            : "Request domain is not globally allowed.",
          status: 403,
          domain: requestDomain,
          boundDomain: apiToken.boundDomain,
          origin: request.headers.get("origin"),
          referer: request.headers.get("referer"),
        })
        console.warn("Blocked API token request from non-allowed domain", {
          path: request.nextUrl.pathname,
          tokenId: apiToken.id,
          domain: requestDomain,
          boundDomain: apiToken.boundDomain,
          strategy: apiToken.boundDomain ? "token_bound_domain" : "global_domain_allowlist",
          origin: request.headers.get("origin"),
          referer: request.headers.get("referer"),
        })
        return null
      }

      if (shouldLogAcceptedRequests()) {
        console.info("Accepted API token request from allowed domain", {
          path: request.nextUrl.pathname,
          tokenId: apiToken.id,
          domain: requestDomain,
          boundDomain: apiToken.boundDomain,
          strategy: apiToken.boundDomain ? "token_bound_domain" : "global_domain_allowlist",
        })
      }
    }

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

  if (!cookieToken) {
    setAuthFailure(request, {
      code: "missing_token",
      message: "Authentication token is required.",
      status: 401,
    })
    return null
  }

  const verifiedCookieToken = await verifyToken(cookieToken)
  if (!verifiedCookieToken) {
    setAuthFailure(request, {
      code: "invalid_token",
      message: "Authentication token is invalid or expired.",
      status: 401,
    })
  }

  return verifiedCookieToken
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
