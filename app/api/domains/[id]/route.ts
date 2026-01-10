import { type NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { getUserFromRequest } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { createDomainSchema } from "@/lib/validation"

const updateDomainSchema = z
  .object({
    domain: createDomainSchema.shape.domain.optional(),
    isActive: z.boolean().optional(),
  })
  .refine((data) => data.domain || data.isActive !== undefined, {
    message: "No fields to update",
  })

// PATCH - Update allowed domain
export async function PATCH(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params
  try {
    const user = await getUserFromRequest(request)
    if (!user || user.role !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const body = await request.json().catch(() => ({}))
    const validatedData = updateDomainSchema.parse(body)
    const updateData: { domain?: string; isActive?: boolean } = {}

    if (validatedData.domain) {
      let domain = validatedData.domain
      if (domain.startsWith("http://") || domain.startsWith("https://")) {
        domain = new URL(domain).hostname
      }
      updateData.domain = domain
    }

    if (typeof validatedData.isActive === "boolean") {
      updateData.isActive = validatedData.isActive
    }

    const updatedDomain = await prisma.allowedDomain.update({
      where: { id: params.id },
      data: updateData,
    })

    return NextResponse.json({ message: "Domain updated successfully", domain: updatedDomain })
  } catch (error) {
    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }
    return NextResponse.json({ error: "Failed to update domain" }, { status: 500 })
  }
}

// DELETE - Remove allowed domain
export async function DELETE(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params
  try {
    const user = await getUserFromRequest(request)
    if (!user || user.role !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    await prisma.allowedDomain.delete({
      where: { id: params.id },
    })

    return NextResponse.json({ message: "Domain removed successfully" })
  } catch (error) {
    return NextResponse.json({ error: "Failed to remove domain" }, { status: 500 })
  }
}
