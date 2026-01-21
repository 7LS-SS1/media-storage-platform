import { type NextRequest, NextResponse } from "next/server"
import { getUserFromRequest } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { z } from "zod"
import { isSystem } from "@/lib/roles"

const createCategorySchema = z.object({
  name: z.string().min(1).max(100),
  slug: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
})

// POST - Create category (Admin only)
export async function POST(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request)
    if (!user || (user.role !== "ADMIN" && !isSystem(user.role))) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const body = await request.json()
    const validatedData = createCategorySchema.parse(body)

    const category = await prisma.category.create({
      data: validatedData,
    })

    return NextResponse.json({ message: "Category created", category }, { status: 201 })
  } catch (error) {
    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }
    return NextResponse.json({ error: "Failed to create category" }, { status: 500 })
  }
}

// GET - List all categories
export async function GET() {
  try {
    const categories = await prisma.category.findMany({
      orderBy: { name: "asc" },
      include: {
        _count: {
          select: { videos: true },
        },
      },
    })

    return NextResponse.json({ categories })
  } catch (error) {
    return NextResponse.json({ error: "Failed to fetch categories" }, { status: 500 })
  }
}
