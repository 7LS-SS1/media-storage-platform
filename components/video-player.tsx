"use client"

import { useEffect, useState } from "react"
import { Card } from "@/components/ui/card"

interface VideoPlayerProps {
  videoId: string
}

export function VideoPlayer({ videoId }: VideoPlayerProps) {
  const [videoUrl, setVideoUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchVideo() {
      try {
        const response = await fetch(`/api/videos/${videoId}`)
        if (response.ok) {
          const data = await response.json()
          setVideoUrl(data.video.videoUrl)
        }
      } catch (error) {
        console.error("Failed to fetch video:", error)
      } finally {
        setLoading(false)
      }
    }
    fetchVideo()
  }, [videoId])

  if (loading) {
    return (
      <Card className="aspect-video bg-muted animate-pulse flex items-center justify-center">
        <p className="text-muted-foreground">Loading video...</p>
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
      <video controls className="w-full aspect-video bg-black">
        <source src={videoUrl} type="video/mp4" />
        Your browser does not support the video tag.
      </video>
    </Card>
  )
}
