import { NextResponse } from "next/server"

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const url = searchParams.get("url")

  if (!url) {
    return NextResponse.json({ error: "URL is required" }, { status: 400 })
  }

  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko)",
        "Accept": "image/webp,image/apng,image/*,*/*;q=0.8"
      },
      signal: AbortSignal.timeout(10000)
    })
    
    if (!res.ok) {
      return NextResponse.json({ error: "Failed to fetch image" }, { status: 400 })
    }

    const buffer = await res.arrayBuffer()
    const contentType = res.headers.get("content-type") || "image/jpeg"

    return new NextResponse(buffer, {
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=31536000, immutable"
      }
    })
  } catch (error) {
    console.error("Proxy image error:", error)
    return NextResponse.json({ error: "Failed to proxy image" }, { status: 500 })
  }
}
