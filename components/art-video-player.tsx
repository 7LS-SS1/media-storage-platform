"use client"

import { useCallback, useEffect, useRef } from "react"
import type Artplayer from "artplayer"
import { loadP2PHlsModule } from "@/lib/p2p-hls"
import { usePlaybackProtection } from "@/hooks/use-playback-protection"

type ArtVideoPlayerProps = {
  videoId?: string
  url: string
  poster?: string | null
  title?: string
  fillViewport?: boolean
  onError: (message: string) => void
}

type TransferStats = { cdnBytes: number; p2pBytes: number }

export function ArtVideoPlayer({ videoId, url, poster, title, fillViewport = false, onError }: ArtVideoPlayerProps) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const artRef = useRef<Artplayer | null>(null)
  const streamRef = useRef<{ destroy: () => void } | null>(null)
  const trackedRef = useRef(false)
  const statsRef = useRef<TransferStats>({ cdnBytes: 0, p2pBytes: 0 })

  const destroyPlayer = useCallback(() => {
    streamRef.current?.destroy()
    streamRef.current = null
    artRef.current?.destroy(false)
    artRef.current = null
    videoRef.current = null
  }, [])

  const protection = usePlaybackProtection({
    videoRef,
    onBlocked: (message) => {
      destroyPlayer()
      onError(message)
    },
  })

  const trackView = useCallback(async () => {
    if (!videoId || trackedRef.current) return
    trackedRef.current = true
    try {
      await fetch(`/api/videos/${videoId}/view`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ source: "artplayer" }),
      })
    } catch (error) {
      console.error("Failed to track view:", error)
    }
  }, [videoId])

  const reportPlaybackStats = useCallback(() => {
    if (!videoId) return
    const stats = statsRef.current
    if (stats.cdnBytes + stats.p2pBytes === 0) return
    let domain = window.location.hostname
    try {
      domain = document.referrer ? new URL(document.referrer).hostname : domain
    } catch {
      // Keep the current hostname.
    }
    navigator.sendBeacon(
      `/api/videos/${videoId}/view`,
      new Blob([
        JSON.stringify({
          source: "artplayer",
          domain,
          cdnBytes: stats.cdnBytes,
          p2pBytes: stats.p2pBytes,
          watchedSec: Math.round(artRef.current?.currentTime ?? 0),
        }),
      ], { type: "application/json" }),
    )
  }, [videoId])

  useEffect(() => {
    trackedRef.current = false
    statsRef.current = { cdnBytes: 0, p2pBytes: 0 }
  }, [videoId])

  useEffect(() => {
    window.addEventListener("pagehide", reportPlaybackStats)
    return () => window.removeEventListener("pagehide", reportPlaybackStats)
  }, [reportPlaybackStats])

  useEffect(() => {
    const container = containerRef.current
    if (!container || protection.isBlocked) return
    let cancelled = false

    const cleanUrl = url.split("?")[0].toLowerCase()
    const isHls = cleanUrl.endsWith(".m3u8")
    const isTs = cleanUrl.endsWith(".ts")

    void import("artplayer").then(({ default: Artplayer }) => {
      if (cancelled) return
      const customType: Record<string, (video: HTMLVideoElement, source: string) => void> = {}

      if (isHls) {
        customType.m3u8 = (video, source) => {
          void Promise.all([import("hls.js"), loadP2PHlsModule()])
            .then(([{ default: Hls }, { HlsJsP2PEngine }]) => {
              if (cancelled) return
              if (Hls.isSupported()) {
                const HlsWithP2P = HlsJsP2PEngine.injectMixin(Hls)
                const hls = new HlsWithP2P({
                  p2p: {
                    core: {
                      swarmId: videoId ?? url,
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
                streamRef.current = hls
                hls.p2pEngine?.addEventListener(
                  "onSegmentLoaded",
                  (details: { bytesLength?: number; peerId?: string }) => {
                    const bytes = Number(details.bytesLength ?? 0)
                    if (details.peerId) statsRef.current.p2pBytes += bytes
                    else statsRef.current.cdnBytes += bytes
                  },
                )
                hls.loadSource(source)
                hls.attachMedia(video)
              } else if (video.canPlayType("application/vnd.apple.mpegurl")) {
                video.src = source
              } else {
                onError("HLS playback is not supported in this browser")
              }
            })
            .catch(() => onError("Failed to initialize HLS/P2P playback"))
        }
      }

      if (isTs) {
        customType.ts = (video, source) => {
          void import("mpegts.js").then((module) => {
            if (cancelled) return
            const mpegts = module.default ?? module
            if (!mpegts.isSupported()) {
              onError("TS playback is not supported in this browser")
              return
            }
            const player = mpegts.createPlayer({ type: "mpegts", url: source })
            streamRef.current = player
            player.attachMediaElement(video)
            player.load()
          }).catch(() => onError("Failed to initialize TS playback"))
        }
      }

      const art = new Artplayer({
        container,
        url,
        poster: poster ?? undefined,
        type: isHls ? "m3u8" : isTs ? "ts" : undefined,
        customType,
        theme: "#6366f1",
        volume: 0.8,
        autoplay: false,
        autoSize: false,
        autoMini: false,
        loop: false,
        flip: true,
        playbackRate: true,
        aspectRatio: true,
        screenshot: false,
        setting: true,
        hotkey: true,
        pip: true,
        mutex: true,
        fullscreen: true,
        fullscreenWeb: true,
        miniProgressBar: true,
        playsInline: true,
        controls: [
          { position: "left", html: "−10", tooltip: "ย้อนกลับ 10 วินาที", click: () => { art.currentTime = Math.max(0, art.currentTime - 10) } },
          { position: "left", html: "+10", tooltip: "ไปข้างหน้า 10 วินาที", click: () => { art.currentTime = Math.min(art.duration || 0, art.currentTime + 10) } },
        ],
      })
      artRef.current = art
      videoRef.current = art.video
      art.on("video:play", trackView)
      art.on("video:ended", reportPlaybackStats)
      art.on("video:error", () => onError("Video playback failed"))
    }).catch(() => onError("Failed to load ArtPlayer"))

    return () => {
      cancelled = true
      destroyPlayer()
    }
  }, [destroyPlayer, onError, poster, protection.isBlocked, reportPlaybackStats, title, trackView, url, videoId])

  return (
    <div
      ref={containerRef}
      aria-label={title}
      className={fillViewport ? "h-full w-full bg-black" : "aspect-video w-full bg-black"}
      onContextMenu={(event) => event.preventDefault()}
    />
  )
}
