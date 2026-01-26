import { prisma } from "@/lib/prisma"

export const markMp4VideosReady = async (options?: { ids?: string[] }) => {
  const where: Record<string, unknown> = {
    status: "PROCESSING",
    OR: [{ mimeType: "video/mp4" }, { videoUrl: { endsWith: ".mp4" } }],
  }

  if (options?.ids && options.ids.length > 0) {
    where.id = { in: options.ids }
  }

  return await prisma.video.updateMany({
    where,
    data: { status: "READY", transcodeProgress: 100 },
  })
}
