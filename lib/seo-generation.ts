import { z } from "zod"
import { AV_GENRES } from "@/lib/av-genres"
import { STANDARD_TAGS } from "@/lib/standard-tags"

export const seoGenerateInputSchema = z.object({
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

export type SeoGenerateInput = z.infer<typeof seoGenerateInputSchema>

const seoAiOutputSchema = z.object({
  title: z.string().min(12).max(110),
  metaTitle: z.string().min(12).max(80),
  metaDescription: z.string().min(90).max(180),
  description: z.string().min(100).max(420),
  tags: z.array(z.string().min(2).max(48)).min(6).max(14),
  keywordFocus: z.array(z.string().min(2).max(60)).min(2).max(6),
})

type SeoAiOutput = z.infer<typeof seoAiOutputSchema>

export type SeoGenerationResult = {
  title: string
  metaTitle: string
  metaDescription: string
  description: string
  tags: string[]
  keywordFocus: string[]
  source: "openai" | "fallback"
  model?: string
}

const OPENAI_SEO_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    title: { type: "string", minLength: 12, maxLength: 110 },
    metaTitle: { type: "string", minLength: 12, maxLength: 80 },
    metaDescription: { type: "string", minLength: 90, maxLength: 180 },
    description: { type: "string", minLength: 100, maxLength: 420 },
    tags: {
      type: "array",
      minItems: 6,
      maxItems: 14,
      items: { type: "string", minLength: 2, maxLength: 48 },
    },
    keywordFocus: {
      type: "array",
      minItems: 2,
      maxItems: 6,
      items: { type: "string", minLength: 2, maxLength: 60 },
    },
  },
  required: ["title", "metaTitle", "metaDescription", "description", "tags", "keywordFocus"],
} as const

const OPENAI_SEO_INSTRUCTIONS = `
You are a senior SEO strategist and conversion-focused metadata writer.
Write Thai SEO copy that feels intentional, natural, and specific, similar to a strong human content writer.

Your job:
- Rewrite the provided metadata into a better search-oriented title, meta title, meta description, body description, and relevant tags.
- Use only facts that appear in the input. Never invent actor names, studios, codes, categories, or story details.
- Keep the main target keyword near the front when natural.
- Avoid keyword stuffing, repetitive separators, hashtags, filler words, and robotic phrasing.
- Prefer one clear search angle instead of cramming every field into the first line.
- Meta title should be concise, readable, and click-worthy.
- Meta description should read like a polished search snippet: 1-2 sentences, concrete, helpful, and not spammy.
- Body description should be 2-4 short sentences and richer than the meta description while staying compact.
- Tags must be tightly relevant only. Mix exact keyword, entities, genre/category, and a few high-intent discovery tags.
- Remove duplicates and near-duplicates.

Style guardrails:
- Thai first. Keep movie codes, names, and proper nouns in their original form.
- Sound like an editor, not like a template engine.
- Use specificity over hype.
- Keep the copy useful for both search engines and human readers.
`.trim()

const TITLE_MIN_LEN = 24
const TITLE_MAX_LEN = 96
const META_TITLE_MAX_LEN = 80
const META_DESCRIPTION_MIN_LEN = 100
const META_DESCRIPTION_MAX_LEN = 170
const DESCRIPTION_MIN_LEN = 120
const DESCRIPTION_MAX_LEN = 360
const TAG_LIMIT = 14

function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim()
}

function cleanText(value?: string | null): string {
  return normalizeWhitespace(value ?? "")
}

function trimPunctuation(value: string): string {
  return value.replace(/[\s|,;:•\-–—]+$/g, "").trim()
}

function truncateText(value: string, maxLength: number): string {
  const normalized = normalizeWhitespace(value)
  if (normalized.length <= maxLength) return normalized

  const sliced = normalized.slice(0, maxLength + 1)
  const lastBoundary = Math.max(
    sliced.lastIndexOf(" "),
    sliced.lastIndexOf(","),
    sliced.lastIndexOf("•"),
    sliced.lastIndexOf("-"),
  )

  if (lastBoundary >= Math.floor(maxLength * 0.6)) {
    return trimPunctuation(sliced.slice(0, lastBoundary))
  }

  return trimPunctuation(normalized.slice(0, maxLength))
}

function sentenceCase(value: string): string {
  return trimPunctuation(normalizeWhitespace(value))
}

function uniqueCaseInsensitive(values: Array<string | undefined | null>): string[] {
  const seen = new Set<string>()
  const result: string[] = []

  for (const value of values) {
    const cleaned = cleanText(value)
    if (!cleaned) continue
    const key = cleaned.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    result.push(cleaned)
  }

  return result
}

