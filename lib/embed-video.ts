import { prisma } from "@/lib/prisma"
import { getSignedPlaybackUrl, normalizeR2Url } from "@/lib/r2"
import { isDomainAllowedForVideo } from "@/lib/domain-security"
import { parseStorageBucket } from "@/lib/storage-bucket"

export interface EmbedVideoPayload {
  id: string
  title: string
  videoUrl: string
  visibility: string
  status: string
}

export interface EmbedVideoResult {
  status: number
  video?: EmbedVideoPayload
  error?: string
}

export async function resolveEmbedVideo(videoId: string, requestingDomain: string | null): Promise<EmbedVideoResult> {
  const video = await prisma.video.findUnique({
    where: { id: videoId },
  })

  if (!video) {
    return { status: 404, error: "Video not found" }
  }

  const bucket = parseStorageBucket(video.storageBucket)

  if (video.status !== "READY") {
    return { status: 400, error: "Video is not ready" }
  }

  if (video.visibility === "PRIVATE") {
    return { status: 403, error: "This video is private and cannot be embedded" }
  }

  if (video.visibility === "DOMAIN_RESTRICTED") {
    if (!requestingDomain) {
      return {
        status: 403,
        error: "Unable to verify domain. Please embed this video in a webpage that sends a referrer origin.",
      }
    }

    const isAllowed = await isDomainAllowedForVideo(videoId, requestingDomain)
    if (!isAllowed) {
      return { status: 403, error: "This video cannot be embedded on this domain" }
    }
  }

  const resolvedVideoUrl = await getSignedPlaybackUrl(video.videoUrl, 3600, bucket)

  return {
    status: 200,
    video: {
      id: video.id,
      title: video.title,
      videoUrl: resolvedVideoUrl ?? normalizeR2Url(video.videoUrl, bucket) ?? video.videoUrl,
      visibility: video.visibility,
      status: video.status,
    },
  }
}
