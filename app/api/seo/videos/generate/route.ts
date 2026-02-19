import { type NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { getUserFromRequest } from "@/lib/auth"
import { analyzeVideoSeo, type SeoAnalysisInput } from "@/lib/video-seo"
import { STANDARD_TAGS } from "@/lib/standard-tags"
import { AV_GENRES } from "@/lib/av-genres"

const generateSchema = z.object({
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

type GenerateInput = z.infer<typeof generateSchema>

function buildImprovedTitle(input: GenerateInput): string {
  let title = input.title.trim()
  const keyword = input.targetKeyword.trim()

  if (title.length < 10) {
    const parts: string[] = [title]
    if (keyword) parts.unshift(keyword)
    if (input.movieCode) parts.push(input.movieCode)
    if (input.studio) parts.push(input.studio)
    if (input.actors && input.actors.length > 0) parts.push(input.actors.slice(0, 2).join(", "))
    title = parts.filter(Boolean).join(" - ")
  }

  // Still short — append top tags
  if (title.length < 10 && input.tags.length > 0) {
    title = `${title} | ${input.tags.slice(0, 3).join(", ")}`
  }

  if (keyword && !title.toLowerCase().includes(keyword.toLowerCase())) {
    title = `${keyword} | ${title}`.trim()
  }

  return title.slice(0, 150)
}

function buildImprovedDescription(input: GenerateInput): string {
  const existingDesc = (input.description || "").trim()
  const keyword = input.targetKeyword.trim()
  const parts: string[] = []

  if (existingDesc) parts.push(existingDesc)
  if (keyword && !existingDesc.toLowerCase().includes(keyword.toLowerCase())) {
    parts.push(`คีย์เวิร์ดหลัก: ${keyword}`)
  }

  if (input.storageBucket === "jav") {
    if (input.movieCode && !existingDesc.toLowerCase().includes(input.movieCode.toLowerCase())) {
      parts.push(`รหัสหนัง: ${input.movieCode}`)
    }
    if (input.studio && !existingDesc.toLowerCase().includes(input.studio.toLowerCase())) {
      parts.push(`ค่าย: ${input.studio}`)
    }
    if (input.actors && input.actors.length > 0) {
      parts.push(`นักแสดง: ${input.actors.join(", ")}`)
    }
    if (input.tags.length > 0) {
      parts.push(`ประเภท: ${input.tags.slice(0, 6).join(", ")}`)
    }
  } else {
    if (input.actors && input.actors.length > 0) {
      parts.push(`นักแสดง: ${input.actors.join(", ")}`)
    }
    if (input.tags.length > 0) {
      parts.push(`แท็ก: ${input.tags.slice(0, 6).join(", ")}`)
    }
  }

  return parts.join(" | ").slice(0, 2000)
}

function buildImprovedTags(input: GenerateInput): string[] {
  const seen = new Set(input.tags.map((t) => t.toLowerCase()))
  const result: string[] = [...input.tags]

  const keyword = input.targetKeyword.trim()
  if (keyword && !seen.has(keyword.toLowerCase())) {
    result.unshift(keyword)
    seen.add(keyword.toLowerCase())
  }

  // Add actor names as tags
  for (const actor of input.actors ?? []) {
    if (!seen.has(actor.toLowerCase()) && result.length < 20) {
      result.push(actor)
      seen.add(actor.toLowerCase())
    }
  }

  // Add studio as tag
  if (input.studio && !seen.has(input.studio.toLowerCase()) && result.length < 20) {
    result.push(input.studio)
    seen.add(input.studio.toLowerCase())
  }

  // Fill from the relevant tag pool to reach at least 10 tags
  const pool = input.storageBucket === "jav" ? [...AV_GENRES] : [...STANDARD_TAGS]
  for (const tag of pool) {
    if (result.length >= 15) break
    if (!seen.has(tag.toLowerCase())) {
      result.push(tag)
      seen.add(tag.toLowerCase())
    }
  }

  return result.slice(0, 100)
}

export async function POST(request: NextRequest) {
  const user = await getUserFromRequest(request)
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const body = await request.json().catch(() => ({}))
  const parsed = generateSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input", issues: parsed.error.issues }, { status: 400 })
  }

  const input = parsed.data
  const improvedTitle = buildImprovedTitle(input)
  const improvedDescription = buildImprovedDescription(input)
  const improvedTags = buildImprovedTags(input)

  // Compute expected score with generated values
  const seoInput: SeoAnalysisInput = {
    title: improvedTitle,
    targetKeyword: input.targetKeyword,
    description: improvedDescription,
    tags: improvedTags,
    thumbnailFile: input.hasThumbnail ?? false,
    movieCode: input.movieCode,
    studio: input.studio,
    storageBucket: input.storageBucket,
    actors: input.actors,
    categoryNames: input.categoryNames,
  }
  const expectedResult = analyzeVideoSeo(seoInput)

  return NextResponse.json({
    title: improvedTitle,
    description: improvedDescription,
    tags: improvedTags,
    expectedScore: expectedResult.score,
  })
}
