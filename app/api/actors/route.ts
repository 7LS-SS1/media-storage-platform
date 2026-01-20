import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

// GET - List all actors
export async function GET() {
  try {
    const actors = await prisma.actor.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    })

    return NextResponse.json({ actors })
  } catch (error) {
    return NextResponse.json({ error: "Failed to fetch actors" }, { status: 500 })
  }
}
