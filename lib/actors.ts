export const normalizeActors = (actors?: string[] | null) => {
  if (!actors) return []
  const seen = new Set<string>()
  const normalized: string[] = []
  for (const actor of actors) {
    const cleaned = actor.trim()
    if (!cleaned) continue
    const key = cleaned.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    normalized.push(cleaned)
  }
  return normalized
}
