import { type NextRequest } from "next/server"
import { GET as baseGET } from "@/app/api/videos/route"

export async function GET(request: NextRequest) {
  return baseGET(request)
}
