"use client"

import { useState } from "react"
import {
  Maximize,
  Pause,
  PictureInPicture2,
  Play,
  Settings,
  SkipBack,
  SkipForward,
  Volume2,
  VolumeX,
} from "lucide-react"

type VideoControlsProps = {
  isPlaying: boolean
  isMuted: boolean
  currentTime: number
  duration: number
  playbackRate: number
  onTogglePlay: () => void
  onSeekBy: (delta: number) => void
  onSeek: (time: number) => void
  onSeekStart: () => void
  onSeekEnd: () => void
  onToggleMute: () => void
  onTogglePictureInPicture: () => void
  onToggleFullscreen: () => void
  onSetPlaybackRate: (rate: number) => void
}

const SPEEDS = [0.5, 1, 1.25, 1.5, 2]

const formatTime = (value: number) => {
  if (!Number.isFinite(value) || value < 0) return "00:00"
  const total = Math.floor(value)
  const hours = Math.floor(total / 3600)
  const minutes = Math.floor((total % 3600) / 60)
  const seconds = total % 60
  const paddedMinutes = String(minutes).padStart(2, "0")
  const paddedSeconds = String(seconds).padStart(2, "0")
  if (hours > 0) {
    return `${hours}:${paddedMinutes}:${paddedSeconds}`
  }
  return `${paddedMinutes}:${paddedSeconds}`
}

const iconButtonClass =
  "inline-flex h-11 w-11 items-center justify-center rounded-full transition hover:bg-white/10 sm:h-10 sm:w-10 sm:rounded-md"

const desktopOnlyButtonClass = `${iconButtonClass} hidden sm:inline-flex`

export function VideoControls({
  isPlaying,
  isMuted,
  currentTime,
  duration,
  playbackRate,
  onTogglePlay,
  onSeekBy,
  onSeek,
  onSeekStart,
  onSeekEnd,
  onToggleMute,
  onTogglePictureInPicture,
  onToggleFullscreen,
  onSetPlaybackRate,
}: VideoControlsProps) {
  const [showSettings, setShowSettings] = useState(false)
  const progress = duration > 0 ? Math.round((currentTime / duration) * 1000) : 0
  const hasDuration = duration > 0

  return (
    <div className="absolute inset-x-0 bottom-0">
      <div className="relative">
        {showSettings && (
          <div className="absolute inset-x-3 bottom-full mb-2 rounded-xl border border-white/10 bg-black/90 p-3 text-xs text-white shadow-lg sm:inset-x-auto sm:right-16 sm:mb-3 sm:w-44 sm:rounded-md sm:p-2">
            <div className="mb-2 flex items-center justify-between text-[10px] uppercase tracking-widest text-white/60">
              <span>Speed</span>
              <span>{playbackRate}x</span>
            </div>
            <div className="grid grid-cols-3 gap-1">
              {SPEEDS.map((speed) => (
                <button
                  key={speed}
                  type="button"
                  onClick={() => {
                    onSetPlaybackRate(speed)
                    setShowSettings(false)
                  }}
                  className={`rounded px-2 py-1 transition ${
                    playbackRate === speed ? "bg-white text-black" : "bg-white/10 text-white hover:bg-white/20"
                  }`}
                >
                  {speed}x
                </button>
              ))}
            </div>
          </div>
        )}
        <div className="bg-gradient-to-t from-black/90 via-black/75 to-transparent px-3 pb-3 pt-2 text-white sm:bg-black/75 sm:px-4 sm:py-3">
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-[11px] sm:text-sm">
              <span className="shrink-0 tabular-nums text-white/85">{formatTime(currentTime)}</span>
              <input
                type="range"
                min={0}
                max={1000}
                value={hasDuration ? progress : 0}
                onPointerDown={onSeekStart}
                onPointerUp={onSeekEnd}
                onPointerCancel={onSeekEnd}
                onPointerLeave={() => {
                  if (hasDuration) {
                    onSeekEnd()
                  }
                }}
                onChange={(event) => {
                  const ratio = Number(event.target.value) / 1000
                  if (hasDuration) {
                    onSeek(ratio * duration)
                  }
                }}
                disabled={!hasDuration}
                aria-label="Seek"
                className="video-range min-w-0 flex-1"
              />
              <span className="shrink-0 tabular-nums text-white/65">{formatTime(duration)}</span>
            </div>

            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-1 sm:gap-2">
                <button
                  type="button"
                  onClick={() => onSeekBy(-10)}
                  className={desktopOnlyButtonClass}
                  aria-label="Seek backward 10 seconds"
                >
                  <SkipBack className="h-5 w-5" />
                </button>
                <button
                  type="button"
                  onClick={onTogglePlay}
                  className={`${iconButtonClass} bg-white/12 hover:bg-white/20`}
                  aria-label={isPlaying ? "Pause" : "Play"}
                >
                  {isPlaying ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5" />}
                </button>
                <button
                  type="button"
                  onClick={() => onSeekBy(10)}
                  className={desktopOnlyButtonClass}
                  aria-label="Seek forward 10 seconds"
                >
                  <SkipForward className="h-5 w-5" />
                </button>
              </div>

              <div className="flex items-center gap-1 sm:gap-2">
                <button
                  type="button"
                  onClick={onToggleMute}
                  className={iconButtonClass}
                  aria-label={isMuted ? "Unmute" : "Mute"}
                >
                  {isMuted ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}
                </button>
                <button
                  type="button"
                  onClick={() => setShowSettings((prev) => !prev)}
                  className={iconButtonClass}
                  aria-label="Playback settings"
                >
                  <Settings className="h-5 w-5" />
                </button>
                <button
                  type="button"
                  onClick={onTogglePictureInPicture}
                  className={desktopOnlyButtonClass}
                  aria-label="Picture in picture"
                >
                  <PictureInPicture2 className="h-5 w-5" />
                </button>
                <button
                  type="button"
                  onClick={onToggleFullscreen}
                  className={iconButtonClass}
                  aria-label="Fullscreen"
                >
                  <Maximize className="h-5 w-5" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
