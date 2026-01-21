import { type NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { getUserFromRequest, hashPassword } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { canManageUsers, isAdmin, isStaff, isSystem } from "@/lib/roles"

const roleSchema = z.enum(["SYSTEM", "ADMIN", "STAFF", "EDITOR", "VIEWER"])

const createUserSchema = z.object({
  email: z.string().email(),
  name: z.string().min(2).max(100).optional(),
  password: z.string().min(6).max(200),
  role: roleSchema.default("STAFF"),
})

export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request)
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    if (!canManageUsers(user.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const where = isSystem(user.role)
      ? {}
      : {
          role: {
            in: ["STAFF", "EDITOR"],
          },
        }

    const users = await prisma.user.findMany({
      where,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        createdAt: true,
        updatedAt: true,
      },
    })

    return NextResponse.json({ users })
  } catch (error) {
    return NextResponse.json({ error: "Failed to fetch users" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request)
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    if (!canManageUsers(user.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const body = await request.json().catch(() => ({}))
    const validatedData = createUserSchema.parse(body)

    if (isAdmin(user.role) && !isSystem(user.role) && !isStaff(validatedData.role)) {
      return NextResponse.json({ error: "Admin can only create staff users" }, { status: 403 })
    }

    const normalizedEmail = validatedData.email.trim().toLowerCase()

    const existingUser = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    })

    if (existingUser) {
      return NextResponse.json({ error: "User with this email already exists" }, { status: 400 })
    }

    const hashedPassword = await hashPassword(validatedData.password)

    const createdUser = await prisma.user.create({
      data: {
        email: normalizedEmail,
        name: validatedData.name?.trim() || undefined,
        password: hashedPassword,
        role: validatedData.role,
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        createdAt: true,
        updatedAt: true,
      },
    })

    return NextResponse.json({ user: createdUser }, { status: 201 })
  } catch (error) {
    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }
    return NextResponse.json({ error: "Failed to create user" }, { status: 500 })
  }
}
