import { type NextRequest, NextResponse } from "next/server"
import { getRequestingDomain } from "@/lib/domain-security"
import { resolveEmbedVideo } from "@/lib/embed-video"

export async function GET(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params
  try {
    const videoId = params.id

    // Get requesting domain
    const requestingDomain = getRequestingDomain(request)

    console.log("[v0] Embed request - Video ID:", videoId)
    console.log("[v0] Embed request - Requesting domain:", requestingDomain)

    const result = await resolveEmbedVideo(videoId, requestingDomain)
    if (result.video) {
      return NextResponse.json({ video: result.video })
    }

    return NextResponse.json({ error: result.error ?? "Failed to load video" }, { status: result.status })
  } catch (error) {
    console.error("Embed error:", error)
    return NextResponse.json({ error: "Failed to load video" }, { status: 500 })
  }
}
