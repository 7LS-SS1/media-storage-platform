// ─── SEO Scoring Module for Videos ───────────────────────────────────────────

export interface SeoCheckResult {
  key: string
  label: string
  passed: boolean
  message: string
  suggestion: string
  weight: number
  earned: number
  isCritical: boolean
}

export interface SeoAnalysisInput {
  title: string
  targetKeyword: string
  description?: string
  tags: string[]
  thumbnailFile?: boolean
  movieCode?: string
  studio?: string
  storageBucket: "media" | "jav"
  actors?: string[]
  categoryNames?: string[]
}

export interface SeoAnalysisResult {
  score: number
  passed: boolean
  checks: SeoCheckResult[]
  recommendations: string[]
}

export interface SeoGenerateSuggestion {
  title: string
  description: string
  tags: string[]
  expectedScore: number
}

// ─── Constants ────────────────────────────────────────────────────────────────
const SEO_MIN_TITLE_LEN = 10
const SEO_MAX_TITLE_LEN = 150
const SEO_MIN_DESC_LEN = 30
const SEO_MIN_TAGS = 3
export const SEO_PASS_SCORE = 80

// ─── Individual Checks ───────────────────────────────────────────────────────

function checkTitleLength(title: string): SeoCheckResult {
  const len = title.trim().length
  const base = { key: "title_length", label: "ความยาวชื่อวิดีโอ", isCritical: true, weight: 25 }

  if (len === 0) {
    return { ...base, passed: false, earned: 0, message: "ไม่มีชื่อวิดีโอ", suggestion: "กรุณากรอกชื่อวิดีโออย่างน้อย 10 ตัวอักษร" }
  }
  if (len < SEO_MIN_TITLE_LEN) {
    return {
      ...base, passed: false, earned: 0,
      message: `ชื่อสั้นเกินไป (${len} ตัวอักษร, ต้องการ ${SEO_MIN_TITLE_LEN}+)`,
      suggestion: `เพิ่มรายละเอียดเช่น ชื่อนักแสดง, ประเภท, หรือจุดเด่นของคลิปให้ชื่อยาวขึ้น`,
    }
  }
  if (len > SEO_MAX_TITLE_LEN) {
    return {
      ...base, passed: false, earned: Math.round(25 * 0.5),
      message: `ชื่อยาวเกินไป (${len} ตัวอักษร, สูงสุด ${SEO_MAX_TITLE_LEN})`,
      suggestion: `ลดความยาวชื่อให้ไม่เกิน ${SEO_MAX_TITLE_LEN} ตัวอักษร`,
    }
  }
  const optimal = len >= 20 && len <= 100
  return {
    ...base, passed: true, earned: optimal ? 25 : 21,
    message: `ความยาวชื่อเหมาะสม (${len} ตัวอักษร)`,
    suggestion: optimal ? "" : "ปรับความยาวชื่อให้อยู่ระหว่าง 20–100 ตัวอักษรเพื่อคะแนนสูงสุด",
  }
}

function checkDescriptionQuality(description: string): SeoCheckResult {
  const len = (description || "").trim().length
  const base = { key: "description_quality", label: "คุณภาพคำอธิบาย", isCritical: true, weight: 20 }

  if (len === 0) {
    return { ...base, passed: false, earned: 0, message: "ไม่มีคำอธิบาย", suggestion: "เพิ่มคำอธิบายอย่างน้อย 30 ตัวอักษรเพื่อช่วยให้ค้นหาเจอ" }
  }
  if (len < SEO_MIN_DESC_LEN) {
    const earned = Math.round(20 * (len / SEO_MIN_DESC_LEN) * 0.5)
    return {
      ...base, passed: false, earned,
      message: `คำอธิบายสั้นเกินไป (${len} ตัวอักษร, ต้องการ ${SEO_MIN_DESC_LEN}+)`,
      suggestion: `เพิ่มรายละเอียดอีก ${SEO_MIN_DESC_LEN - len} ตัวอักษร`,
    }
  }
  if (len < 100) {
    return {
      ...base, passed: true, earned: 15,
      message: `คำอธิบายผ่านขั้นต่ำ (${len} ตัวอักษร)`,
      suggestion: "แนะนำเพิ่มคำอธิบายให้ยาวกว่า 100 ตัวอักษรเพื่อคะแนนเต็ม",
    }
  }
  return { ...base, passed: true, earned: 20, message: `คำอธิบายดี (${len} ตัวอักษร)`, suggestion: "" }
}

