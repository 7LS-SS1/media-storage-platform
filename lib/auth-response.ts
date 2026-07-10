import { type NextRequest, NextResponse } from "next/server"
import { getAuthFailureFromRequest } from "@/lib/auth"

export function unauthorizedResponse(request: NextRequest) {
  const failure = getAuthFailureFromRequest(request)
  if (!failure) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  return NextResponse.json(
    {
      error: failure.message,
      code: failure.code,
      domain: failure.domain,
      boundDomain: failure.boundDomain,
    },
    { status: failure.status },
  )
}
