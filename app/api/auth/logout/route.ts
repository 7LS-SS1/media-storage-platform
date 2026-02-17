import { type NextRequest, NextResponse } from "next/server"
import { shouldUseSecureCookies } from "@/lib/cookie-security"

export async function POST(request: NextRequest) {
  const secureCookie = shouldUseSecureCookies(request)
  const response = NextResponse.json({ message: "Logged out" }, { status: 200 })
  response.cookies.set("token", "", {
    httpOnly: true,
    secure: secureCookie,
    sameSite: "lax",
    maxAge: 0,
    path: "/",
  })
  return response
}
