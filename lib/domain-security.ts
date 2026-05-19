import type { NextRequest } from "next/server"
import type { Prisma } from "@prisma/client"
import { prisma } from "./prisma"

export const DOMAIN_ENFORCED_API_PREFIXES = [
  "/api/",
  "/videos",
]

export function normalizeDomain(domain: string): string {
  return domain.trim().toLowerCase().replace(/\.$/, "").replace(/^www\./, "")
}

export function normalizeDomainInput(value: string): string {
  const trimmed = value.trim()
  if (!trimmed) {
    throw new Error("Domain is required")
  }

  const normalizedUrl = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`
  const extracted = extractDomain(normalizedUrl)

  if (!extracted) {
    throw new Error("Invalid domain URL")
  }

  return normalizeDomain(extracted)
}

export function domainsMatch(left: string, right: string): boolean {
  return normalizeDomain(left) === normalizeDomain(right)
}

function isProductionEnvironment(): boolean {
  return process.env.NODE_ENV === "production"
}

function isLocalDomain(domain: string): boolean {
  const normalized = normalizeDomain(domain)
  return (
    normalized === "localhost" ||
    normalized === "127.0.0.1" ||
    normalized === "::1" ||
    normalized.endsWith(".local")
  )
}

function isAllowedDomainEntry(domain: string): boolean {
  if (!isProductionEnvironment()) return true
  return !isLocalDomain(domain)
}

export function isRequestDomainAcceptable(domain: string): boolean {
  if (!isProductionEnvironment()) return true
  return !isLocalDomain(domain)
}

/**
 * Extract domain from URL
 */
export function extractDomain(url: string): string | null {
  try {
    const urlObj = new URL(url)
    return normalizeDomain(urlObj.hostname)
  } catch {
    return null
  }
}

/**
 * Check if domain is allowed for video
 */
export async function isDomainAllowedForVideo(videoId: string, domain: string): Promise<boolean> {
  const video = await prisma.video.findUnique({
    where: { id: videoId },
    include: {
      allowedDomains: {
        include: {
          domain: true,
        },
      },
    },
  })

  if (!video) return false

  // Public videos are accessible from anywhere
  if (video.visibility === "PUBLIC") return true

  // Private videos are not accessible via embed
  if (video.visibility === "PRIVATE") return false

  // Domain-restricted videos
  if (video.visibility === "DOMAIN_RESTRICTED") {
    const allowedDomains = video.allowedDomains
      .filter((ad) => ad.domain.isActive)
      .filter((ad) => isAllowedDomainEntry(ad.domain.domain))
      .map((ad) => ad.domain.domain)

    // Check if the requesting domain matches any allowed domain
    return allowedDomains.some((allowedDomain) => domainsMatch(domain, allowedDomain))
  }

  return false
}

export async function isDomainGloballyAllowed(domain: string): Promise<boolean> {
  const normalizedDomain = normalizeDomain(domain)

  if (!isRequestDomainAcceptable(normalizedDomain)) {
    return false
  }

  const allowedDomain = await prisma.allowedDomain.findFirst({
    where: {
      isActive: true,
      domain: normalizedDomain,
    },
    select: { id: true },
  })

  return Boolean(allowedDomain)
}

export function isDomainCheckRequired(pathname: string): boolean {
  return DOMAIN_ENFORCED_API_PREFIXES.some((prefix) => pathname.startsWith(prefix))
}

export async function isRequestDomainAllowed(request: NextRequest): Promise<boolean> {
  const domain = getRequestingDomain(request)
  if (!domain) return false
  return isDomainGloballyAllowed(domain)
}

export async function getVerifiedRequestDomain(request: NextRequest): Promise<string | null> {
  const domain = getRequestingDomain(request)
  if (!domain) return null

  const isAllowed = await isDomainGloballyAllowed(domain)
  if (!isAllowed) return null

  return normalizeDomain(domain)
}

export function buildVideoAccessWhereForDomain(domain: string): Prisma.VideoWhereInput {
  const normalizedDomain = normalizeDomain(domain)

  return {
    OR: [
      { visibility: "PUBLIC" },
      {
        visibility: "DOMAIN_RESTRICTED",
        allowedDomains: {
          some: {
            domain: {
              isActive: true,
              domain: normalizedDomain,
            },
          },
        },
      },
    ],
  }
}

type DomainScopedVideo = {
  visibility: string
  allowedDomains?: Array<{
    domain: {
      domain: string
      isActive: boolean
    }
  }> | null
}

export function canDomainAccessVideo(video: DomainScopedVideo, domain: string | null): boolean {
  if (video.visibility === "PUBLIC") {
    return true
  }

  if (video.visibility !== "DOMAIN_RESTRICTED" || !domain) {
    return false
  }

  return (video.allowedDomains ?? []).some(
    ({ domain: allowedDomain }) =>
      allowedDomain.isActive &&
      isAllowedDomainEntry(allowedDomain.domain) &&
      domainsMatch(domain, allowedDomain.domain),
  )
}

type HeaderSource = Pick<Headers, "get">

export function getRequestingDomainFromHeaders(headers: HeaderSource): string | null {
  // Check Origin header first (more reliable for cross-origin API requests)
  const origin = headers.get("origin")
  if (origin) {
    const domain = extractDomain(origin)
    if (domain) return domain
  }

  // Fallback to Referer header
  const referer = headers.get("referer")
  if (referer) {
    const domain = extractDomain(referer)
    if (domain) return domain
  }

  // Fallback for server-to-server WordPress plugin requests.
  const sevenLsOrigin = headers.get("x-sevenls-origin")
  if (sevenLsOrigin) {
    const domain = extractDomain(sevenLsOrigin)
    if (domain) return domain
  }

  const sevenLsReferer = headers.get("x-sevenls-referer")
  if (sevenLsReferer) {
    const domain = extractDomain(sevenLsReferer)
    if (domain) return domain
  }

  return null
}

/**
 * Get requesting domain from request headers
 */
export function getRequestingDomain(request: NextRequest): string | null {
  return getRequestingDomainFromHeaders(request.headers)
}