function joinList(values: string[] | undefined, limit = 2): string {
  return uniqueCaseInsensitive(values ?? []).slice(0, limit).join(", ")
}

function includesTerm(haystack: string, needle: string): boolean {
  return haystack.toLowerCase().includes(needle.toLowerCase())
}

function dedupeEntitiesAgainstKeyword(keyword: string, values: string[]): string[] {
  return values.filter((value) => !includesTerm(keyword, value))
}

function buildContext(input: SeoGenerateInput) {
  const keyword = cleanText(input.targetKeyword)
  const title = cleanText(input.title)
  const movieCode = cleanText(input.movieCode)
  const studio = cleanText(input.studio)
  const actors = uniqueCaseInsensitive(input.actors ?? [])
  const categoryNames = uniqueCaseInsensitive(input.categoryNames ?? [])
  const tags = uniqueCaseInsensitive(input.tags)
  const actorLead = joinList(actors, input.storageBucket === "jav" ? 2 : 1)
  const primaryGenre = uniqueCaseInsensitive([...tags, ...categoryNames]).find((term) =>
    includesTerm(`${keyword} ${title} ${tags.join(" ")}`, term),
  )

  return {
    keyword,
    title,
    movieCode,
    studio,
    actors,
    categoryNames,
    tags,
    actorLead,
    primaryGenre: cleanText(primaryGenre),
  }
}

function buildHeuristicTitle(input: SeoGenerateInput): string {
  const context = buildContext(input)
  const supportSegments = dedupeEntitiesAgainstKeyword(context.keyword, [
    context.movieCode ? `(${context.movieCode})` : "",
    context.actorLead,
    input.storageBucket === "jav" && context.studio ? `ค่าย ${context.studio}` : context.primaryGenre,
  ])

  let title = context.keyword
  if (supportSegments.length > 0) {
    title = `${context.keyword} - ${supportSegments.slice(0, 2).join(" - ")}`
  }

  if (title.length < TITLE_MIN_LEN && context.title && !includesTerm(title, context.title)) {
    title = `${title} - ${context.title}`
  }

  return truncateText(sentenceCase(title), TITLE_MAX_LEN)
}

function buildHeuristicMetaTitle(input: SeoGenerateInput, title: string): string {
  const context = buildContext(input)
  const metaTitle =
    input.storageBucket === "jav" && context.primaryGenre && !includesTerm(title, context.primaryGenre)
      ? `${title} - ${context.primaryGenre}`
      : title

  return truncateText(sentenceCase(metaTitle), META_TITLE_MAX_LEN)
}

function buildHeuristicMetaDescription(input: SeoGenerateInput): string {
  const context = buildContext(input)
  const firstSentence = sentenceCase(
    uniqueCaseInsensitive([
      context.keyword,
      context.movieCode,
      context.actorLead ? `นำเสนอโดย ${context.actorLead}` : "",
      input.storageBucket === "jav" && context.studio ? `จากค่าย ${context.studio}` : "",
      context.primaryGenre ? `แนว ${context.primaryGenre}` : "",
    ]).join(" "),
  )

  const secondSentence = sentenceCase(
    uniqueCaseInsensitive([
      context.categoryNames.length > 0 ? `อยู่ในหมวด ${context.categoryNames.slice(0, 2).join(", ")}` : "",
      context.tags.length > 0 ? `พร้อมแท็กค้นหาที่เกี่ยวข้อง เช่น ${context.tags.slice(0, 3).join(", ")}` : "",
      input.storageBucket === "jav"
        ? "สรุปคีย์เวิร์ดหลักให้อ่านง่ายและค้นหาเจอง่ายขึ้น"
        : "สรุปจุดเด่นของคลิปให้ค้นหาและทำความเข้าใจได้ทันที",
    ]).join(" "),
  )

  const combined = truncateText(`${firstSentence}. ${secondSentence}`, META_DESCRIPTION_MAX_LEN)
  if (combined.length >= META_DESCRIPTION_MIN_LEN) return combined

  const fallbackTail =
    input.storageBucket === "jav"
      ? "เน้นรหัสหนัง นักแสดง ค่าย และแนวเรื่องแบบกระชับ."
      : "จัดวางคำค้นหลักและแท็กสำคัญให้อ่านลื่นและตรงเจตนาค้นหา."

  return truncateText(`${combined} ${fallbackTail}`, META_DESCRIPTION_MAX_LEN)
}

