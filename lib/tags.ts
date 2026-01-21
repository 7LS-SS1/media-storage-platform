export const normalizeTags = (tags?: string[] | null) => {
  if (!tags) return []
  const seen = new Set<string>()
  const normalized: string[] = []
  for (const tag of tags) {
    const cleaned = tag.trim()
    if (!cleaned) continue
    const key = cleaned.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    normalized.push(cleaned)
  }
  return normalized
}

export const mergeTags = (
  tags?: string[] | null,
  category?: { name?: string | null } | Array<{ name?: string | null }> | null,
) => {
  const combined = normalizeTags(tags)
  const categories = Array.isArray(category) ? category : category ? [category] : []
  categories.forEach((item) => {
    const categoryName = item?.name?.trim()
    if (!categoryName) return
    const key = categoryName.toLowerCase()
    if (!combined.some((tag) => tag.toLowerCase() === key)) {
      combined.push(categoryName)
    }
  })
  return combined
}
