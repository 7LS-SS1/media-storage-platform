import type { NextRequest } from "next/server"
import { prisma } from "./prisma"

export const DOMAIN_ENFORCED_API_PREFIXES = [
  "/api/",
  "/videos",
]

export function normalizeDomain(domain: string): string {
  return domain.trim().toLowerCase().replace(/\.$/, "").replace(/^www\./, "")
}

export function domainsMatch(left: string, right: string): boolean {
  return normalizeDomain(left) === normalizeDomain(right)
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
      .map((ad) => ad.domain.domain)

    // Check if the requesting domain matches any allowed domain
    return allowedDomains.some((allowedDomain) => domainsMatch(domain, allowedDomain))
  }

  return false
}

export async function isDomainGloballyAllowed(domain: string): Promise<boolean> {
  const allowedDomains = await prisma.allowedDomain.findMany({
    where: { isActive: true },
    select: { domain: true },
  })
  return allowedDomains.some((allowedDomain) => domainsMatch(domain, allowedDomain.domain))
}

export function isDomainCheckRequired(pathname: string): boolean {
  return DOMAIN_ENFORCED_API_PREFIXES.some((prefix) => pathname.startsWith(prefix))
}

export async function isRequestDomainAllowed(request: NextRequest): Promise<boolean> {
  const domain = getRequestingDomain(request)
  if (!domain) return false
  return isDomainGloballyAllowed(domain)
}

/**
 * Get requesting domain from request headers
 */
export function getRequestingDomain(request: NextRequest): string | null {
  // Check Origin header first (more reliable for cross-origin API requests)
  const origin = request.headers.get("origin")
  if (origin) {
    const domain = extractDomain(origin)
    if (domain) return domain
  }

  // Fallback to Referer header
  const referer = request.headers.get("referer")
  if (referer) {
    const domain = extractDomain(referer)
    if (domain) return domain
  }

  return null
}
