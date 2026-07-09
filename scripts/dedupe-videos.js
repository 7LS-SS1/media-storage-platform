const { PrismaClient } = require("@prisma/client")
const fs = require("fs")
const path = require("path")

const loadEnvFile = (filePath) => {
  if (!fs.existsSync(filePath)) return
  const lines = fs.readFileSync(filePath, "utf8").split(/\r?\n/)
  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith("#")) continue
    const separatorIndex = trimmed.indexOf("=")
    if (separatorIndex < 0) continue
    const key = trimmed.slice(0, separatorIndex).trim()
    const rawValue = trimmed.slice(separatorIndex + 1).trim()
    if (!key || process.env[key] !== undefined) continue
    process.env[key] = rawValue.replace(/^['"]|['"]$/g, "")
  }
}

loadEnvFile(path.join(process.cwd(), ".env"))
loadEnvFile(path.join(process.cwd(), ".env.local"))

const prisma = new PrismaClient()

const args = new Set(process.argv.slice(2))
const shouldApply = args.has("--apply")

const parseBucket = (value) => (value === "jav" ? "jav" : "media")

const extractKey = (url) => {
  if (!url) return null
  const withoutQuery = String(url).split("?")[0].split("#")[0].trim()
  if (!withoutQuery) return null

  let pathValue = withoutQuery
  try {
    if (/^https?:\/\//i.test(withoutQuery) || withoutQuery.startsWith("//")) {
      const parsed = new URL(withoutQuery.startsWith("//") ? `https:${withoutQuery}` : withoutQuery)
      pathValue = parsed.pathname
    }
  } catch {
    pathValue = withoutQuery
  }

  const path = pathValue.replace(/^\/+/, "")
  const prefixes = ["media-storage/", "jav-storage/"]
  for (const prefix of prefixes) {
    const index = path.indexOf(prefix)
    if (index >= 0) return path.slice(index)
  }

  return path
}

const metadataScore = (video) => {
  let score = 0
  if (video.status === "READY") score += 20
  if (video.mimeType === "video/mp4") score += 10
  if (video.thumbnailUrl) score += 5
  if (video.description) score += 3
  if (video.movieCode) score += 3
  if (video.studio) score += 2
  score += Math.min(video.tags.length, 5)
  score += Math.min(video.categories.length, 5)
  score += Math.min(video.actors.length, 5)
  score += Math.min(video.views, 10)
  return score
}

const pickVideoToKeep = (videos) => {
  return [...videos].sort((a, b) => {
    const scoreDiff = metadataScore(b) - metadataScore(a)
    if (scoreDiff !== 0) return scoreDiff
    return a.createdAt.getTime() - b.createdAt.getTime()
  })[0]
}

const main = async () => {
  const videos = await prisma.video.findMany({
    select: {
      id: true,
      title: true,
      videoUrl: true,
      thumbnailUrl: true,
      description: true,
      movieCode: true,
      studio: true,
      tags: true,
      mimeType: true,
      storageBucket: true,
      status: true,
      views: true,
      createdAt: true,
      categories: { select: { id: true } },
      actors: { select: { id: true } },
    },
  })

  const groups = new Map()
  for (const video of videos) {
    const key = extractKey(video.videoUrl)
    if (!key) continue
    const groupKey = `${parseBucket(video.storageBucket)}:${key.toLowerCase()}`
    const group = groups.get(groupKey) ?? []
    group.push(video)
    groups.set(groupKey, group)
  }

  const duplicateGroups = Array.from(groups.entries()).filter(([, group]) => group.length > 1)
  const deleteIds = []

  for (const [groupKey, group] of duplicateGroups) {
    const keep = pickVideoToKeep(group)
    const duplicates = group.filter((video) => video.id !== keep.id)
    deleteIds.push(...duplicates.map((video) => video.id))
    console.log(`${groupKey}: keep ${keep.id} (${keep.title}), delete ${duplicates.length}`)
  }

  console.log(`Duplicate groups: ${duplicateGroups.length}`)
  console.log(`Videos to delete: ${deleteIds.length}`)

  if (!shouldApply) {
    console.log("Dry run only. Re-run with --apply to delete duplicate video rows.")
    return
  }

  if (deleteIds.length === 0) return

  const result = await prisma.video.deleteMany({
    where: { id: { in: deleteIds } },
  })
  console.log(`Deleted ${result.count} duplicate videos.`)
}

main()
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
