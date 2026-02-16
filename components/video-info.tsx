"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
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
import { Eye, Calendar, User, Edit, Trash2, Loader2 } from "lucide-react"
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
  videoUrl: string
  mimeType?: string | null
  transcodeProgress?: number | null
  createdAt: string
  categories: { id: string; name: string }[]
  createdBy: { name: string | null; email: string }
}

interface VideoInfoProps {
  videoId: string
}

const RETRANSCODE_COOLDOWN_SECONDS = 45

export function VideoInfo({ videoId }: VideoInfoProps) {
  const router = useRouter()
  const [video, setVideo] = useState<Video | null>(null)
  const [loading, setLoading] = useState(true)
  const [deleting, setDeleting] = useState(false)
  const [transcoding, setTranscoding] = useState(false)
  const [cooldownSeconds, setCooldownSeconds] = useState(0)
  const [transcodePhase, setTranscodePhase] = useState<"idle" | "processing" | "refreshing" | "done" | "error">(
    "idle",
  )
  const [transcodeError, setTranscodeError] = useState<string | null>(null)

  const normalizedUrl = video?.videoUrl?.split("?")[0]?.toLowerCase() ?? ""
  const mimeType = video?.mimeType?.toLowerCase() ?? ""
  const isMp4 = mimeType === "video/mp4" || normalizedUrl.endsWith(".mp4")
  const isTs = mimeType === "video/mp2t" || normalizedUrl.endsWith(".ts")
  const shouldPoll = Boolean(video) && (video?.status === "PROCESSING" || (isTs && video?.status !== "FAILED"))
  const canRetryTranscode = Boolean(video) && !isMp4 && (video?.status === "PROCESSING" || video?.status === "FAILED")
  const showProcessing = video?.status === "PROCESSING"
  const showMp4ReadyText = isMp4 && video?.status === "READY"
  const showFailed = video?.status === "FAILED"
  const showPending = !showProcessing && !showMp4ReadyText && !showFailed

  const fetchVideo = async (showLoading = false) => {
    try {
      if (showLoading) {
        setLoading(true)
      }
      const response = await fetch(`/api/videos/${videoId}`)
      if (response.ok) {
        const data = await response.json()
        setVideo(data.video)
      }
    } catch (error) {
      console.error("Failed to fetch video:", error)
    } finally {
      if (showLoading) {
        setLoading(false)
      }
    }
  }

  useEffect(() => {
    fetchVideo(true)
  }, [videoId])

  useEffect(() => {
    setTranscodePhase("idle")
    setTranscodeError(null)
    setCooldownSeconds(0)
    setTranscoding(false)
  }, [videoId])

  useEffect(() => {
    if (cooldownSeconds <= 0) return undefined
    const interval = setInterval(() => {
      setCooldownSeconds((prev) => (prev > 0 ? prev - 1 : 0))
    }, 1000)
    return () => clearInterval(interval)
  }, [cooldownSeconds])

  useEffect(() => {
    if (transcodePhase !== "done") return undefined
    const timeout = setTimeout(() => setTranscodePhase("idle"), 3000)
    return () => clearTimeout(timeout)
  }, [transcodePhase])

  useEffect(() => {
    if (!shouldPoll) {
      return undefined
    }
    const interval = setInterval(() => {
      fetchVideo()
    }, 5000)
    return () => clearInterval(interval)
  }, [shouldPoll, videoId])

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

  const handleTranscode = async () => {
    if (transcoding || !video) return
    setTranscodeError(null)
    setTranscoding(true)
    setTranscodePhase("processing")
    setCooldownSeconds(RETRANSCODE_COOLDOWN_SECONDS)
    try {
      const response = await fetch("/api/admin/videos/transcode", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: [video.id] }),
      })

      if (!response.ok) {
        const data = await response.json().catch(() => null)
        throw new Error(data?.error || "Failed to run transcode")
      }

      const data = await response.json().catch(() => null)
      if (data?.failed > 0) {
        const errorMessage = data?.results?.[0]?.error || "Transcode failed"
        throw new Error(errorMessage)
      }
      toast.success("ส่งเข้าคิวแปลงไฟล์แล้ว")

      setTranscodePhase("refreshing")
      await fetchVideo()
      setTranscodePhase("done")
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to run transcode"
      setTranscodePhase("error")
      setTranscodeError(message)
      toast.error(message)
    } finally {
      setTranscoding(false)
    }
  }

  if (loading) {
    return <Card className="animate-pulse h-64 bg-muted" />
  }

  if (!video) {
    return <Card>Video not found</Card>
  }

  let mp4Status = "MP4: Not converted"
  if (video.status === "FAILED") {
    mp4Status = "MP4: Failed"
  } else if (isMp4) {
    mp4Status = "MP4: Ready"
  } else if (isTs || video.status === "PROCESSING") {
    mp4Status = "MP4: Processing"
  }
  const progressValue = typeof video.transcodeProgress === "number" ? video.transcodeProgress : null
  const transcodeSteps = [
    { id: "request", label: "ส่งคำสั่งแปลงไฟล์" },
    { id: "processing", label: "ส่งเข้าคิวแปลงไฟล์ MP4" },
    { id: "refresh", label: "รีเฟรชข้อมูลวิดีโอ" },
  ]
  const getStepState = (step: "request" | "processing" | "refresh") => {
    if (transcodePhase === "idle") return "pending"
    if (transcodePhase === "error") {
      if (step === "request") return "done"
      if (step === "processing") return "error"
      return "pending"
    }
    if (transcodePhase === "processing") {
      if (step === "request") return "done"
      if (step === "processing") return "active"
      return "pending"
    }
    if (transcodePhase === "refreshing") {
      if (step === "refresh") return "active"
      return "done"
    }
    return "done"
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
            <Badge variant="outline">{mp4Status}</Badge>
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

          <div className="rounded-lg border bg-muted/40 p-4 space-y-3">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="text-sm font-medium text-foreground">MP4 conversion</p>
                <p className="text-xs text-muted-foreground">
                  ตรวจสอบสถานะการแปลงไฟล์และลองแปลงใหม่ได้ที่นี่
                </p>
              </div>
              {canRetryTranscode && (
                <Button
                  variant="secondary"
                  size="sm"
                  className="w-full sm:w-auto"
                  onClick={handleTranscode}
                  disabled={transcoding || cooldownSeconds > 0}
                >
                  {transcoding && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  {transcoding
                    ? "กำลังแปลง..."
                    : cooldownSeconds > 0
                      ? `รอ ${cooldownSeconds}s`
                      : "Retranscode"}
                </Button>
              )}
            </div>

            {showProcessing && (
              <div className="space-y-1">
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>MP4 conversion progress</span>
                  <span>{progressValue ?? 0}%</span>
                </div>
                <Progress value={progressValue ?? 0} />
              </div>
            )}

            {showMp4ReadyText && (
              <p className="text-sm text-muted-foreground">วิดีเป็น mp4 แล้ว</p>
            )}

            {showFailed && (
              <p className="text-sm text-destructive">
                การแปลงไฟล์ล้มเหลว ลองกด Retranscode อีกครั้ง
              </p>
            )}

            {showPending && (
              <p className="text-sm text-muted-foreground">รอการแปลงเป็น MP4</p>
            )}

            {transcodePhase !== "idle" && (
              <div className="rounded-md border bg-background/70 p-3 space-y-2 text-xs">
                {transcodeSteps.map((step) => {
                  const state = getStepState(step.id as "request" | "processing" | "refresh")
                  const stateStyles =
                    state === "done"
                      ? "bg-emerald-100 text-emerald-700"
                      : state === "active"
                        ? "bg-blue-100 text-blue-700"
                        : state === "error"
                          ? "bg-red-100 text-red-700"
                          : "bg-slate-100 text-slate-500"
                  const stateLabel =
                    state === "done"
                      ? "เสร็จแล้ว"
                      : state === "active"
                        ? "กำลังทำงาน"
                        : state === "error"
                          ? "ผิดพลาด"
                          : "รอคิว"
                  return (
                    <div key={step.id} className="flex items-center justify-between gap-3">
                      <span className="text-muted-foreground">{step.label}</span>
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${stateStyles}`}>
                        {stateLabel}
                      </span>
                    </div>
                  )
                })}
                {transcodePhase === "done" && (
                  <p className="text-xs text-emerald-600">อัปเดตข้อมูลใหม่เรียบร้อย</p>
                )}
                {transcodePhase === "error" && transcodeError && (
                  <p className="text-xs text-destructive">{transcodeError}</p>
                )}
              </div>
            )}
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

          <div className="flex gap-2 flex-wrap">
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
