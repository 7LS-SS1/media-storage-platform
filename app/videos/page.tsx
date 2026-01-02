import { Suspense } from "react"
import { VideoGrid } from "@/components/video-grid"
import { VideoFilters } from "@/components/video-filters"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { Plus } from "lucide-react"

export const metadata = {
  title: "Videos - Media Storage",
  description: "Browse all videos",
}

export default function VideosPage() {
  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold mb-2">Videos</h1>
            <p className="text-muted-foreground">Browse and manage your video library</p>
          </div>
          <Button asChild>
            <Link href="/videos/upload">
              <Plus className="h-4 w-4 mr-2" />
              Upload Video
            </Link>
          </Button>
        </div>

        <Suspense fallback={<div>Loading filters...</div>}>
          <VideoFilters />
        </Suspense>

        <Suspense fallback={<div>Loading videos...</div>}>
          <VideoGrid />
        </Suspense>
      </div>
    </div>
  )
}
