export const VIDEO_ACCESS_BLOCK_MESSAGE = "Block การใช้งาน กรุณาติดต่อที่ LINE:UFABET7M"

const BLOCKED_VIDEO_ERROR_PATTERNS = [
  "request domain is not registered",
  "this video cannot be published on this domain",
  "unable to verify domain",
  "this video cannot be embedded on this domain",
] as const

export function isBlockedVideoAccessError(error: string | null | undefined): boolean {
  if (!error) return false

  const normalized = error.trim().toLowerCase()
  if (!normalized) return false

  if (normalized === VIDEO_ACCESS_BLOCK_MESSAGE.toLowerCase()) {
    return true
  }

  return BLOCKED_VIDEO_ERROR_PATTERNS.some((pattern) => normalized.includes(pattern))
}

export function toBlockedVideoAccessMessage(
  error: string | null | undefined,
  fallback: string | null = "Failed to load video",
): string | null {
  if (isBlockedVideoAccessError(error)) {
    return VIDEO_ACCESS_BLOCK_MESSAGE
  }

  if (typeof error === "string" && error.trim()) {
    return error
  }

  return fallback
}
