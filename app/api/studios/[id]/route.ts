import { type NextRequest, NextResponse } from "next/server"
import { getUserFromRequest } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { isSystem } from "@/lib/roles"

// DELETE - Remove studio (Admin only)
export async function DELETE(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params
  try {
    const user = await getUserFromRequest(request)
    if (!user || (user.role !== "ADMIN" && !isSystem(user.role))) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const studio = await prisma.studio.findUnique({
      where: { id: params.id },
    })

    if (!studio) {
      return NextResponse.json({ error: "Studio not found" }, { status: 404 })
    }

    await prisma.studio.delete({
      where: { id: params.id },
    })

    return NextResponse.json({ message: "Studio deleted" })
  } catch (error) {
    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }
    return NextResponse.json({ error: "Failed to delete studio" }, { status: 500 })
  }
}
