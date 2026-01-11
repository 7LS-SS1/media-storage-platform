"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { Card } from "@/components/ui/card"
import { VideoControls } from "@/components/video-controls"
import { useVideoControls } from "@/hooks/use-video-controls"

interface VideoPlayerProps {
  videoId: string
}

type VideoPayload = {
  video?: {
    videoUrl?: string | null
    video_url?: string | null
    status?: string | null
  }
}

export function VideoPlayer({ videoId }: VideoPlayerProps) {
  const [videoUrl, setVideoUrl] = useState<string | null>(null)
  const [status, setStatus] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const containerRef = useRef<HTMLDivElement | null>(null)
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const playerRef = useRef<any | null>(null)
  const videoType = useMemo(() => {
    if (!videoUrl) return "video/mp4"
    const cleanUrl = videoUrl.split("?")[0].toLowerCase()
    if (cleanUrl.endsWith(".webm")) return "video/webm"
    if (cleanUrl.endsWith(".mov")) return "video/quicktime"
    if (cleanUrl.endsWith(".avi")) return "video/x-msvideo"
    if (cleanUrl.endsWith(".ts")) return "video/mp2t"
    return "video/mp4"
  }, [videoUrl])
  const isTsVideo = useMemo(() => {
    if (!videoUrl) return false
    const cleanUrl = videoUrl.split("?")[0].toLowerCase()
    return cleanUrl.endsWith(".ts")
  }, [videoUrl])
  const controls = useVideoControls({ videoRef, containerRef, sourceUrl: videoUrl })

  useEffect(() => {
    let isMounted = true
    const applyVideoPayload = (payload: VideoPayload) => {
      const url = payload.video?.videoUrl ?? payload.video?.video_url ?? null
      const nextStatus = payload.video?.status ?? null
      if (!isMounted) return
      setVideoUrl(url)
      setStatus(nextStatus)
    }

    async function fetchVideo() {
      setLoading(true)
      setError(null)
      setVideoUrl(null)
      setStatus(null)
      try {
        const response = await fetch(`/api/videos/${videoId}`, { credentials: "include" })
        if (response.ok) {
          const data = (await response.json()) as VideoPayload
          applyVideoPayload(data)
          return
        }

        if (response.status === 401 || response.status === 403) {
          const embedResponse = await fetch(`/api/embed/${videoId}`)
          if (embedResponse.ok) {
            const data = (await embedResponse.json()) as VideoPayload
            applyVideoPayload(data)
            return
          }
          const embedError = await embedResponse.json().catch(() => null)
          if (isMounted) {
            setError(embedError?.error || "Failed to load video")
          }
          return
        }
        const data = await response.json().catch(() => null)
        if (isMounted) {
          setError(data?.error || "Failed to load video")
        }
      } catch (error) {
        console.error("Failed to fetch video:", error)
        if (isMounted) {
          setError("Failed to load video")
        }
      } finally {
        if (isMounted) {
          setLoading(false)
        }
      }
    }
    fetchVideo()
    return () => {
      isMounted = false
    }
  }, [videoId])

  useEffect(() => {
    if (!videoUrl || !isTsVideo) {
      if (playerRef.current) {
        playerRef.current.destroy()
        playerRef.current = null
      }
      return
    }

    let cancelled = false

    async function setupTsPlayer() {
      try {
        const module = await import("mpegts.js")
        const mpegts = module.default ?? module
        if (!mpegts?.isSupported?.()) {
          if (!cancelled) {
            setError("TS playback is not supported in this browser")
          }
          return
        }

        const mediaElement = videoRef.current
        if (!mediaElement || cancelled) return

        const player = mpegts.createPlayer({ type: "mpegts", url: videoUrl })
        playerRef.current = player
        player.attachMediaElement(mediaElement)
        player.load()
      } catch (err) {
        if (!cancelled) {
          setError("Failed to load TS player")
        }
      }
    }

    setupTsPlayer()

    return () => {
      cancelled = true
      if (playerRef.current) {
        playerRef.current.destroy()
        playerRef.current = null
      }
    }
  }, [isTsVideo, videoUrl])

  if (loading) {
    return (
      <Card className="aspect-video bg-muted animate-pulse flex items-center justify-center">
        <p className="text-muted-foreground">Loading video...</p>
      </Card>
    )
  }

  if (error) {
    return (
      <Card className="aspect-video bg-muted flex items-center justify-center">
        <p className="text-muted-foreground">{error}</p>
      </Card>
    )
  }

  if (status && status !== "READY") {
    return (
      <Card className="aspect-video bg-muted flex items-center justify-center">
        <p className="text-muted-foreground">Video is not available</p>
      </Card>
    )
  }

  if (!videoUrl) {
    return (
      <Card className="aspect-video bg-muted flex items-center justify-center">
        <p className="text-muted-foreground">Video not available</p>
      </Card>
    )
  }

  return (
    <Card className="overflow-hidden">
      <div ref={containerRef} className="relative bg-black">
        <video ref={videoRef} className="w-full aspect-video bg-black" playsInline preload="metadata">
          {!isTsVideo && <source src={videoUrl} type={videoType} />}
          Your browser does not support the video tag.
        </video>
        <VideoControls
          isPlaying={controls.isPlaying}
          isMuted={controls.isMuted}
          currentTime={controls.currentTime}
          duration={controls.duration}
          playbackRate={controls.playbackRate}
          onTogglePlay={controls.togglePlay}
          onSeekBy={controls.seekBy}
          onSeek={controls.seekTo}
          onSeekStart={() => controls.setSeeking(true)}
          onSeekEnd={() => controls.setSeeking(false)}
          onToggleMute={controls.toggleMute}
          onTogglePictureInPicture={controls.togglePictureInPicture}
          onToggleFullscreen={controls.toggleFullscreen}
          onSetPlaybackRate={controls.setPlaybackRate}
        />
      </div>
    </Card>
  )
}
