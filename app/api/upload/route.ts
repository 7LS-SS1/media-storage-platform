import { type NextRequest, NextResponse } from "next/server"
import { getUserFromRequest } from "@/lib/auth"
import { canManageVideos } from "@/lib/roles"
import { generateUploadKey, uploadToR2 } from "@/lib/r2"

const MAX_FILE_SIZE = 20 * 1024 * 1024 * 1024 // 20GB
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

export async function POST(request: NextRequest) {
  try {
    // Check authentication
    const user = await getUserFromRequest(request)
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Check role permission
    if (!canManageVideos(user.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const formData = await request.formData()
    const file = formData.get("file") as File
    const type = formData.get("type") as string // 'video' or 'thumbnail'
    const storageBucket = (formData.get("storageBucket") as string) || "media"

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 })
    }

    // Validate file type
    const allowedTypes = type === "thumbnail" ? ALLOWED_IMAGE_TYPES : ALLOWED_VIDEO_TYPES
    const normalizedType = file.type?.toLowerCase() ?? ""
    let uploadContentType = normalizedType
    const isTsFile = type === "video" && file.name.toLowerCase().endsWith(".ts")

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

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: `File too large. Maximum size: ${MAX_FILE_SIZE / 1024 / 1024}MB` },
        { status: 400 },
      )
    }

    // Convert file to buffer
    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)

    if (!["media", "jav"].includes(storageBucket)) {
      return NextResponse.json({ error: "Invalid storage bucket" }, { status: 400 })
    }

    // Generate unique filename
    const filename = generateUploadKey(
      file.name,
      type === "thumbnail" ? "thumbnail" : "video",
      storageBucket as "media" | "jav",
    )

    // Upload to R2
    const url = await uploadToR2(buffer, filename, uploadContentType, storageBucket as "media" | "jav")

    return NextResponse.json(
      {
        message: "File uploaded successfully",
        url,
        filename,
        size: file.size,
        type: uploadContentType,
        storageBucket,
      },
      { status: 200 },
    )
  } catch (error) {
    console.error("Upload error:", error)
    return NextResponse.json({ error: "Upload failed" }, { status: 500 })
  }
}
