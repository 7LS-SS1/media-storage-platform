"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { Eye, Calendar, User, Edit, Trash2 } from "lucide-react"
import { formatDistanceToNow } from "date-fns"
import Link from "next/link"
import { EmbedCodeDialog } from "@/components/embed-code-dialog"
import { toast } from "sonner"

interface Video {
  id: string
  title: string
  description: string | null
  actors: string[]
  tags: string[]
  views: number
  visibility: string
  status: string
  createdAt: string
  categories: { id: string; name: string }[]
  createdBy: { name: string | null; email: string }
}

interface VideoInfoProps {
  videoId: string
}

export function VideoInfo({ videoId }: VideoInfoProps) {
  const router = useRouter()
  const [video, setVideo] = useState<Video | null>(null)
  const [loading, setLoading] = useState(true)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    async function fetchVideo() {
      try {
        const response = await fetch(`/api/videos/${videoId}`)
        if (response.ok) {
          const data = await response.json()
          setVideo(data.video)
        }
      } catch (error) {
        console.error("Failed to fetch video:", error)
      } finally {
        setLoading(false)
      }
    }
    fetchVideo()
  }, [videoId])

  const handleDelete = async () => {
    if (deleting) return
    setDeleting(true)
    try {
      const response = await fetch(`/api/videos/${videoId}`, {
        method: "DELETE",
        credentials: "include",
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || "Failed to delete video")
      }

      toast.success("Video deleted")
      router.push("/videos")
      router.refresh()
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to delete video"
      toast.error(message)
    } finally {
      setDeleting(false)
    }
  }

  if (loading) {
    return <Card className="animate-pulse h-64 bg-muted" />
  }

  if (!video) {
    return <Card>Video not found</Card>
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>{video.title}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">{video.description || "No description"}</p>

          <div className="flex flex-wrap gap-2">
            <Badge>{video.visibility}</Badge>
            <Badge variant="outline">{video.status}</Badge>
            {video.categories?.map((category) => (
              <Badge key={category.id} variant="secondary">
                {category.name}
              </Badge>
            ))}
            {video.tags?.map((tag) => (
              <Badge key={tag} variant="secondary">
                {tag}
              </Badge>
            ))}
            {video.actors?.map((actor) => (
              <Badge key={actor} variant="outline">
                {actor}
              </Badge>
            ))}
          </div>

          <div className="space-y-2 text-sm">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Eye className="h-4 w-4" />
              <span>{video.views} views</span>
            </div>
            <div className="flex items-center gap-2 text-muted-foreground">
              <Calendar className="h-4 w-4" />
              <span>{formatDistanceToNow(new Date(video.createdAt), { addSuffix: true })}</span>
            </div>
            <div className="flex items-center gap-2 text-muted-foreground">
              <User className="h-4 w-4" />
              <span>{video.createdBy.name || video.createdBy.email}</span>
            </div>
          </div>

          <div className="pt-4">
            <EmbedCodeDialog videoId={videoId} videoTitle={video.title} />
          </div>

          <div className="flex gap-2">
            <Button variant="outline" size="sm" asChild className="flex-1 bg-transparent">
              <Link href={`/videos/${videoId}/edit`}>
                <Edit className="h-4 w-4 mr-2" />
                Edit
              </Link>
            </Button>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" size="sm" className="flex-1" disabled={deleting}>
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete this video?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This action cannot be undone. The video and its thumbnail will be removed permanently.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={handleDelete} disabled={deleting}>
                    {deleting ? "Deleting..." : "Delete"}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
