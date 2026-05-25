import { Readable } from "stream"
import type { ReadableStream as WebReadableStream } from "stream/web"
import { type NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { getUserFromRequest } from "@/lib/auth"
import { canManageVideos } from "@/lib/roles"
import { getPublicR2Url, isUploadKeyAllowed, uploadBodyToR2 } from "@/lib/r2"

export const runtime = "nodejs"

const uploadProxySchema = z.object({
  key: z.string().min(1),
  contentType: z.string().trim().min(1).optional(),
  storageBucket: z.enum(["media", "jav"]).optional().default("media"),
})

export async function PUT(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request)
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    if (!canManageVideos(user.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const validatedData = uploadProxySchema.parse(Object.fromEntries(request.nextUrl.searchParams.entries()))
    if (!isUploadKeyAllowed(validatedData.key, validatedData.storageBucket)) {
      return NextResponse.json({ error: "Invalid upload key" }, { status: 400 })
    }

    if (!request.body) {
      return NextResponse.json({ error: "Missing upload body" }, { status: 400 })
    }

    const contentType =
      validatedData.contentType?.trim() || request.headers.get("content-type")?.trim() || "application/octet-stream"

    await uploadBodyToR2(
      Readable.fromWeb(request.body as unknown as WebReadableStream),
      validatedData.key,
      contentType,
      validatedData.storageBucket,
    )

    return NextResponse.json({
      success: true,
      url: getPublicR2Url(validatedData.key, validatedData.storageBucket),
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid upload proxy request" }, { status: 400 })
    }
    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }
    return NextResponse.json({ error: "Upload proxy failed" }, { status: 500 })
  }
}