function checkTargetKeywordPlacement(input: SeoAnalysisInput): SeoCheckResult {
  const base = { key: "target_keyword", label: "คีย์เวิร์ดหลัก (Target keyword)", isCritical: true, weight: 20 }
  const keyword = input.targetKeyword.trim().toLowerCase()
  const normalizedTitle = input.title.trim().toLowerCase()
  const normalizedDescription = (input.description || "").trim().toLowerCase()
  const normalizedTags = input.tags.map((tag) => tag.trim().toLowerCase())

  if (!keyword) {
    return {
      ...base,
      passed: false,
      earned: 0,
      message: "ยังไม่ได้กำหนด Target keyword",
      suggestion: "กรอก Target keyword อย่างน้อย 1 คำก่อนตรวจ SEO",
    }
  }

  const inTitle = normalizedTitle.includes(keyword)
  const inDescription = normalizedDescription.includes(keyword)
  const inTags = normalizedTags.some((tag) => tag === keyword || tag.includes(keyword) || keyword.includes(tag))

  if (inTitle && (inDescription || inTags)) {
    return {
      ...base,
      passed: true,
      earned: 20,
      message: `คีย์เวิร์ดหลัก "${input.targetKeyword}" ถูกใช้อย่างเหมาะสม`,
      suggestion: "",
    }
  }

  if (inTitle || inDescription) {
    return {
      ...base,
      passed: true,
      earned: 15,
      message: `พบคีย์เวิร์ดหลัก "${input.targetKeyword}" ในเนื้อหาแล้ว`,
      suggestion: "เพิ่มคีย์เวิร์ดหลักใน tags ด้วยเพื่อเสริมคะแนน",
    }
  }

  if (inTags) {
    return {
      ...base,
      passed: false,
      earned: 6,
      message: `พบคีย์เวิร์ดหลักใน tags แต่ยังไม่อยู่ในชื่อ/คำอธิบาย`,
      suggestion: `ใส่คำว่า "${input.targetKeyword}" ในชื่อหรือคำอธิบาย`,
    }
  }

  return {
    ...base,
    passed: false,
    earned: 0,
    message: `ไม่พบคีย์เวิร์ดหลัก "${input.targetKeyword}"`,
    suggestion: `เพิ่ม "${input.targetKeyword}" ในชื่อ คำอธิบาย และ tags`,
  }
}

function checkTagCount(tags: string[]): SeoCheckResult {
  const count = tags.length
  const base = { key: "tag_count", label: "จำนวนแท็ก", isCritical: true, weight: 20 }

  if (count === 0) {
    return { ...base, passed: false, earned: 0, message: "ไม่มีแท็ก", suggestion: `เพิ่มแท็กอย่างน้อย ${SEO_MIN_TAGS} รายการ` }
  }
  if (count < SEO_MIN_TAGS) {
    const earned = Math.round(20 * (count / SEO_MIN_TAGS) * 0.5)
    return {
      ...base, passed: false, earned,
      message: `แท็กน้อยเกินไป (${count} แท็ก, ต้องการ ${SEO_MIN_TAGS}+)`,
      suggestion: `เพิ่มแท็กอีก ${SEO_MIN_TAGS - count} รายการ เช่น ประเภท, ชื่อนักแสดง`,
    }
  }
  if (count < 10) {
    return {
      ...base, passed: true, earned: 16,
      message: `มีแท็ก ${count} รายการ`,
      suggestion: "แนะนำเพิ่มแท็กให้ถึง 10 รายการเพื่อคะแนนเต็ม",
    }
  }
  return { ...base, passed: true, earned: 20, message: `แท็กครบถ้วน (${count} รายการ)`, suggestion: "" }
}