function buildHeuristicDescription(input: SeoGenerateInput, metaDescription: string): string {
  const context = buildContext(input)
  const supportLine = sentenceCase(
    uniqueCaseInsensitive([
      context.movieCode ? `รหัสหนัง ${context.movieCode}` : "",
      context.studio ? `ค่าย ${context.studio}` : "",
      context.actorLead ? `นักแสดง ${context.actorLead}` : "",
      context.categoryNames.length > 0 ? `หมวดหมู่ ${context.categoryNames.slice(0, 2).join(", ")}` : "",
      context.tags.length > 0 ? `รายละเอียดที่เกี่ยวข้อง ${context.tags.slice(0, 4).join(", ")}` : "",
    ]).join(" • "),
  )

  const closingLine =
    input.storageBucket === "jav"
      ? "รวมรายละเอียดสำคัญไว้แบบกระชับ เพื่อให้อ่านง่ายและค้นหาเจอจากคำสำคัญที่เกี่ยวข้อง."
      : "สรุปจุดเด่นของคลิปให้อ่านลื่น เข้าใจง่าย และครอบคลุมคำค้นสำคัญที่เกี่ยวข้อง."

  const body = truncateText(
    `${metaDescription} ${supportLine ? `รายละเอียดเด่น: ${supportLine}.` : ""} ${closingLine}`,
    DESCRIPTION_MAX_LEN,
  )

  if (body.length >= DESCRIPTION_MIN_LEN) return body

  return truncateText(`${body} รวมรายละเอียดสำคัญไว้ในข้อความเดียวเพื่อรองรับ SEO ได้ดีขึ้น.`, DESCRIPTION_MAX_LEN)
}

function buildHeuristicTags(input: SeoGenerateInput): string[] {
  const context = buildContext(input)
  const exactEntities = uniqueCaseInsensitive([
    context.keyword,
    context.movieCode,
    context.studio,
    ...context.actors,
    ...context.categoryNames,
    ...context.tags,
  ])

  const derivedLongTail = uniqueCaseInsensitive([
    context.keyword && context.movieCode ? `${context.keyword} ${context.movieCode}` : "",
    context.keyword && context.actorLead ? `${context.keyword} ${context.actorLead}` : "",
    context.keyword && context.studio ? `${context.keyword} ${context.studio}` : "",
    context.primaryGenre,
  ])

  const relevantPool = (input.storageBucket === "jav" ? [...AV_GENRES] : [...STANDARD_TAGS]).filter((tag) =>
    includesTerm(`${context.keyword} ${context.title} ${context.tags.join(" ")} ${context.categoryNames.join(" ")}`, tag),
  )

  const bucketFallbacks =
    input.storageBucket === "jav"
      ? ["AV ญี่ปุ่น", "รหัสหนัง", "นักแสดง AV", "ดูออนไลน์"]
      : ["คลิปผู้ใหญ่", "วิดีโอเต็ม", "คลิปมาใหม่", "คีย์เวิร์ดค้นหา"]

  return uniqueCaseInsensitive([...exactEntities, ...derivedLongTail, ...relevantPool, ...bucketFallbacks]).slice(
    0,
    TAG_LIMIT,
  )
}

function buildFallbackResult(input: SeoGenerateInput): SeoGenerationResult {
  const title = buildHeuristicTitle(input)
  const metaTitle = buildHeuristicMetaTitle(input, title)
  const metaDescription = buildHeuristicMetaDescription(input)
  const description = buildHeuristicDescription(input, metaDescription)
  const tags = buildHeuristicTags(input)
  const keywordFocus = uniqueCaseInsensitive([
    input.targetKeyword,
    input.movieCode,
    input.studio,
    ...(input.actors ?? []).slice(0, 2),
    ...(input.categoryNames ?? []).slice(0, 2),
  ]).slice(0, 6)

  return {
    title,
    metaTitle,
    metaDescription,
    description,
    tags,
    keywordFocus,
    source: "fallback",
  }
}

type OpenAIResponsePayload = {
  output?: Array<{
    type?: string
    role?: string
    content?: Array<{
      type?: string
      text?: string
      refusal?: string
    }>
  }>
}

function extractOpenAIOutputText(payload: OpenAIResponsePayload): string | null {
  const textParts: string[] = []

  for (const item of payload.output ?? []) {
    if (item.type !== "message" || !Array.isArray(item.content)) continue

    for (const content of item.content) {
      if (content.type === "refusal" && typeof content.refusal === "string") {
        throw new Error(content.refusal)
      }
      if (content.type === "output_text" && typeof content.text === "string") {
        textParts.push(content.text)
      }
    }
  }

  const combined = textParts.join("").trim()
  return combined.length > 0 ? combined : null
}

