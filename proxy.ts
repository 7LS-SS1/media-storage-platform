import { type NextRequest, NextResponse } from "next/server"
import { getUserFromRequest } from "@/lib/auth"

// Define protected routes and their required roles
const protectedRoutes: Record<string, string[]> = {
  "/api/videos": ["SYSTEM", "ADMIN", "STAFF", "EDITOR", "VIEWER"],
  "/api/categories": ["SYSTEM", "ADMIN"],
  "/api/domains": ["SYSTEM", "ADMIN"],
}

// Routes that require authentication but allow all roles
const authRequiredRoutes = ["/dashboard", "/videos/upload"]

// Admin-only routes
const adminOnlyRoutes = ["/admin"]

// Editor and above routes
const editorRoutes = ["/videos/new", "/videos/edit"]

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Check if route requires authentication
  const isProtectedApiRoute = Object.keys(protectedRoutes).some((route) => pathname.startsWith(route))
  const isAuthRequiredRoute = authRequiredRoutes.some((route) => pathname.startsWith(route))
  const isAdminOnlyRoute = adminOnlyRoutes.some((route) => pathname.startsWith(route))
  const isEditorRoute = editorRoutes.some((route) => pathname.startsWith(route))

  // Skip authentication for public routes
  if (!isProtectedApiRoute && !isAuthRequiredRoute && !isAdminOnlyRoute && !isEditorRoute) {
    return NextResponse.next()
  }

  // Get user from request
  const user = await getUserFromRequest(request)

  // Check if user is authenticated
  if (!user) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    // Redirect to login for page routes
    return NextResponse.redirect(new URL("/login", request.url))
  }

  // Check role-based access for API routes
  if (isProtectedApiRoute) {
    for (const [route, allowedRoles] of Object.entries(protectedRoutes)) {
      if (pathname.startsWith(route)) {
        // For POST, PUT, DELETE on videos - require ADMIN or EDITOR
        if (route === "/api/videos" && ["POST", "PUT", "DELETE"].includes(request.method)) {
          if (!["SYSTEM", "ADMIN", "STAFF", "EDITOR"].includes(user.role)) {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 })
          }
        }
        // For categories and domains - require roles specified
        else if (!allowedRoles.includes(user.role)) {
          return NextResponse.json({ error: "Forbidden" }, { status: 403 })
        }
      }
    }
  }

  // Check admin-only page routes
  if (isAdminOnlyRoute && !["SYSTEM", "ADMIN"].includes(user.role)) {
    return NextResponse.redirect(new URL("/", request.url))
  }

  // Check editor routes
  if (isEditorRoute && !["SYSTEM", "ADMIN", "STAFF", "EDITOR"].includes(user.role)) {
    return NextResponse.redirect(new URL("/", request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    "/api/:path*",
    "/dashboard/:path*",
    "/admin/:path*",
    "/videos/upload/:path*",
    "/videos/new/:path*",
    "/videos/edit/:path*",
  ],
}