function checkKeywordCoverage(input: SeoAnalysisInput): SeoCheckResult {
  const base = { key: "keyword_coverage", label: "คีย์เวิร์ดในชื่อ/คำอธิบาย", isCritical: false, weight: 15 }

  const combined = `${input.title} ${input.description || ""}`.toLowerCase()
  const keywords = [
    input.targetKeyword?.toLowerCase().trim(),
    ...input.tags.map((t) => t.toLowerCase()),
    input.movieCode?.toLowerCase(),
    input.studio?.toLowerCase(),
    ...(input.actors || []).map((a) => a.toLowerCase()),
    ...(input.categoryNames || []).map((name) => name.toLowerCase()),
  ].filter((k): k is string => Boolean(k && k.length >= 2))

  if (keywords.length === 0) {
    return { ...base, passed: false, earned: 0, message: "ไม่มีคีย์เวิร์ดให้ตรวจสอบ", suggestion: "เพิ่มแท็กที่เกี่ยวข้องกับเนื้อหา" }
  }

  const matching = keywords.filter((kw) => combined.includes(kw))
  const ratio = matching.length / keywords.length

  if (matching.length === 0) {
    return { ...base, passed: false, earned: 0, message: "ไม่มีคีย์เวิร์ดปรากฏในชื่อหรือคำอธิบาย", suggestion: "ใส่คำสำคัญจากแท็กลงในชื่อหรือคำอธิบาย" }
  }

  const earned = Math.round(15 * (0.4 + ratio * 0.6))
  return {
    ...base, passed: true, earned,
    message: `มีคีย์เวิร์ดปรากฏ ${matching.length}/${keywords.length} รายการ`,
    suggestion: ratio < 0.3 ? "แนะนำเพิ่มคีย์เวิร์ดสำคัญในชื่อหรือคำอธิบาย" : "",
  }
}

function checkTagDiversity(tags: string[]): SeoCheckResult {
  const base = { key: "tag_diversity", label: "ความหลากหลายของแท็ก (ไม่ซ้ำซ้อน)", isCritical: false, weight: 10 }

  if (tags.length < 3) {
    return { ...base, passed: false, earned: 0, message: "แท็กน้อยเกินไปสำหรับตรวจสอบความหลากหลาย", suggestion: "เพิ่มแท็กที่หลากหลาย" }
  }

  const tagsLower = tags.map((t) => t.toLowerCase().trim())
  const prefixGroups = new Map<string, number>()
  for (const tag of tagsLower) {
    const prefix = tag.slice(0, 4)
    prefixGroups.set(prefix, (prefixGroups.get(prefix) || 0) + 1)
  }
  const maxGroupSize = Math.max(...prefixGroups.values())
  const stuffingRatio = maxGroupSize / tags.length

  if (stuffingRatio > 0.5 && tags.length >= 5) {
    return { ...base, passed: false, earned: 3, message: "แท็กมีความซ้ำซ้อนสูง (keyword stuffing)", suggestion: "ลดแท็กที่คล้ายกันและเพิ่มความหลากหลาย" }
  }
  return { ...base, passed: true, earned: 10, message: "แท็กมีความหลากหลายเหมาะสม", suggestion: "" }
}

function checkThumbnailPresence(hasThumbnail: boolean): SeoCheckResult {
  const base = { key: "thumbnail_presence", label: "รูปหน้าปก (คะแนนเสริม)", isCritical: false, weight: 10 }

  if (hasThumbnail) {
    return { ...base, passed: true, earned: 10, message: "มีรูปหน้าปก", suggestion: "" }
  }
  return { ...base, passed: false, earned: 0, message: "ไม่มีรูปหน้าปก", suggestion: "เพิ่มรูปหน้าปกเพื่อดึงดูดผู้ชมและเพิ่มคะแนน SEO" }
}

// ─── Main Analysis Function ───────────────────────────────────────────────────

export function analyzeVideoSeo(input: SeoAnalysisInput): SeoAnalysisResult {
  const checks: SeoCheckResult[] = [
    checkTitleLength(input.title),
    checkDescriptionQuality(input.description || ""),
    checkTargetKeywordPlacement(input),
    checkTagCount(input.tags),
    checkKeywordCoverage(input),
    checkTagDiversity(input.tags),
    checkThumbnailPresence(input.thumbnailFile ?? false),
  ]

  const totalWeight = checks.reduce((sum, c) => sum + c.weight, 0)
  const totalEarned = checks.reduce((sum, c) => sum + c.earned, 0)
  const score = Math.round((totalEarned / totalWeight) * 100)

  const criticalFailed = checks.filter((c) => c.isCritical && !c.passed)
  const passed = score >= SEO_PASS_SCORE && criticalFailed.length === 0

  const recommendations = checks.filter((c) => !c.passed && c.suggestion).map((c) => c.suggestion)

  if (!passed && score < SEO_PASS_SCORE && criticalFailed.length === 0) {
    recommendations.push(`คะแนนรวม ${score}/100 ยังต่ำกว่าเกณฑ์ผ่าน (${SEO_PASS_SCORE} คะแนน)`)
  }

  return { score, passed, checks, recommendations }
}
