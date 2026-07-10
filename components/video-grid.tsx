"use client"

import { useEffect, useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import Link from "next/link"
import { Eye, Clock, Pencil, Trash2, X } from "lucide-react"
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
  status: string
}

export function VideoGrid() {
  const searchParams = useSearchParams()
  const [videos, setVideos] = useState<Video[]>([])
  const [loading, setLoading] = useState(true)
  const [pagination, setPagination] = useState({ page: 1, totalPages: 1 })
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [quickEditOpen, setQuickEditOpen] = useState(false)
  const [bulkWorking, setBulkWorking] = useState(false)
  const [bulkVisibility, setBulkVisibility] = useState<string>("")
  const [bulkStatus, setBulkStatus] = useState<string>("")
  const [bulkTags, setBulkTags] = useState("")

  async function fetchVideos() {
    setLoading(true)
    try {
      const params = new URLSearchParams(searchParams.toString())
      const storageBucket = params.get("storageBucket")
      const normalizedBucket = storageBucket === "media" || storageBucket === "jav" ? storageBucket : null
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
        setSelectedIds(new Set())
        setQuickEditOpen(false)
      }
    } catch (error) {
      console.error("Failed to fetch videos:", error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchVideos()
  }, [searchParams])

  const selectedCount = selectedIds.size
  const allVisibleSelected = videos.length > 0 && videos.every((video) => selectedIds.has(video.id))

  function toggleSelected(videoId: string) {
    setSelectedIds((current) => {
      const next = new Set(current)
      if (next.has(videoId)) {
        next.delete(videoId)
      } else {
        next.add(videoId)
      }
      return next
    })
  }

  function toggleAllVisible() {
    setSelectedIds((current) => {
      const next = new Set(current)
      if (allVisibleSelected) {
        videos.forEach((video) => next.delete(video.id))
      } else {
        videos.forEach((video) => next.add(video.id))
      }
      return next
    })
  }

  async function runBulkUpdate() {
    const updates: Record<string, unknown> = {}
    if (bulkVisibility) updates.visibility = bulkVisibility
    if (bulkStatus) updates.status = bulkStatus
    const tags = bulkTags
      .split(",")
      .map((tag) => tag.trim())
      .filter(Boolean)
    if (tags.length > 0) updates.tags = tags

    if (Object.keys(updates).length === 0 || selectedCount === 0) {
      return
    }

    setBulkWorking(true)
    try {
      const response = await fetch("/api/videos/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "update",
          ids: Array.from(selectedIds),
          updates,
        }),
      })
      const data = await response.json().catch(() => null)
      if (!response.ok) {
        throw new Error(data?.error || "Failed to update videos")
      }
      setBulkVisibility("")
      setBulkStatus("")
      setBulkTags("")
      await fetchVideos()
    } catch (error) {
      window.alert(error instanceof Error ? error.message : "Failed to update videos")
    } finally {
      setBulkWorking(false)
    }
  }

  async function runBulkDelete() {
    if (selectedCount === 0) return
    const confirmed = window.confirm(`Delete ${selectedCount} selected videos? This cannot be undone.`)
    if (!confirmed) return

    setBulkWorking(true)
    try {
      const response = await fetch("/api/videos/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "delete",
          ids: Array.from(selectedIds),
        }),
      })
      const data = await response.json().catch(() => null)
      if (!response.ok) {
        throw new Error(data?.error || "Failed to delete videos")
      }
      await fetchVideos()
    } catch (error) {
      window.alert(error instanceof Error ? error.message : "Failed to delete videos")
    } finally {
      setBulkWorking(false)
    }
  }

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
      <div className="flex flex-wrap items-center gap-3 rounded-md border bg-card px-3 py-2">
        <div className="flex items-center gap-2">
          <Checkbox
            checked={allVisibleSelected}
            onCheckedChange={toggleAllVisible}
            aria-label="Select all visible videos"
          />
          <span className="text-sm text-muted-foreground">
            {selectedCount > 0 ? `${selectedCount} selected` : "Select videos"}
          </span>
        </div>

        {selectedCount > 0 && (
          <>
            <Button
              type="button"
              size="sm"
              variant={quickEditOpen ? "secondary" : "outline"}
              onClick={() => setQuickEditOpen((open) => !open)}
              disabled={bulkWorking}
            >
              <Pencil className="mr-2 h-4 w-4" />
              Quick edit
            </Button>
            <Button type="button" size="sm" variant="destructive" onClick={runBulkDelete} disabled={bulkWorking}>
              <Trash2 className="mr-2 h-4 w-4" />
              Delete
            </Button>
            <Button
              type="button"
              size="icon"
              variant="ghost"
              onClick={() => {
                setSelectedIds(new Set())
                setQuickEditOpen(false)
              }}
              disabled={bulkWorking}
              aria-label="Clear selection"
            >
              <X className="h-4 w-4" />
            </Button>
          </>
        )}
      </div>

      {quickEditOpen && selectedCount > 0 && (
        <div className="grid gap-3 rounded-md border bg-card p-3 md:grid-cols-[repeat(3,minmax(0,1fr))_auto] md:items-end">
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Visibility</label>
            <Select value={bulkVisibility} onValueChange={setBulkVisibility}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="No change" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="PUBLIC">Public</SelectItem>
                <SelectItem value="PRIVATE">Private</SelectItem>
                <SelectItem value="DOMAIN_RESTRICTED">Domain restricted</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Status</label>
            <Select value={bulkStatus} onValueChange={setBulkStatus}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="No change" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="READY">Ready</SelectItem>
                <SelectItem value="PROCESSING">Processing</SelectItem>
                <SelectItem value="FAILED">Failed</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Tags</label>
            <Input
              value={bulkTags}
              onChange={(event) => setBulkTags(event.target.value)}
              placeholder="tag one, tag two"
              disabled={bulkWorking}
            />
          </div>
          <Button type="button" onClick={runBulkUpdate} disabled={bulkWorking}>
            Apply
          </Button>
        </div>
      )}

      <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-6">
        {videos.map((video) => (
          <Card key={video.id} className="overflow-hidden hover:shadow-lg transition-shadow py-0">
            <CardContent className="p-0">
              <div className="aspect-video bg-muted relative">
                <div className="absolute left-2 top-2 z-10 rounded bg-background/90 p-1 shadow-sm">
                  <Checkbox
                    checked={selectedIds.has(video.id)}
                    onCheckedChange={() => toggleSelected(video.id)}
                    aria-label={`Select ${video.title}`}
                  />
                </div>
                <Link href={`/videos/${video.id}`} className="block h-full">
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
                </Link>
                <Badge className="absolute top-2 right-2" variant="secondary">
                  {video.visibility}
                </Badge>
              </div>
              <div className="p-4 space-y-2">
                <Link href={`/videos/${video.id}`} className="block">
                  <h3 className="font-semibold line-clamp-2 hover:underline">{video.title}</h3>
                </Link>
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
