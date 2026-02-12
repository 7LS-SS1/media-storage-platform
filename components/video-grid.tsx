"use client"

import { useEffect, useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { Eye, Clock } from "lucide-react"
import { useSearchParams } from "next/navigation"

interface Video {
  id: string
  title: string
  description: string | null
  thumbnailUrl: string | null
  views: number
  createdAt: string
  categories: { id: string; name: string }[]
  visibility: string
}

export function VideoGrid() {
  const searchParams = useSearchParams()
  const [videos, setVideos] = useState<Video[]>([])
  const [loading, setLoading] = useState(true)
  const [pagination, setPagination] = useState({ page: 1, totalPages: 1 })

  useEffect(() => {
    async function fetchVideos() {
      setLoading(true)
      try {
        const params = new URLSearchParams(searchParams.toString())
        const storageBucket = params.get("storageBucket")
        const normalizedBucket =
          storageBucket === "media" || storageBucket === "jav" ? storageBucket : null
        let endpoint = "/api/videos"
        if (normalizedBucket === "jav") {
          endpoint = "/api/av/videos"
          params.delete("storageBucket")
        } else if (normalizedBucket === "media") {
          endpoint = "/api/media/videos"
          params.delete("storageBucket")
        } else if (storageBucket) {
          params.delete("storageBucket")
        }
        const query = params.toString()
        const response = await fetch(query ? `${endpoint}?${query}` : endpoint)
        if (response.ok) {
          const data = await response.json()
          setVideos(data.videos)
          setPagination(data.pagination)
        }
      } catch (error) {
        console.error("Failed to fetch videos:", error)
      } finally {
        setLoading(false)
      }
    }
    fetchVideos()
  }, [searchParams])

  if (loading) {
    return (
      <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-6">
        {[...Array(6)].map((_, i) => (
          <Card key={i}>
            <CardContent className="p-0">
              <div className="aspect-video bg-muted animate-pulse" />
              <div className="p-4 space-y-2">
                <div className="h-4 bg-muted rounded animate-pulse" />
                <div className="h-3 bg-muted rounded w-2/3 animate-pulse" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    )
  }

  if (videos.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">No videos found</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-6">
        {videos.map((video) => (
          <Link key={video.id} href={`/videos/${video.id}`}>
            <Card className="overflow-hidden hover:shadow-lg transition-shadow py-0">
              <CardContent className="p-0">
                <div className="aspect-video bg-muted relative">
                  {video.thumbnailUrl ? (
                    <img
                      src={video.thumbnailUrl || "/public/none.png"}
                      alt={video.title}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Clock className="h-12 w-12 text-muted-foreground" />
                    </div>
                  )}
                  <Badge className="absolute top-2 right-2" variant="secondary">
                    {video.visibility}
                  </Badge>
                </div>
                <div className="p-4 space-y-2">
                  <h3 className="font-semibold line-clamp-2">{video.title}</h3>
                  <p className="text-sm text-muted-foreground line-clamp-2">{video.description || "No description"}</p>
                  <div className="flex items-center gap-4 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Eye className="h-3 w-3" />
                      {video.views} views
                    </span>
                    {video.categories?.length > 0 && (
                      <span>{video.categories.map((category) => category.name).join(", ")}</span>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      {pagination.totalPages > 1 && (
        <div className="flex justify-center gap-2">
          {[...Array(pagination.totalPages)].map((_, i) => (
            <Button key={i} variant={pagination.page === i + 1 ? "default" : "outline"} size="sm" asChild>
              <Link href={`?page=${i + 1}`}>{i + 1}</Link>
            </Button>
          ))}
        </div>
      )}
    </div>
  )
}
