import { z } from "zod"
import { TAG_LIMIT } from "@/lib/tag-constraints"

// Video Validation Schemas
export const createVideoSchema = z
  .object({
    title: z.string().min(1, "Title is required").max(200),
    description: z.string().max(2000).optional(),
    movieCode: z.string().max(100).optional().nullable(),
    studio: z.string().max(200).optional().nullable(),
    releaseDate: z.union([z.coerce.date(), z.null()]).optional(),
    tags: z.array(z.string().min(1).max(50)).max(TAG_LIMIT).optional(),
    actors: z.array(z.string().min(1).max(100)).max(50).optional(),
    categoryId: z.string().min(1).optional(),
    categoryIds: z.array(z.string().min(1)).optional(),
    visibility: z.enum(["PUBLIC", "PRIVATE", "DOMAIN_RESTRICTED"]).default("PUBLIC"),
    allowedDomainIds: z.array(z.string().min(1)).optional(),
    videoUrl: z.string().url(),
    thumbnailUrl: z.string().url().optional().nullable(),
    storageBucket: z.enum(["media", "jav"]).optional().default("media"),
    duration: z.number().int().min(0).optional(),
    fileSize: z.number().int().min(0).optional(),
    mimeType: z.string().min(1).optional(),
  })
  .superRefine((data, ctx) => {
    if (data.visibility === "DOMAIN_RESTRICTED" && (!data.allowedDomainIds || data.allowedDomainIds.length === 0)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Allowed domains are required for domain-restricted videos",
        path: ["allowedDomainIds"],
      })
    }
  })

export const updateVideoSchema = z
  .object({
    title: z.string().min(1).max(200).optional(),
    description: z.string().max(2000).optional().nullable(),
    movieCode: z.string().max(100).optional().nullable(),
    studio: z.string().max(200).optional().nullable(),
    releaseDate: z.union([z.coerce.date(), z.null()]).optional(),
    tags: z.array(z.string().min(1).max(50)).max(TAG_LIMIT).optional(),
    actors: z.array(z.string().min(1).max(100)).max(50).optional(),
    categoryId: z.string().min(1).optional().nullable(),
    categoryIds: z.array(z.string().min(1)).optional(),
    visibility: z.enum(["PUBLIC", "PRIVATE", "DOMAIN_RESTRICTED"]).optional(),
    status: z.enum(["PROCESSING", "READY", "FAILED"]).optional(),
    allowedDomainIds: z.array(z.string().min(1)).optional(),
    thumbnailUrl: z.string().url().optional().nullable(),
  })
  .superRefine((data, ctx) => {
    if (data.visibility === "DOMAIN_RESTRICTED" && (!data.allowedDomainIds || data.allowedDomainIds.length === 0)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Allowed domains are required for domain-restricted videos",
        path: ["allowedDomainIds"],
      })
    }
  })

export const videoQuerySchema = z.object({
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(20),
  per_page: z.coerce.number().min(1).max(100).optional(),
  since: z.string().optional(),
  type: z.preprocess(
    (value) => (value === "thai_clip" || value === "av_movie" ? value : undefined),
    z.enum(["thai_clip", "av_movie"]).optional(),
  ),
  project_id: z.string().optional(),
  search: z.string().optional(),
  categoryId: z.string().optional(),
  visibility: z.enum(["PUBLIC", "PRIVATE", "DOMAIN_RESTRICTED"]).optional(),
  storageBucket: z.preprocess(
    (value) => (value === "all" ? undefined : value),
    z.enum(["media", "jav"]).optional(),
  ),
  sort: z.enum(["newest", "oldest", "popular"]).default("newest"),
})

// Auth Validation Schemas
export const loginSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
})

export const registerSchema = z.object({
  email: z.string().email("Invalid email address"),
  name: z.string().min(2, "Name must be at least 2 characters").optional(),
  password: z.string().min(6, "Password must be at least 6 characters"),
  role: z.enum(["SYSTEM", "ADMIN", "STAFF", "EDITOR", "VIEWER"]).default("VIEWER"),
})

// Domain Validation Schemas
export const createDomainSchema = z.object({
  domain: z
    .string()
    .url("Invalid domain URL")
    .or(z.string().regex(/^[a-zA-Z0-9][a-zA-Z0-9-]{1,61}[a-zA-Z0-9]\.[a-zA-Z]{2,}$/)),
})

export type CreateVideoInput = z.infer<typeof createVideoSchema>
export type UpdateVideoInput = z.infer<typeof updateVideoSchema>
export type VideoQueryInput = z.infer<typeof videoQuerySchema>
export type LoginInput = z.infer<typeof loginSchema>
export type RegisterInput = z.infer<typeof registerSchema>
export type CreateDomainInput = z.infer<typeof createDomainSchema>

export const normalizeIdList = (ids?: string[] | null) => {
  if (!ids) return []
  const seen = new Set<string>()
  const normalized: string[] = []
  for (const value of ids) {
    const cleaned = value.trim()
    if (!cleaned) continue
    if (seen.has(cleaned)) continue
    seen.add(cleaned)
    normalized.push(cleaned)
  }
  return normalized
}
