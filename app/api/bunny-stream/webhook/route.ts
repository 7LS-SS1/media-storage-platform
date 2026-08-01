import { createHmac, timingSafeEqual } from "node:crypto"
import { type NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export async function POST(request: NextRequest) {
  const rawBody = await request.text()
  const signature = request.headers.get("x-bunnystream-signature") ?? ""
  const version = request.headers.get("x-bunnystream-signature-version")
  const algorithm = request.headers.get("x-bunnystream-signature-algorithm")
  const secret = process.env.BUNNY_STREAM_READ_ONLY_API_KEY?.trim()

  if (!secret || version !== "v1" || algorithm !== "hmac-sha256") {
    return NextResponse.json({ error: "Invalid signature metadata" }, { status: 401 })
  }
  const expected = createHmac("sha256", secret).update(rawBody, "utf8").digest("hex")
  const valid = /^[0-9a-f]{64}$/.test(signature) && timingSafeEqual(Buffer.from(signature), Buffer.from(expected))
  if (!valid) return NextResponse.json({ error: "Invalid signature" }, { status: 401 })

  const payload = JSON.parse(rawBody) as { VideoGuid?: string; Status?: number }
  if (!payload.VideoGuid || typeof payload.Status !== "number") {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 })
  }
  const status = payload.Status === 3 || payload.Status === 4
    ? "READY"
    : payload.Status === 5 || payload.Status === 8
      ? "FAILED"
      : "PROCESSING"
  await prisma.video.updateMany({
    where: { bunnyVideoId: payload.VideoGuid },
    data: { status, transcodeProgress: status === "READY" ? 100 : undefined },
  })
  return NextResponse.json({ received: true })
}
