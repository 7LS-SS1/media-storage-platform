import { type NextRequest, NextResponse } from "next/server"
import { getUserFromRequest } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

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