function ensureKeywordLead(title: string, keyword: string): string {
  if (!keyword || includesTerm(title, keyword)) return title
  return truncateText(`${keyword} - ${title}`, TITLE_MAX_LEN)
}

function sanitizeTags(tags: string[], fallbackTags: string[]): string[] {
  const cleaned = uniqueCaseInsensitive(tags).map((tag) => truncateText(tag, 48))
  if (cleaned.length >= 6) return cleaned.slice(0, TAG_LIMIT)
  return uniqueCaseInsensitive([...cleaned, ...fallbackTags]).slice(0, TAG_LIMIT)
}

function sanitizeAiResult(input: SeoGenerateInput, output: SeoAiOutput, fallback: SeoGenerationResult): SeoGenerationResult {
  const title = ensureKeywordLead(truncateText(sentenceCase(output.title), TITLE_MAX_LEN), cleanText(input.targetKeyword))
  const metaTitle = truncateText(sentenceCase(output.metaTitle || title), META_TITLE_MAX_LEN)

  const metaDescriptionCandidate = truncateText(
    sentenceCase(output.metaDescription || output.description || fallback.metaDescription),
    META_DESCRIPTION_MAX_LEN,
  )
  const metaDescription =
    metaDescriptionCandidate.length >= META_DESCRIPTION_MIN_LEN ? metaDescriptionCandidate : fallback.metaDescription

  const descriptionCandidate = truncateText(
    sentenceCase(output.description || output.metaDescription || fallback.description),
    DESCRIPTION_MAX_LEN,
  )
  const description =
    descriptionCandidate.length >= DESCRIPTION_MIN_LEN
      ? descriptionCandidate
      : truncateText(`${metaDescription} ${fallback.description}`, DESCRIPTION_MAX_LEN)

  return {
    title,
    metaTitle,
    metaDescription,
    description,
    tags: sanitizeTags(output.tags, fallback.tags),
    keywordFocus: uniqueCaseInsensitive([input.targetKeyword, ...output.keywordFocus, ...fallback.keywordFocus]).slice(0, 6),
    source: "openai",
    model: process.env.OPENAI_SEO_MODEL?.trim() || "gpt-5.5",
  }
}

async function generateWithOpenAI(input: SeoGenerateInput, fallback: SeoGenerationResult): Promise<SeoGenerationResult> {
  const apiKey = process.env.OPENAI_API_KEY?.trim()
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is not configured")
  }

  const model = process.env.OPENAI_SEO_MODEL?.trim() || "gpt-5.5"
  const signal =
    typeof AbortSignal !== "undefined" && "timeout" in AbortSignal
      ? AbortSignal.timeout(20000)
      : undefined

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    signal,
    body: JSON.stringify({
      model,
      store: false,
      temperature: 0.7,
      max_output_tokens: 1200,
      reasoning: { effort: "low" },
      instructions: OPENAI_SEO_INSTRUCTIONS,
      input: [
        {
          role: "user",
          content: [
            {
              type: "input_text",
              text: `Generate improved SEO metadata from this JSON input:\n${JSON.stringify(input, null, 2)}`,
            },
          ],
        },
      ],
      text: {
        format: {
          type: "json_schema",
          name: "seo_generation_result",
          strict: true,
          schema: OPENAI_SEO_SCHEMA,
        },
      },
    }),
  })

  if (!response.ok) {
    const errorBody = await response.text().catch(() => "")
    throw new Error(`OpenAI SEO request failed (${response.status}): ${errorBody}`)
  }

  const payload = (await response.json()) as OpenAIResponsePayload
  const outputText = extractOpenAIOutputText(payload)
  if (!outputText) {
    throw new Error("OpenAI SEO response did not contain structured text output")
  }

  const parsedJson = JSON.parse(outputText)
  const parsed = seoAiOutputSchema.safeParse(parsedJson)
  if (!parsed.success) {
    throw new Error(`OpenAI SEO response failed validation: ${parsed.error.issues[0]?.message ?? "unknown error"}`)
  }

  return sanitizeAiResult(input, parsed.data, fallback)
}

export async function generateSeoSuggestion(input: SeoGenerateInput): Promise<SeoGenerationResult> {
  const fallback = buildFallbackResult(input)

  if (!process.env.OPENAI_API_KEY?.trim()) {
    return fallback
  }

  try {
    return await generateWithOpenAI(input, fallback)
  } catch (error) {
    console.warn("SEO generation fell back to deterministic mode:", error)
    return fallback
  }
}
