import { type NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { getUserFromRequest, hashPassword } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { canManageUsers, isAdmin, isStaff, isSystem } from "@/lib/roles"

const roleSchema = z.enum(["SYSTEM", "ADMIN", "STAFF", "EDITOR", "VIEWER"])

const updateUserSchema = z
  .object({
    email: z.string().email().optional(),
    name: z.string().min(2).max(100).optional(),
    password: z.string().min(6).max(200).optional(),
    role: roleSchema.optional(),
  })
  .refine((data) => data.email || data.name || data.password || data.role, {
    message: "No fields to update",
  })

export async function PATCH(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params
  try {
    const user = await getUserFromRequest(request)
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    if (!canManageUsers(user.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const targetUser = await prisma.user.findUnique({
      where: { id: params.id },
      select: { id: true, email: true, role: true },
    })

    if (!targetUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }

    const body = await request.json().catch(() => ({}))
    const validatedData = updateUserSchema.parse(body)

    if (isAdmin(user.role) && !isSystem(user.role)) {
      if (!isStaff(targetUser.role)) {
        return NextResponse.json({ error: "Admin can only update staff users" }, { status: 403 })
      }
      if (validatedData.role && !isStaff(validatedData.role)) {
        return NextResponse.json({ error: "Admin can only assign staff role" }, { status: 403 })
      }
    }

    const normalizedEmail = validatedData.email?.trim().toLowerCase()

    if (normalizedEmail) {
      const existingUser = await prisma.user.findUnique({
        where: { email: normalizedEmail },
        select: { id: true },
      })
      if (existingUser && existingUser.id !== targetUser.id) {
        return NextResponse.json({ error: "User with this email already exists" }, { status: 400 })
      }
    }

    const updateData: {
      email?: string
      name?: string
      password?: string
      role?: string
    } = {}

    if (normalizedEmail) updateData.email = normalizedEmail
    if (validatedData.name) updateData.name = validatedData.name.trim()
    if (validatedData.role) updateData.role = validatedData.role
    if (validatedData.password) updateData.password = await hashPassword(validatedData.password)

    const updatedUser = await prisma.user.update({
      where: { id: params.id },
      data: updateData,
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        createdAt: true,
        updatedAt: true,
      },
    })

    return NextResponse.json({ user: updatedUser })
  } catch (error) {
    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }
    return NextResponse.json({ error: "Failed to update user" }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params
  try {
    const user = await getUserFromRequest(request)
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    if (!canManageUsers(user.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    if (user.userId === params.id) {
      return NextResponse.json({ error: "You cannot delete your own account" }, { status: 400 })
    }

    const targetUser = await prisma.user.findUnique({
      where: { id: params.id },
      select: { id: true, role: true },
    })

    if (!targetUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }

    if (isAdmin(user.role) && !isSystem(user.role) && !isStaff(targetUser.role)) {
      return NextResponse.json({ error: "Admin can only delete staff users" }, { status: 403 })
    }

    await prisma.user.delete({
      where: { id: params.id },
    })

    return NextResponse.json({ message: "User deleted successfully" })
  } catch (error) {
    return NextResponse.json({ error: "Failed to delete user" }, { status: 500 })
  }
}
