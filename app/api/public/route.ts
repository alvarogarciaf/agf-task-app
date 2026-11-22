import { NextRequest, NextResponse } from "next/server"
import { verifyIdToken } from "@/lib/firebase/admin-rest"
import { isSafeId, setPublicPageState } from "@/lib/public-pages.server"

export const dynamic = "force-dynamic"

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get("authorization") || ""
  if (!authHeader.startsWith("Bearer ")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const idToken = authHeader.slice(7).trim()
  if (!idToken) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  let uid: string
  try {
    const decoded = await verifyIdToken(idToken)
    uid = decoded.uid
  } catch {
    return NextResponse.json({ error: "Invalid token" }, { status: 401 })
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 })
  }

  const { taskId, isPublic, publicId } = body as {
    taskId?: unknown
    isPublic?: unknown
    publicId?: unknown
  }

  if (!isSafeId(taskId) || typeof isPublic !== "boolean") {
    return NextResponse.json(
      { error: "taskId (safe string) and isPublic (boolean) are required" },
      { status: 400 },
    )
  }

  if (publicId !== undefined && publicId !== null && !isSafeId(publicId)) {
    return NextResponse.json({ error: "Invalid publicId" }, { status: 400 })
  }

  try {
    const result = await setPublicPageState({
      uid,
      taskId,
      isPublic,
      publicId: typeof publicId === "string" ? publicId : null,
    })
    return NextResponse.json({ ok: true, ...result })
  } catch (err: any) {
    console.error("[API /api/public] Failed to update public page:", err)
    return NextResponse.json(
      { error: "Failed to update public page state" },
      { status: 500 },
    )
  }
}
