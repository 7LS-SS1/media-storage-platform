import type { NextRequest } from "next/server"

const readForwardedProto = (request: NextRequest): string | null => {
  const header = request.headers.get("x-forwarded-proto")
  if (!header) return null
  const value = header.split(",")[0]?.trim().toLowerCase()
  return value || null
}

const readForwardedSsl = (request: NextRequest): string | null => {
  const header = request.headers.get("x-forwarded-ssl")
  if (!header) return null
  const value = header.trim().toLowerCase()
  return value || null
}

export const shouldUseSecureCookies = (request: NextRequest): boolean => {
  const forwardedProto = readForwardedProto(request)
  if (forwardedProto) {
    return forwardedProto === "https"
  }

  const forwardedSsl = readForwardedSsl(request)
  if (forwardedSsl) {
    return forwardedSsl === "on" || forwardedSsl === "1" || forwardedSsl === "true"
  }

  return request.nextUrl.protocol === "https:"
}
