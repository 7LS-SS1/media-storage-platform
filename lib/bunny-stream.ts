import { createHash } from "node:crypto"

const API_BASE = "https://video.bunnycdn.com"

export function isBunnyStreamEnabled() {
  return process.env.BUNNY_STREAM_ENABLED?.trim().toLowerCase() === "true"
}

function requiredEnv(name: string): string {
  const value = process.env[name]?.trim()
  if (!value) throw new Error(`Missing Bunny Stream configuration: ${name}`)
  return value
}

export function getBunnyStreamConfig() {
  return {
    apiKey: requiredEnv("BUNNY_STREAM_API_KEY"),
    libraryId: requiredEnv("BUNNY_STREAM_LIBRARY_ID"),
    cdnHostname: requiredEnv("BUNNY_STREAM_CDN_HOSTNAME").replace(/^https?:\/\//, "").replace(/\/+$/, ""),
  }
}

export async function createBunnyVideo(title: string) {
  const config = getBunnyStreamConfig()
  const response = await fetch(`${API_BASE}/library/${config.libraryId}/videos`, {
    method: "POST",
    headers: { Accept: "application/json", "Content-Type": "application/json", AccessKey: config.apiKey },
    body: JSON.stringify({ title }),
  })
  if (!response.ok) {
    throw new Error(`Bunny Stream create video failed (${response.status}): ${await response.text()}`)
  }
  const video = (await response.json()) as { guid?: string }
  if (!video.guid) throw new Error("Bunny Stream did not return a video GUID")
  return { videoId: video.guid, ...config }
}

export function createBunnyTusCredentials(libraryId: string, apiKey: string, videoId: string) {
  const expirationTime = Math.floor(Date.now() / 1000) + 24 * 60 * 60
  const signature = createHash("sha256")
    .update(`${libraryId}${apiKey}${expirationTime}${videoId}`)
    .digest("hex")
  return { expirationTime, signature }
}

export function getBunnyPlaybackUrls(cdnHostname: string, videoId: string) {
  const base = `https://${cdnHostname}/${videoId}`
  return { playlistUrl: `${base}/playlist.m3u8`, thumbnailUrl: `${base}/thumbnail.jpg` }
}

export async function deleteBunnyVideo(videoId: string) {
  const { libraryId, apiKey } = getBunnyStreamConfig()
  const response = await fetch(`${API_BASE}/library/${libraryId}/videos/${videoId}`, {
    method: "DELETE",
    headers: { Accept: "application/json", AccessKey: apiKey },
  })
  if (!response.ok && response.status !== 404) {
    throw new Error(`Bunny Stream delete failed (${response.status}): ${await response.text()}`)
  }
}

export function isBunnyStreamUrl(url: string | null | undefined): boolean {
  if (!url) return false
  const hostname = process.env.BUNNY_STREAM_CDN_HOSTNAME?.replace(/^https?:\/\//, "").replace(/\/+$/, "")
  return Boolean(hostname && url.includes(hostname))
}
