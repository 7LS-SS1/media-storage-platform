import { prisma } from "@/lib/prisma"
import { getSignedPlaybackUrl, normalizeR2Url } from "@/lib/r2"
import { isDomainAllowedForVideo, isDomainGloballyAllowed } from "@/lib/domain-security"
import { parseStorageBucket } from "@/lib/storage-bucket"
import { VIDEO_ACCESS_BLOCK_MESSAGE } from "@/lib/video-access-block"

export interface EmbedVideoPayload {
  id: string
  title: string
  videoUrl: string
  thumbnailUrl: string | null
  visibility: string
  status: string
}

export interface EmbedVideoResult {
  status: number
  video?: EmbedVideoPayload
  error?: string
}

export async function resolveEmbedVideo(videoId: string, requestingDomain: string | null): Promise<EmbedVideoResult> {
  if (!requestingDomain) {
    return {
      status: 403,
      error: VIDEO_ACCESS_BLOCK_MESSAGE,
    }
  }

  const isRegisteredDomain = await isDomainGloballyAllowed(requestingDomain)
  if (!isRegisteredDomain) {
    return {
      status: 403,
      error: VIDEO_ACCESS_BLOCK_MESSAGE,
    }
  }

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
    const isAllowed = await isDomainAllowedForVideo(videoId, requestingDomain)
    if (!isAllowed) {
      return { status: 403, error: VIDEO_ACCESS_BLOCK_MESSAGE }
    }
  }

  // Relative HLS segments cannot reuse a signature attached only to the
  // playlist object, so HLS playback uses the configured R2 custom domain.
  const isHls = video.videoUrl.split("?")[0]?.toLowerCase().endsWith(".m3u8")
  const resolvedVideoUrl = isHls
    ? normalizeR2Url(video.videoUrl, bucket)
    : await getSignedPlaybackUrl(video.videoUrl, 3600, bucket)

  return {
    status: 200,
    video: {
      id: video.id,
      title: video.title,
      videoUrl: resolvedVideoUrl ?? normalizeR2Url(video.videoUrl, bucket) ?? video.videoUrl,
      thumbnailUrl: normalizeR2Url(video.thumbnailUrl, bucket),
      visibility: video.visibility,
      status: video.status,
    },
  }
}
