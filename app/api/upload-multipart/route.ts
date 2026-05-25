import { Readable } from "stream"
import type { ReadableStream as WebReadableStream } from "stream/web"
import { type NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { getUserFromRequest } from "@/lib/auth"
import { canManageVideos } from "@/lib/roles"
import {
  getSignedUploadPartUrl,
  completeMultipartUpload,
  abortMultipartUpload,
  isUploadKeyAllowed,
  uploadMultipartPartToR2,
} from "@/lib/r2"

export const runtime = "nodejs"

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

const uploadMultipartPartProxySchema = z.object({
  key: z.string().min(1),
  uploadId: z.string().min(1),
  partNumber: z.coerce.number().int().min(1).max(10000),
  storageBucket: z.enum(["media", "jav"]).optional().default("media"),
})

const authorizeUploadRequest = async (request: NextRequest) => {
  const user = await getUserFromRequest(request)
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  if (!canManageVideos(user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  return null
}

export async function POST(request: NextRequest) {
  try {
    const authError = await authorizeUploadRequest(request)
    if (authError) return authError

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

export async function PUT(request: NextRequest) {
  try {
    const authError = await authorizeUploadRequest(request)
    if (authError) return authError

    const validatedData = uploadMultipartPartProxySchema.parse(
      Object.fromEntries(request.nextUrl.searchParams.entries()),
    )
    if (!isUploadKeyAllowed(validatedData.key, validatedData.storageBucket)) {
      return NextResponse.json({ error: "Invalid upload key" }, { status: 400 })
    }

    if (!request.body) {
      return NextResponse.json({ error: "Missing upload body" }, { status: 400 })
    }

    const etag = await uploadMultipartPartToR2(
      Readable.fromWeb(request.body as unknown as WebReadableStream),
      validatedData.key,
      validatedData.uploadId,
      validatedData.partNumber,
      validatedData.storageBucket,
    )

    return NextResponse.json(
      { ETag: etag },
      {
        headers: {
          ETag: etag,
        },
      },
    )
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid multipart upload part request" }, { status: 400 })
    }
    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }
    return NextResponse.json({ error: "Failed to upload multipart part" }, { status: 500 })
  }
}
