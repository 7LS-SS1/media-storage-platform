import type { NextRequest } from "next/server"
import { prisma } from "./prisma"

/**
 * Extract domain from URL
 */
export function extractDomain(url: string): string | null {
  try {
    const urlObj = new URL(url)
    return urlObj.hostname
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
    const allowedDomains = video.allowedDomains.map((ad) => ad.domain.domain)

    // Check if the requesting domain matches any allowed domain
    return allowedDomains.some((allowedDomain) => {
      // Normalize domains (remove www. prefix)
      const normalizedRequesting = domain.replace(/^www\./, "")
      const normalizedAllowed = allowedDomain.replace(/^www\./, "")
      return normalizedRequesting === normalizedAllowed
    })
  }

  return false
}

/**
 * Get requesting domain from request headers
 */
export function getRequestingDomain(request: NextRequest): string | null {
  // Check Referer header
  const referer = request.headers.get("referer")
  if (referer) {
    const domain = extractDomain(referer)
    if (domain) return domain
  }

  // Check Origin header
  const origin = request.headers.get("origin")
  if (origin) {
    const domain = extractDomain(origin)
    if (domain) return domain
  }

  return null
}
