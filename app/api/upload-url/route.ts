import { type NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { getUserFromRequest } from "@/lib/auth"
import { canManageVideos } from "@/lib/roles"
import {
  generateUploadKey,
  getPublicR2Url,
  getSignedUploadUrl,
  createMultipartUpload,
} from "@/lib/r2"

const MAX_FILE_SIZE = 20 * 1024 * 1024 * 1024 // 20GB
const MULTIPART_THRESHOLD = 1 * 1024 * 1024 * 1024 // 1GB (reduce failures on large uploads)
const MIN_PART_SIZE = 5 * 1024 * 1024 // 5MB
const DEFAULT_PART_SIZE = 100 * 1024 * 1024 // 100MB
const MAX_PARTS = 10000

const ALLOWED_VIDEO_TYPES = [
  "video/mp4",
  "video/webm",
  "video/quicktime",
  "video/x-msvideo",
  "video/mp2t",
  "video/ts",
  "video/m2ts",
]
const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"]

const uploadUrlSchema = z.object({
  filename: z.string().min(1),
  contentType: z.string().optional().default(""),
  size: z.number().int().positive(),
  type: z.enum(["video", "thumbnail"]),
  storageBucket: z.enum(["media", "jav"]).optional().default("media"),
  forceMultipart: z.boolean().optional().default(false),
})

export async function POST(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request)
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    if (!canManageVideos(user.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const body = await request.json().catch(() => ({}))
    const validatedData = uploadUrlSchema.parse(body)

    if (validatedData.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: `File too large. Maximum size: ${MAX_FILE_SIZE / 1024 / 1024}MB` },
        { status: 400 },
      )
    }

    const allowedTypes = validatedData.type === "thumbnail" ? ALLOWED_IMAGE_TYPES : ALLOWED_VIDEO_TYPES
    const normalizedType = validatedData.contentType.toLowerCase()
    let uploadContentType = normalizedType
    const isTsFile = validatedData.type === "video" && validatedData.filename.toLowerCase().endsWith(".ts")

    if (!allowedTypes.includes(normalizedType)) {
      if (isTsFile && (normalizedType === "application/octet-stream" || normalizedType === "")) {
        uploadContentType = "video/mp2t"
      } else {
        return NextResponse.json(
          { error: `Invalid file type. Allowed types: ${allowedTypes.join(", ")}` },
          { status: 400 },
        )
      }
    }

    const key = generateUploadKey(validatedData.filename, validatedData.type, validatedData.storageBucket)
    const publicUrl = getPublicR2Url(key, validatedData.storageBucket)
    const shouldUseMultipart =
      validatedData.type === "video" &&
      (validatedData.forceMultipart || validatedData.size > MULTIPART_THRESHOLD)

    if (shouldUseMultipart) {
      const partSize = Math.max(DEFAULT_PART_SIZE, Math.ceil(validatedData.size / MAX_PARTS))
      const normalizedPartSize = Math.max(MIN_PART_SIZE, partSize)
      const uploadId = await createMultipartUpload(key, uploadContentType, validatedData.storageBucket)

      return NextResponse.json({
        multipart: true,
        uploadId,
        key,
        partSize: normalizedPartSize,
        publicUrl,
        storageBucket: validatedData.storageBucket,
        contentType: uploadContentType,
      })
    }

    const uploadUrl = await getSignedUploadUrl(key, uploadContentType, 900, validatedData.storageBucket)

    return NextResponse.json({
      multipart: false,
      uploadUrl,
      publicUrl,
      key,
      storageBucket: validatedData.storageBucket,
      contentType: uploadContentType,
    })
  } catch (error) {
    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }
    return NextResponse.json({ error: "Failed to generate upload URL" }, { status: 500 })
  }
}
