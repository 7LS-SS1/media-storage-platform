"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Card } from "@/components/ui/card"
import { VideoControls } from "@/components/video-controls"
import { usePlaybackProtection } from "@/hooks/use-playback-protection"
import { useVideoControls } from "@/hooks/use-video-controls"
import { toBlockedVideoAccessMessage } from "@/lib/video-access-block"
import { loadP2PHlsModule } from "@/lib/p2p-hls"

interface VideoPlayerProps {
  videoId: string
}

type VideoPayload = {
  video?: {
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
  const [status, setStatus] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const containerRef = useRef<HTMLDivElement | null>(null)
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const playerRef = useRef<any | null>(null)
  const hasTrackedRef = useRef(false)
  const transferStatsRef = useRef({ cdnBytes: 0, p2pBytes: 0 })
  const handleProtectedPlaybackBlocked = useCallback((message: string) => {
    if (playerRef.current) {
      playerRef.current.destroy()
      playerRef.current = null
    }
    setVideoUrl(null)
    setError(message)
  }, [])
  const isTsVideo = useMemo(() => {
    if (!videoUrl) return false
    const cleanUrl = videoUrl.split("?")[0].toLowerCase()
    return cleanUrl.endsWith(".ts")
  }, [videoUrl])
  const isHlsVideo = useMemo(() => {
    if (!videoUrl) return false
    return videoUrl.split("?")[0].toLowerCase().endsWith(".m3u8")
  }, [videoUrl])
  const controls = useVideoControls({ videoRef, containerRef, sourceUrl: videoUrl })
  const protection = usePlaybackProtection({
    videoRef,
    onBlocked: handleProtectedPlaybackBlocked,
  })

  useEffect(() => {
    hasTrackedRef.current = false
    transferStatsRef.current = { cdnBytes: 0, p2pBytes: 0 }
  }, [videoId])

  const reportPlaybackStats = useCallback(() => {
    const stats = transferStatsRef.current
    if (stats.cdnBytes + stats.p2pBytes === 0) return
    const payload = JSON.stringify({
      source: "player",
      domain: window.location.hostname,
      cdnBytes: stats.cdnBytes,
      p2pBytes: stats.p2pBytes,
      watchedSec: Math.round(videoRef.current?.currentTime ?? 0),
    })
    navigator.sendBeacon(
      `/api/videos/${videoId}/view`,
      new Blob([payload], { type: "application/json" }),
    )
  }, [videoId])

  useEffect(() => {
    window.addEventListener("pagehide", reportPlaybackStats)
    return () => window.removeEventListener("pagehide", reportPlaybackStats)
  }, [reportPlaybackStats])

  useEffect(() => {
    let isMounted = true
    const applyVideoPayload = (payload: VideoPayload) => {
      const url = payload.video?.videoUrl ?? payload.video?.video_url ?? null
      const thumbnail = payload.video?.thumbnailUrl ?? payload.video?.thumbnail_url ?? null
      const nextStatus = payload.video?.status ?? null
      if (!isMounted) return
      setVideoUrl(url)
      setThumbnailUrl(thumbnail)
      setStatus(nextStatus)
    }

    async function fetchVideo() {
      setLoading(true)
      setError(null)
      setVideoUrl(null)
      setThumbnailUrl(null)
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
            setError(toBlockedVideoAccessMessage(embedError?.error, "Failed to load video"))
          }
          return
        }
        const data = await response.json().catch(() => null)
        if (isMounted) {
          setError(toBlockedVideoAccessMessage(data?.error, "Failed to load video"))
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

  const trackView = useCallback(async () => {
    if (hasTrackedRef.current) return
    hasTrackedRef.current = true
    try {
      await fetch(`/api/videos/${videoId}/view`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ source: "player" }),
      })
    } catch (error) {
      console.error("Failed to track view:", error)
    }
  }, [videoId])

  useEffect(() => {
    if (!videoUrl || (!isTsVideo && !isHlsVideo)) {
      if (playerRef.current) {
        playerRef.current.destroy()
        playerRef.current = null
      }
      return
    }

    let cancelled = false
    const sourceUrl = videoUrl

    async function setupStreamingPlayer() {
      try {
        const mediaElement = videoRef.current
        if (!mediaElement || cancelled) return

        if (isHlsVideo) {
          const [{ default: Hls }, { HlsJsP2PEngine }] = await Promise.all([
            import("hls.js"),
            loadP2PHlsModule(),
          ])
          if (cancelled) return

          if (Hls.isSupported()) {
            const HlsWithP2P = HlsJsP2PEngine.injectMixin(Hls)
            const player = new HlsWithP2P({
              p2p: {
                core: {
                  swarmId: videoId,
                  announceTrackers: [
                    "wss://tracker.openwebtorrent.com",
                    "wss://tracker.files.fm:7073/announce",
                  ],
                  rtcConfig: {
                    iceServers: [
                      { urls: "stun:stun.l.google.com:19302" },
                      { urls: "stun:global.stun.twilio.com:3478" },
                    ],
                  },
                },
              },
            })
            playerRef.current = player
            player.p2pEngine?.addEventListener("onSegmentLoaded", (details: { bytesLength?: number; peerId?: string }) => {
              const bytes = Number(details.bytesLength ?? 0)
              if (details.peerId) transferStatsRef.current.p2pBytes += bytes
              else transferStatsRef.current.cdnBytes += bytes
            })
            player.loadSource(sourceUrl)
            player.attachMedia(mediaElement)
            return
          }

          if (mediaElement.canPlayType("application/vnd.apple.mpegurl")) {
            mediaElement.src = sourceUrl
            return
          }
          throw new Error("HLS playback is not supported in this browser")
        }

        const module = await import("mpegts.js")
        const mpegts = module.default ?? module
        if (!mpegts?.isSupported?.()) {
          if (!cancelled) {
            setError("TS playback is not supported in this browser")
          }
          return
        }

        const player = mpegts.createPlayer({ type: "mpegts", url: sourceUrl })
        playerRef.current = player
        player.attachMediaElement(mediaElement)
        player.load()
      } catch (err) {
        if (!cancelled) {
          setError("Failed to load TS player")
        }
      }
    }

    setupStreamingPlayer()

    return () => {
      cancelled = true
      if (playerRef.current) {
        playerRef.current.destroy()
        playerRef.current = null
      }
    }
  }, [isHlsVideo, isTsVideo, videoId, videoUrl])

  if (loading) {
    return (
      <Card className="aspect-video bg-muted animate-pulse flex items-center justify-center">
        <p className="text-muted-foreground">Loading video...</p>
      </Card>
    )
  }

  if (error || protection.isBlocked) {
    return (
      <Card className="aspect-video bg-muted flex items-center justify-center">
        <p className="px-6 text-center text-muted-foreground">{error}</p>
      </Card>
    )
  }

  if (status === "FAILED") {
    return (
      <Card className="aspect-video bg-muted flex items-center justify-center">
        <p className="text-muted-foreground">Video processing failed</p>
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
      <div ref={containerRef} className="relative bg-black" onContextMenu={(event) => event.preventDefault()}>
        {status === "PROCESSING" && (
          <div className="absolute left-3 top-3 z-10 rounded-full bg-black/70 px-3 py-1 text-xs text-white">
            Processing
          </div>
        )}
        <video
          ref={videoRef}
          src={!isTsVideo && !isHlsVideo ? videoUrl : undefined}
          poster={thumbnailUrl ?? undefined}
          className="w-full aspect-video bg-black"
          playsInline
          preload="metadata"
          onPlay={trackView}
          onEnded={reportPlaybackStats}
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
    </Card>
  )
}
