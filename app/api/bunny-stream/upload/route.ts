import { type NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { getUserFromRequest } from "@/lib/auth"
import { canManageVideos } from "@/lib/roles"
import { createBunnyTusCredentials, createBunnyVideo, getBunnyPlaybackUrls, isBunnyStreamEnabled } from "@/lib/bunny-stream"

const requestSchema = z.object({ title: z.string().trim().min(1).max(200) })

export async function POST(request: NextRequest) {
  if (!isBunnyStreamEnabled()) {
    return NextResponse.json({ error: "Bunny Stream is temporarily disabled" }, { status: 503 })
  }

  const user = await getUserFromRequest(request)
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!canManageVideos(user.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  try {
    const { title } = requestSchema.parse(await request.json())
    const { videoId, libraryId, apiKey, cdnHostname } = await createBunnyVideo(title)
    return NextResponse.json({
      endpoint: "https://video.bunnycdn.com/tusupload",
      videoId,
      libraryId,
      ...createBunnyTusCredentials(libraryId, apiKey, videoId),
      ...getBunnyPlaybackUrls(cdnHostname, videoId),
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to initialize Bunny Stream upload"
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
