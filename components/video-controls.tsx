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
          <div className="absolute right-16 bottom-full mb-3 rounded-md bg-black/80 p-2 text-xs text-white shadow-lg">
            <div className="mb-1 text-[10px] uppercase tracking-widest text-white/60">Speed</div>
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
        <div className="flex items-center gap-3 bg-black/75 px-4 py-3 text-white">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => onSeekBy(-10)}
              className="rounded p-2 transition hover:bg-white/10"
              aria-label="Seek backward 10 seconds"
            >
              <SkipBack className="h-5 w-5" />
            </button>
            <button
              type="button"
              onClick={onTogglePlay}
              className="rounded p-2 transition hover:bg-white/10"
              aria-label={isPlaying ? "Pause" : "Play"}
            >
              {isPlaying ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5" />}
            </button>
            <button
              type="button"
              onClick={() => onSeekBy(10)}
              className="rounded p-2 transition hover:bg-white/10"
              aria-label="Seek forward 10 seconds"
            >
              <SkipForward className="h-5 w-5" />
            </button>
          </div>

          <div className="flex-1">
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
              className="video-range w-full"
            />
          </div>

          <div className="flex items-center gap-3 text-sm">
            <span className="tabular-nums">
              {formatTime(currentTime)} / {formatTime(duration)}
            </span>
            <button
              type="button"
              onClick={onToggleMute}
              className="rounded p-2 transition hover:bg-white/10"
              aria-label={isMuted ? "Unmute" : "Mute"}
            >
              {isMuted ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}
            </button>
            <button
              type="button"
              onClick={() => setShowSettings((prev) => !prev)}
              className="rounded p-2 transition hover:bg-white/10"
              aria-label="Playback settings"
            >
              <Settings className="h-5 w-5" />
            </button>
            <button
              type="button"
              onClick={onTogglePictureInPicture}
              className="rounded p-2 transition hover:bg-white/10"
              aria-label="Picture in picture"
            >
              <PictureInPicture2 className="h-5 w-5" />
            </button>
            <button
              type="button"
              onClick={onToggleFullscreen}
              className="rounded p-2 transition hover:bg-white/10"
              aria-label="Fullscreen"
            >
              <Maximize className="h-5 w-5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
