import { type NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { getUserFromRequest } from "@/lib/auth"
import { analyzeVideoSeo, type SeoAnalysisInput } from "@/lib/video-seo"

const analyzeSchema = z.object({
  title: z.string().default(""),
  targetKeyword: z.string().trim().min(1, "targetKeyword is required"),
  description: z.string().optional(),
  tags: z.array(z.string()).default([]),
  hasThumbnail: z.boolean().optional(),
  movieCode: z.string().optional(),
  studio: z.string().optional(),
  storageBucket: z.enum(["media", "jav"]).default("media"),
  actors: z.array(z.string()).optional(),
  categoryNames: z.array(z.string()).optional(),
})

export async function POST(request: NextRequest) {
  const user = await getUserFromRequest(request)
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const body = await request.json().catch(() => ({}))
  const parsed = analyzeSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input", issues: parsed.error.issues }, { status: 400 })
  }

  const input: SeoAnalysisInput = {
    title: parsed.data.title,
    targetKeyword: parsed.data.targetKeyword,
    description: parsed.data.description,
    tags: parsed.data.tags,
    thumbnailFile: parsed.data.hasThumbnail ?? false,
    movieCode: parsed.data.movieCode,
    studio: parsed.data.studio,
    storageBucket: parsed.data.storageBucket,
    actors: parsed.data.actors,
    categoryNames: parsed.data.categoryNames,
  }

  const result = analyzeVideoSeo(input)
  const encoder = new TextEncoder()

  // Stream each check result as NDJSON for realtime progress
  const stream = new ReadableStream({
    async start(controller) {
      for (let i = 0; i < result.checks.length; i++) {
        const check = result.checks[i]
        const progress = Math.round(((i + 1) / result.checks.length) * 90)
        const line = JSON.stringify({ type: "check", check, progress }) + "\n"
        controller.enqueue(encoder.encode(line))
        // Brief pause for visual streaming effect
        await new Promise<void>((resolve) => setTimeout(resolve, 180))
      }

      const finalLine =
        JSON.stringify({
          type: "result",
          score: result.score,
          passed: result.passed,
          recommendations: result.recommendations,
          progress: 100,
        }) + "\n"
      controller.enqueue(encoder.encode(finalLine))
      controller.close()
    },
  })

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson",
      "Cache-Control": "no-cache, no-store",
      "X-Accel-Buffering": "no",
    },
  })
}
