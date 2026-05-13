import { type NextRequest, NextResponse } from "next/server"
import { getUserFromRequest } from "@/lib/auth"
import { generateSeoSuggestion, seoGenerateInputSchema } from "@/lib/seo-generation"
import { analyzeVideoSeo, type SeoAnalysisInput } from "@/lib/video-seo"

export async function POST(request: NextRequest) {
  const user = await getUserFromRequest(request)
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const body = await request.json().catch(() => ({}))
  const parsed = seoGenerateInputSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input", issues: parsed.error.issues }, { status: 400 })
  }

  const input = parsed.data
  const generated = await generateSeoSuggestion(input)

  const seoInput: SeoAnalysisInput = {
    title: generated.title,
    targetKeyword: input.targetKeyword,
    description: generated.description,
    tags: generated.tags,
    thumbnailFile: input.hasThumbnail ?? false,
    movieCode: input.movieCode,
    studio: input.studio,
    storageBucket: input.storageBucket,
    actors: input.actors,
    categoryNames: input.categoryNames,
  }

  const expectedResult = analyzeVideoSeo(seoInput)

  return NextResponse.json({
    title: generated.title,
    metaTitle: generated.metaTitle,
    metaDescription: generated.metaDescription,
    description: generated.description,
    tags: generated.tags,
    keywordFocus: generated.keywordFocus,
    source: generated.source,
    model: generated.model,
    expectedScore: expectedResult.score,
  })
}
