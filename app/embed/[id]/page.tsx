import { headers } from "next/headers"
import { VideoEmbed } from "@/components/video-embed"
import { getRequestingDomainFromHeaders } from "@/lib/domain-security"
import { resolveEmbedVideo } from "@/lib/embed-video"

interface PageProps {
  params: Promise<{ id: string }>
}

export const metadata = {
  title: "Video Embed",
  robots: "noindex",
}

export default async function EmbedPage({ params }: PageProps) {
  const { id } = await params
  const headerStore = await headers()
  const requestingDomain = getRequestingDomainFromHeaders(headerStore)
  const embedResult = await resolveEmbedVideo(id, requestingDomain)

  return <VideoEmbed videoId={id} initialVideo={embedResult.video ?? null} initialError={embedResult.error ?? null} />
}
