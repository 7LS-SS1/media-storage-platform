import { type NextRequest, NextResponse } from "next/server"
import { getUserFromRequest } from "@/lib/auth"
import { extractDomain, normalizeDomain } from "@/lib/domain-security"
import { prisma } from "@/lib/prisma"
import { createDomainSchema } from "@/lib/validation"
import { canManageDomains } from "@/lib/roles"

const normalizeDomainInput = (value: string): string => {
  if (value.startsWith("http://") || value.startsWith("https://")) {
    const extracted = extractDomain(value)
    if (!extracted) {
      throw new Error("Invalid domain URL")
    }
    return normalizeDomain(extracted)
  }
  return normalizeDomain(value)
}

// POST - Add allowed domain (Admin only)
export async function POST(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request)
    if (!user || !canManageDomains(user.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const body = await request.json()
    const validatedData = createDomainSchema.parse(body)

    const domain = normalizeDomainInput(validatedData.domain)

    const allowedDomain = await prisma.allowedDomain.create({
      data: { domain },
    })

    return NextResponse.json({ message: "Domain added", domain: allowedDomain }, { status: 201 })
  } catch (error) {
    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }
    return NextResponse.json({ error: "Failed to add domain" }, { status: 500 })
  }
}

// GET - List all domains
export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request)
    if (!user || !canManageDomains(user.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const domains = await prisma.allowedDomain.findMany({
      orderBy: { domain: "asc" },
    })

    return NextResponse.json({ domains })
  } catch (error) {
    return NextResponse.json({ error: "Failed to fetch domains" }, { status: 500 })
  }
}
