import { NextRequest, NextResponse } from "next/server"
import { getPublicPageBySlug } from "@/lib/public-pages.server"

export const dynamic = "force-dynamic"
export const revalidate = 0

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params
  const page = await getPublicPageBySlug(slug)

  if (!page) {
    return NextResponse.json(
      { error: "Not found" },
      { status: 404, headers: { "Cache-Control": "no-store" } },
    )
  }

  return NextResponse.json(page, {
    headers: { "Cache-Control": "no-store, max-age=0" },
  })
}
