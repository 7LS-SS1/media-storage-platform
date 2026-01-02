import { z } from "zod"

// Video Validation Schemas
export const createVideoSchema = z.object({
  title: z.string().min(1, "Title is required").max(200),
  description: z.string().max(2000).optional(),
  categoryId: z.string().optional(),
  visibility: z.enum(["PUBLIC", "PRIVATE", "DOMAIN_RESTRICTED"]).default("PUBLIC"),
  allowedDomainIds: z.array(z.string()).optional(),
})

export const updateVideoSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().max(2000).optional().nullable(),
  categoryId: z.string().optional().nullable(),
  visibility: z.enum(["PUBLIC", "PRIVATE", "DOMAIN_RESTRICTED"]).optional(),
  status: z.enum(["PROCESSING", "READY", "FAILED"]).optional(),
  allowedDomainIds: z.array(z.string()).optional(),
})

export const videoQuerySchema = z.object({
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(20),
  search: z.string().optional(),
  categoryId: z.string().optional(),
  visibility: z.enum(["PUBLIC", "PRIVATE", "DOMAIN_RESTRICTED"]).optional(),
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
  role: z.enum(["ADMIN", "EDITOR", "VIEWER"]).default("VIEWER"),
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
