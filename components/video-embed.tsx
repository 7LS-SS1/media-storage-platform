"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { AlertCircle, Lock } from "lucide-react"
import { VideoControls } from "@/components/video-controls"
import { usePlaybackProtection } from "@/hooks/use-playback-protection"
import { useVideoControls } from "@/hooks/use-video-controls"
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
  const containerRef = useRef<HTMLDivElement | null>(null)
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const playerRef = useRef<any | null>(null)
  const hasTrackedRef = useRef(false)
  const hasShownBlockedAlertRef = useRef(false)
  const [runtimeError, setRuntimeError] = useState<string | null>(null)
  const handleProtectedPlaybackBlocked = useCallback((message: string) => {
    if (playerRef.current) {
      playerRef.current.destroy()
      playerRef.current = null
    }
    setRuntimeError(message)
  }, [])
  const video = initialVideo
  const error = toBlockedVideoAccessMessage(initialError ?? runtimeError, null)
  const videoUrl = video?.videoUrl ?? null
  const isTsVideo = useMemo(() => {
    if (!videoUrl) return false
    const cleanUrl = videoUrl.split("?")[0].toLowerCase()
    return cleanUrl.endsWith(".ts")
  }, [videoUrl])
  const controls = useVideoControls({ videoRef, containerRef, sourceUrl: videoUrl })
  const protection = usePlaybackProtection({
    videoRef,
    onBlocked: handleProtectedPlaybackBlocked,
  })

  useEffect(() => {
    hasTrackedRef.current = false
  }, [videoId])

  useEffect(() => {
    if (!isBlockedVideoAccessError(error)) {
      hasShownBlockedAlertRef.current = false
      return
    }

    if (hasShownBlockedAlertRef.current) {
      return
    }

    hasShownBlockedAlertRef.current = true
    window.alert(toBlockedVideoAccessMessage(error))
  }, [error])

  const trackView = useCallback(async () => {
    if (hasTrackedRef.current) return
    hasTrackedRef.current = true
    try {
      await fetch(`/api/videos/${videoId}/view`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ source: "embed" }),
      })
    } catch (err) {
      console.error("Failed to track view:", err)
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
            setRuntimeError("TS playback is not supported in this browser")
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
          setRuntimeError("Failed to load TS player")
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

  if (error || protection.isBlocked) {
    return (
      <div className="w-full h-screen flex items-center justify-center bg-black">
        <div className="text-white text-center space-y-4">
          {isBlockedVideoAccessError(error) ? (
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
    <div className="w-full h-screen" onContextMenu={(event) => event.preventDefault()}>
      <div ref={containerRef} className="relative h-full w-full bg-black">
        <video
          ref={videoRef}
          src={!isTsVideo ? video.videoUrl : undefined}
          poster={video.thumbnailUrl ?? undefined}
          preload="metadata"
          className="h-full w-full bg-black object-contain"
          title={video.title}
          onPlay={trackView}
          onContextMenu={(event) => event.preventDefault()}
          onDragStart={(event) => event.preventDefault()}
          controlsList="nodownload noremoteplayback noplaybackrate"
          disablePictureInPicture
          disableRemotePlayback
        />
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
