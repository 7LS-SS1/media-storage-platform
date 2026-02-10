import { type NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { getUserFromRequest } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { isSystem } from "@/lib/roles"

const createStudioSchema = z.object({
  name: z.string().min(1).max(100),
})

// POST - Create studio (Admin only)
export async function POST(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request)
    if (!user || (user.role !== "ADMIN" && !isSystem(user.role))) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const body = await request.json()
    const validatedData = createStudioSchema.parse(body)

    const studio = await prisma.studio.create({
      data: {
        name: validatedData.name,
      },
    })

    return NextResponse.json({ message: "Studio created", studio }, { status: 201 })
  } catch (error) {
    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }
    return NextResponse.json({ error: "Failed to create studio" }, { status: 500 })
  }
}

// GET - List all studios
export async function GET() {
  try {
    const studios = await prisma.studio.findMany({
      orderBy: { name: "asc" },
    })

    return NextResponse.json({ studios })
  } catch (error) {
    return NextResponse.json({ error: "Failed to fetch studios" }, { status: 500 })
  }
}
