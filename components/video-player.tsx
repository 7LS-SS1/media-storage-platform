"use client"

import { useCallback, useEffect, useState } from "react"
import { Card } from "@/components/ui/card"
import { ArtVideoPlayer } from "@/components/art-video-player"
import { toBlockedVideoAccessMessage } from "@/lib/video-access-block"

interface VideoPlayerProps {
  videoId: string
}

type VideoPayload = {
  video?: {
    title?: string | null
    videoUrl?: string | null
    video_url?: string | null
    thumbnailUrl?: string | null
    thumbnail_url?: string | null
    status?: string | null
  }
}

export function VideoPlayer({ videoId }: VideoPlayerProps) {
  const [videoUrl, setVideoUrl] = useState<string | null>(null)
  const [thumbnailUrl, setThumbnailUrl] = useState<string | null>(null)
  const [title, setTitle] = useState<string | null>(null)
  const [status, setStatus] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const handleError = useCallback((message: string) => setError(message), [])

  useEffect(() => {
    let mounted = true
    const applyPayload = (payload: VideoPayload) => {
      if (!mounted) return
      setVideoUrl(payload.video?.videoUrl ?? payload.video?.video_url ?? null)
      setThumbnailUrl(payload.video?.thumbnailUrl ?? payload.video?.thumbnail_url ?? null)
      setTitle(payload.video?.title ?? null)
      setStatus(payload.video?.status ?? null)
    }

    async function fetchVideo() {
      setLoading(true)
      setError(null)
      setVideoUrl(null)
      try {
        const response = await fetch(`/api/videos/${videoId}`, { credentials: "include" })
        if (response.ok) {
          applyPayload(await response.json())
          return
        }
        if (response.status === 401 || response.status === 403) {
          const embedResponse = await fetch(`/api/embed/${videoId}`)
          if (embedResponse.ok) {
            applyPayload(await embedResponse.json())
            return
          }
          const embedError = await embedResponse.json().catch(() => null)
          if (mounted) setError(toBlockedVideoAccessMessage(embedError?.error, "Failed to load video"))
          return
        }
        const data = await response.json().catch(() => null)
        if (mounted) setError(toBlockedVideoAccessMessage(data?.error, "Failed to load video"))
      } catch (fetchError) {
        console.error("Failed to fetch video:", fetchError)
        if (mounted) setError("Failed to load video")
      } finally {
        if (mounted) setLoading(false)
      }
    }

    void fetchVideo()
    return () => { mounted = false }
  }, [videoId])

  if (loading) {
    return <Card className="flex aspect-video items-center justify-center bg-muted"><p>Loading video...</p></Card>
  }
  if (error) {
    return <Card className="flex aspect-video items-center justify-center bg-muted"><p className="px-6 text-center">{error}</p></Card>
  }
  if (status === "FAILED") {
    return <Card className="flex aspect-video items-center justify-center bg-muted"><p>Video processing failed</p></Card>
  }
  if (!videoUrl) {
    return <Card className="flex aspect-video items-center justify-center bg-muted"><p>Video not available</p></Card>
  }

  return (
    <Card className="relative overflow-hidden">
      {status === "PROCESSING" && (
        <div className="absolute left-3 top-3 z-10 rounded-full bg-black/70 px-3 py-1 text-xs text-white">Processing</div>
      )}
      <ArtVideoPlayer
        videoId={videoId}
        url={videoUrl}
        poster={thumbnailUrl}
        title={title ?? undefined}
        onError={handleError}
      />
    </Card>
  )
}
