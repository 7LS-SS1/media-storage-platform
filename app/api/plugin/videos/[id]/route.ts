import { type NextRequest } from "next/server"
import { GET as baseGET, PUT as basePUT } from "@/app/api/videos/[id]/route"

export async function GET(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  return baseGET(request, props)
}

export async function PUT(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  return basePUT(request, props)
}
