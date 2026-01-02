import { VideoEmbed } from "@/components/video-embed"

interface PageProps {
  params: Promise<{ id: string }>
}

export const metadata = {
  title: "Video Embed",
  robots: "noindex",
}

export default async function EmbedPage({ params }: PageProps) {
  const { id } = await params

  return <VideoEmbed videoId={id} />
}
