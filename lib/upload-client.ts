import type { StorageBucket } from "@/lib/storage-bucket"

export const normalizeUploadErrorText = (value: string) => value.replace(/\s+/g, " ").trim()

export const truncateUploadMessage = (value: string, max = 180) =>
  value.length > max ? `${value.slice(0, max - 1)}…` : value

export const extractUploadStatusCode = (message: string) => {
  const match = message.match(/status\s*(\d+)/i)
  if (!match) return null
  const code = Number(match[1])
  return Number.isFinite(code) ? code : null
}

export const buildUploadXhrErrorMessage = (xhr: XMLHttpRequest, fallback: string) => {
  if (xhr.status === 0) return `${fallback}: การเชื่อมต่อถูกบล็อก (CORS) หรือเน็ตหลุด`
  const responseText = normalizeUploadErrorText(xhr.responseText || "")
  if (responseText) {
    let detail = responseText
    try {
      const parsed = JSON.parse(responseText) as { error?: unknown }
      if (typeof parsed.error === "string" && parsed.error.trim()) {
        detail = normalizeUploadErrorText(parsed.error)
      }
    } catch {
      // Keep the raw response text when the payload is not JSON.
    }
    return `${fallback} (status ${xhr.status}): ${truncateUploadMessage(detail)}`
  }
  return `${fallback} (status ${xhr.status})`
}

export const shouldUseUploadProxyFallback = (error: unknown) => {
  const message = normalizeUploadErrorText(error instanceof Error ? error.message : String(error ?? ""))
  if (!message) return false
  const lowerMessage = message.toLowerCase()
  if (
    lowerMessage.includes("cors") ||
    lowerMessage.includes("network") ||
    lowerMessage.includes("blocked") ||
    message.includes("ถูกบล็อก") ||
    message.includes("เน็ตหลุด")
  ) {
    return true
  }
  if (lowerMessage.includes("etag")) return true
  const statusCode = extractUploadStatusCode(message)
  return statusCode === 0 || statusCode === 403
}

export const buildUploadProxyUrl = (
  path: string,
  params: Record<string, string | number | StorageBucket>,
) => {
  const searchParams = new URLSearchParams()
  Object.entries(params).forEach(([key, value]) => {
    searchParams.set(key, String(value))
  })
  return `${path}?${searchParams.toString()}`
}
