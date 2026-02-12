import { type NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { getUserFromRequest } from "@/lib/auth"
import { canManageVideos } from "@/lib/roles"
import {
  getSignedUploadPartUrl,
  completeMultipartUpload,
  abortMultipartUpload,
} from "@/lib/r2"

const uploadMultipartSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("part"),
    key: z.string().min(1),
    uploadId: z.string().min(1),
    partNumber: z.coerce.number().int().min(1).max(10000),
    storageBucket: z.enum(["media", "jav"]).optional().default("media"),
  }),
  z.object({
    action: z.literal("complete"),
    key: z.string().min(1),
    uploadId: z.string().min(1),
    parts: z
      .array(
        z.object({
          ETag: z.string().min(1),
          PartNumber: z.coerce.number().int().min(1),
        }),
      )
      .min(1),
    storageBucket: z.enum(["media", "jav"]).optional().default("media"),
  }),
  z.object({
    action: z.literal("abort"),
    key: z.string().min(1),
    uploadId: z.string().min(1),
    storageBucket: z.enum(["media", "jav"]).optional().default("media"),
  }),
])

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
    const validatedData = uploadMultipartSchema.parse(body)

    if (validatedData.action === "part") {
      const uploadUrl = await getSignedUploadPartUrl(
        validatedData.key,
        validatedData.uploadId,
        validatedData.partNumber,
        900,
        validatedData.storageBucket,
      )
      return NextResponse.json({ uploadUrl })
    }

    if (validatedData.action === "complete") {
      await completeMultipartUpload(
        validatedData.key,
        validatedData.uploadId,
        validatedData.parts,
        validatedData.storageBucket,
      )
      return NextResponse.json({ success: true })
    }

    await abortMultipartUpload(
      validatedData.key,
      validatedData.uploadId,
      validatedData.storageBucket,
    )
    return NextResponse.json({ success: true })
  } catch (error) {
    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }
    return NextResponse.json({ error: "Failed to process multipart upload" }, { status: 500 })
  }
}
