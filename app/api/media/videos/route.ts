import { NextRequest } from "next/server"
import { GET as baseGET, POST as basePOST } from "@/app/api/videos/route"

const STORAGE_BUCKET = "media"

const withStorageBucket = (request: NextRequest) => {
  const url = new URL(request.url)
  url.searchParams.set("storageBucket", STORAGE_BUCKET)
  return url
}

export async function GET(request: NextRequest) {
  const url = withStorageBucket(request)
  const nextRequest = new NextRequest(url, { headers: request.headers })
  return baseGET(nextRequest)
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}))
  const nextRequest = new NextRequest(request.url, {
    method: "POST",
    headers: request.headers,
    body: JSON.stringify({ ...body, storageBucket: STORAGE_BUCKET }),
  })
  return basePOST(nextRequest)
}
