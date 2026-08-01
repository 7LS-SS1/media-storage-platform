"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { AlertCircle, Lock } from "lucide-react"
import { VideoControls } from "@/components/video-controls"
import { usePlaybackProtection } from "@/hooks/use-playback-protection"
import { useVideoControls } from "@/hooks/use-video-controls"
import { isBlockedVideoAccessError, toBlockedVideoAccessMessage } from "@/lib/video-access-block"
import { loadP2PHlsModule } from "@/lib/p2p-hls"

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
  const transferStatsRef = useRef({ cdnBytes: 0, p2pBytes: 0 })
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
    let domain = window.location.hostname
    try {
      domain = document.referrer ? new URL(document.referrer).hostname : domain
    } catch {
      // Keep the player hostname fallback.
    }
    const payload = JSON.stringify({
      source: "embed",
      domain,
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
            setRuntimeError("TS playback is not supported in this browser")
          }
          return
        }

        const player = mpegts.createPlayer({ type: "mpegts", url: sourceUrl })
        playerRef.current = player
        player.attachMediaElement(mediaElement)
        player.load()
      } catch (err) {
        if (!cancelled) {
          setRuntimeError("Failed to load TS player")
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
          src={!isTsVideo && !isHlsVideo ? video.videoUrl : undefined}
          poster={video.thumbnailUrl ?? undefined}
          preload="metadata"
          className="h-full w-full bg-black object-contain"
          title={video.title}
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
    </div>
  )
}
