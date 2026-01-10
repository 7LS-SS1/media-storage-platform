"use client"

import { useEffect, useMemo, useState } from "react"
import { AlertCircle, Lock } from "lucide-react"

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
  const videoType = useMemo(() => {
    if (!video?.videoUrl) return "video/mp4"
    const cleanUrl = video.videoUrl.split("?")[0].toLowerCase()
    if (cleanUrl.endsWith(".webm")) return "video/webm"
    if (cleanUrl.endsWith(".mov")) return "video/quicktime"
    if (cleanUrl.endsWith(".avi")) return "video/x-msvideo"
    if (cleanUrl.endsWith(".ts")) return "video/mp2t"
    return "video/mp4"
  }, [video?.videoUrl])

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
      <video controls autoPlay className="w-full h-full" title={video.title}>
        <source src={video.videoUrl} type={videoType} />
        Your browser does not support the video tag.
      </video>
    </div>
  )
}
