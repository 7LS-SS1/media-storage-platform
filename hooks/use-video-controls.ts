"use client"

import type { RefObject } from "react"
import { useCallback, useEffect, useRef, useState } from "react"

type UseVideoControlsOptions = {
  videoRef: RefObject<HTMLVideoElement>
  containerRef?: RefObject<HTMLElement>
  sourceUrl?: string | null
}

export function useVideoControls({ videoRef, containerRef, sourceUrl }: UseVideoControlsOptions) {
  const [isPlaying, setIsPlaying] = useState(false)
  const [isMuted, setIsMuted] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [playbackRate, setPlaybackRateState] = useState(1)
  const [isSeeking, setIsSeeking] = useState(false)
  const seekingRef = useRef(false)

  const getDuration = useCallback(() => {
    const video = videoRef.current
    if (!video) return 0
    if (Number.isFinite(video.duration) && video.duration > 0) {
      return video.duration
    }
    if (video.seekable && video.seekable.length > 0) {
      try {
        const end = video.seekable.end(video.seekable.length - 1)
        return Number.isFinite(end) ? end : 0
      } catch {
        return 0
      }
    }
    return 0
  }, [videoRef])

  const setSeeking = useCallback((value: boolean) => {
    seekingRef.current = value
    setIsSeeking(value)
  }, [])

  const syncPlaybackState = useCallback(() => {
    const video = videoRef.current
    if (!video) return
    setDuration(getDuration())
    setCurrentTime(Number.isFinite(video.currentTime) ? video.currentTime : 0)
    setIsMuted(video.muted)
    setPlaybackRateState(video.playbackRate || 1)
    setIsPlaying(!video.paused && !video.ended)
  }, [getDuration, videoRef])

  useEffect(() => {
    const video = videoRef.current
    if (!video) return

    syncPlaybackState()

    const handleTimeUpdate = () => {
      if (!seekingRef.current) {
        setCurrentTime(Number.isFinite(video.currentTime) ? video.currentTime : 0)
      }
      const nextDuration = getDuration()
      if (nextDuration) {
        setDuration(nextDuration)
      }
    }
    const handleLoaded = () => syncPlaybackState()
    const handlePlay = () => setIsPlaying(true)
    const handlePause = () => setIsPlaying(false)
    const handleVolumeChange = () => {
      setIsMuted(video.muted)
    }
    const handleRateChange = () => {
      setPlaybackRateState(video.playbackRate || 1)
    }

    video.addEventListener("loadedmetadata", handleLoaded)
    video.addEventListener("durationchange", handleLoaded)
    video.addEventListener("timeupdate", handleTimeUpdate)
    video.addEventListener("play", handlePlay)
    video.addEventListener("pause", handlePause)
    video.addEventListener("volumechange", handleVolumeChange)
    video.addEventListener("ratechange", handleRateChange)

    return () => {
      video.removeEventListener("loadedmetadata", handleLoaded)
      video.removeEventListener("durationchange", handleLoaded)
      video.removeEventListener("timeupdate", handleTimeUpdate)
      video.removeEventListener("play", handlePlay)
      video.removeEventListener("pause", handlePause)
      video.removeEventListener("volumechange", handleVolumeChange)
      video.removeEventListener("ratechange", handleRateChange)
    }
  }, [sourceUrl, syncPlaybackState, videoRef])

  useEffect(() => {
    setCurrentTime(0)
    setDuration(0)
    setIsPlaying(false)
  }, [sourceUrl])

  const togglePlay = useCallback(async () => {
    const video = videoRef.current
    if (!video) return
    if (video.paused || video.ended) {
      try {
        await video.play()
      } catch {
        // Ignore autoplay failures.
      }
    } else {
      video.pause()
    }
  }, [videoRef])

  const seekTo = useCallback(
    (time: number) => {
      const video = videoRef.current
      if (!video) return
      const max = Number.isFinite(video.duration) ? video.duration : duration
      const upperBound = max && max > 0 ? max : null
      const nextTime = upperBound ? Math.min(Math.max(0, time), upperBound) : Math.max(0, time)
      video.currentTime = nextTime
      setCurrentTime(nextTime)
    },
    [videoRef, duration],
  )

  const seekBy = useCallback(
    (delta: number) => {
      const video = videoRef.current
      if (!video) return
      seekTo(video.currentTime + delta)
    },
    [seekTo, videoRef],
  )

  const toggleMute = useCallback(() => {
    const video = videoRef.current
    if (!video) return
    video.muted = !video.muted
    setIsMuted(video.muted)
  }, [videoRef])

  const setPlaybackRate = useCallback(
    (rate: number) => {
      const video = videoRef.current
      if (!video) return
      video.playbackRate = rate
      setPlaybackRateState(rate)
    },
    [videoRef],
  )

  const togglePictureInPicture = useCallback(async () => {
    const video = videoRef.current
    if (!video) return
    if (typeof document === "undefined") return
    if (!document.pictureInPictureEnabled) return

    try {
      if (document.pictureInPictureElement) {
        await document.exitPictureInPicture()
      } else {
        await video.requestPictureInPicture()
      }
    } catch {
      // Ignore PiP failures.
    }
  }, [videoRef])

  const toggleFullscreen = useCallback(async () => {
    if (typeof document === "undefined") return
    const target = containerRef?.current ?? videoRef.current
    if (!target) return

    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen()
      } else if (target.requestFullscreen) {
        await target.requestFullscreen()
      }
    } catch {
      // Ignore fullscreen failures.
    }
  }, [containerRef, videoRef])

  return {
    isPlaying,
    isMuted,
    currentTime,
    duration,
    playbackRate,
    isSeeking,
    setSeeking,
    togglePlay,
    seekBy,
    seekTo,
    toggleMute,
    setPlaybackRate,
    togglePictureInPicture,
    toggleFullscreen,
  }
}
