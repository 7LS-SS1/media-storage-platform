import { type NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { getUserFromRequest } from "@/lib/auth"
import { generateUploadKey, getPublicR2Url, getSignedUploadUrl } from "@/lib/r2"

const MAX_FILE_SIZE = 5000 * 1024 * 1024 // 5000MB
const ALLOWED_VIDEO_TYPES = ["video/mp4", "video/webm", "video/quicktime", "video/x-msvideo", "video/mp2t"]
const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"]

const uploadUrlSchema = z.object({
  filename: z.string().min(1),
  contentType: z.string().optional().default(""),
  size: z.number().int().positive(),
  type: z.enum(["video", "thumbnail"]),
})

export async function POST(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request)
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    if (!["ADMIN", "EDITOR"].includes(user.role)) {
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

    const key = generateUploadKey(validatedData.filename, validatedData.type)
    const uploadUrl = await getSignedUploadUrl(key, uploadContentType)
    const publicUrl = getPublicR2Url(key)

    return NextResponse.json({
      uploadUrl,
      publicUrl,
      key,
      contentType: uploadContentType,
    })
  } catch (error) {
    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }
    return NextResponse.json({ error: "Failed to generate upload URL" }, { status: 500 })
  }
}
