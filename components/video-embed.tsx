"use client"

import { useCallback, useState } from "react"
import { AlertCircle, Lock } from "lucide-react"
import { ArtVideoPlayer } from "@/components/art-video-player"
import { isBlockedVideoAccessError, toBlockedVideoAccessMessage } from "@/lib/video-access-block"

interface VideoEmbedProps {
  videoId: string
  initialVideo: VideoData | null
  initialError: string | null
}

interface VideoData {
  id: string
  title: string
  videoUrl: string
  thumbnailUrl: string | null
  visibility: string
  status: string
}

export function VideoEmbed({ videoId, initialVideo, initialError }: VideoEmbedProps) {
  const [runtimeError, setRuntimeError] = useState<string | null>(null)
  const handleError = useCallback((message: string) => setRuntimeError(message), [])
  const video = initialVideo
  const error = toBlockedVideoAccessMessage(initialError ?? runtimeError, null)

  if (error) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-black">
        <div className="space-y-4 text-center text-white">
          {isBlockedVideoAccessError(error) ? (
            <Lock className="mx-auto h-12 w-12 text-red-500" />
          ) : (
            <AlertCircle className="mx-auto h-12 w-12 text-red-500" />
          )}
          <p className="text-lg">{error}</p>
        </div>
      </div>
    )
  }

  if (!video || video.status !== "READY") {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-black">
        <div className="text-center text-white">
          <AlertCircle className="mx-auto mb-4 h-12 w-12 text-yellow-500" />
          <p>Video is not available</p>
        </div>
      </div>
    )
  }

  return (
    <div className="h-screen w-full bg-black">
      <ArtVideoPlayer
        videoId={videoId}
        url={video.videoUrl}
        poster={video.thumbnailUrl}
        title={video.title}
        fillViewport
        onError={handleError}
      />
    </div>
  )
}
