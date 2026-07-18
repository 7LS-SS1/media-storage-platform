const isLocalOrigin = (value: string | undefined | null): boolean =>
  Boolean(value) && (value!.includes("localhost") || value!.includes("127.0.0.1") || value!.includes("[::1]"))

/**
 * Resolves the origin to use for copyable/embeddable URLs (embed codes, API
 * base URLs shared with WordPress, etc). Falls back to NEXT_PUBLIC_APP_URL
 * whenever the current window origin is a local dev address, so URLs copied
 * while running `next dev` don't leak `localhost` into production content.
 */
export function getPublicOrigin(): string {
  const origin = typeof window !== "undefined" ? window.location.origin : ""

  if (!isLocalOrigin(origin)) return origin

  const envBase = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "")
  return envBase && !isLocalOrigin(envBase) ? envBase : origin
}
