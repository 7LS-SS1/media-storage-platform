"use client"

import type { RefObject } from "react"
import { useCallback, useEffect, useRef, useState } from "react"

const BLOCKED_MESSAGE = "Video playback was stopped because browser developer tools were detected."
const DEVTOOLS_SIZE_THRESHOLD = 170

type UsePlaybackProtectionOptions = {
  videoRef: RefObject<HTMLVideoElement | null>
  onBlocked?: (message: string) => void
}

const isInspectShortcut = (event: KeyboardEvent) => {
  const key = event.key.toLowerCase()
  return (
    event.key === "F12" ||
    (event.ctrlKey && event.shiftKey && ["i", "j", "c", "k"].includes(key)) ||
    (event.metaKey && event.altKey && ["i", "j", "c"].includes(key)) ||
    (event.ctrlKey && ["u", "s"].includes(key)) ||
    (event.metaKey && ["u", "s"].includes(key))
  )
}

const isRunningInIframe = () => {
  if (typeof window === "undefined") return false
  try {
    return window.self !== window.top
  } catch {
    return true
  }
}

const isDevToolsLikelyOpen = () => {
  if (typeof window === "undefined") return false
  // outerWidth/outerHeight reflect the top browser window, not the iframe's
  // own viewport, so the size-gap heuristic produces false positives whenever
  // this runs inside an embed iframe smaller than the browser window.
  if (isRunningInIframe()) return false
  const widthGap = Math.abs(window.outerWidth - window.innerWidth)
  const heightGap = Math.abs(window.outerHeight - window.innerHeight)
  return widthGap > DEVTOOLS_SIZE_THRESHOLD || heightGap > DEVTOOLS_SIZE_THRESHOLD
}

export function usePlaybackProtection({ videoRef, onBlocked }: UsePlaybackProtectionOptions) {
  const [isBlocked, setIsBlocked] = useState(false)
  const blockedRef = useRef(false)

  const blockPlayback = useCallback(
    (message = BLOCKED_MESSAGE) => {
      const video = videoRef.current
      blockedRef.current = true
      setIsBlocked(true)

      if (video) {
        video.pause()
        video.removeAttribute("src")
        video.load()
      }

      onBlocked?.(message)
    },
    [onBlocked, videoRef],
  )

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!isInspectShortcut(event)) return
      event.preventDefault()
      event.stopPropagation()
      blockPlayback()
    }

    const handleContextMenu = (event: MouseEvent) => {
      event.preventDefault()
    }

    const checkDevTools = () => {
      if (blockedRef.current) return
      if (isDevToolsLikelyOpen()) {
        blockPlayback()
      }
    }

    window.addEventListener("keydown", handleKeyDown, true)
    window.addEventListener("contextmenu", handleContextMenu, true)
    const interval = window.setInterval(checkDevTools, 1000)
    checkDevTools()

    return () => {
      window.removeEventListener("keydown", handleKeyDown, true)
      window.removeEventListener("contextmenu", handleContextMenu, true)
      window.clearInterval(interval)
    }
  }, [blockPlayback])

  return { isBlocked, blockPlayback }
}
