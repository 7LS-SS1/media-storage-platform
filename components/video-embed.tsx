"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { AlertCircle, Lock } from "lucide-react"
import { VideoControls } from "@/components/video-controls"
import { useVideoControls } from "@/hooks/use-video-controls"

interface VideoEmbedProps {
  videoId: string
}

interface VideoData {
  id: string
  title: string
  videoUrl: string
  visibility: string
  status: string
}

export function VideoEmbed({ videoId }: VideoEmbedProps) {
  const [video, setVideo] = useState<VideoData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const containerRef = useRef<HTMLDivElement | null>(null)
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const playerRef = useRef<any | null>(null)
  const videoUrl = video?.videoUrl ?? null
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
    async function fetchVideo() {
      try {
        const response = await fetch(`/api/embed/${videoId}`)

        if (!response.ok) {
          const data = await response.json()
          setError(data.error || "Failed to load video")
          return
        }

        const data = await response.json()
        setVideo(data.video)
      } catch (err) {
        setError("Failed to load video")
      } finally {
        setLoading(false)
      }
    }
    fetchVideo()
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

        if (mediaElement.autoplay) {
          mediaElement.play().catch(() => undefined)
        }
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
      <div className="w-full h-screen flex items-center justify-center bg-black">
        <div className="text-white text-center">
          <div className="animate-spin h-8 w-8 border-4 border-white border-t-transparent rounded-full mx-auto mb-4" />
          <p>Loading video...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="w-full h-screen flex items-center justify-center bg-black">
        <div className="text-white text-center space-y-4">
          {error.includes("domain") ? (
            <Lock className="h-12 w-12 mx-auto text-red-500" />
          ) : (
            <AlertCircle className="h-12 w-12 mx-auto text-red-500" />
          )}
          <p className="text-lg">{error}</p>
        </div>
      </div>
    )
  }

  if (!video || video.status !== "READY") {
    return (
      <div className="w-full h-screen flex items-center justify-center bg-black">
        <div className="text-white text-center">
          <AlertCircle className="h-12 w-12 mx-auto mb-4 text-yellow-500" />
          <p>Video is not available</p>
        </div>
      </div>
    )
  }

  return (
    <div className="w-full h-screen">
      <div ref={containerRef} className="relative h-full w-full bg-black">
        <video ref={videoRef} autoPlay className="h-full w-full bg-black object-contain" title={video.title}>
          {!isTsVideo && <source src={video.videoUrl} type={videoType} />}
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
    </div>
  )
}
