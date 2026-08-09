import { NextResponse } from "next/server"

function decodeHtmlEntities(text: string): string {
  const entities: Record<string, string> = {
    '&amp;': '&',
    '&lt;': '<',
    '&gt;': '>',
    '&quot;': '"',
    '&#39;': "'"
  }
  return text.replace(/&amp;|&lt;|&gt;|&quot;|&#39;/g, match => entities[match] || match)
}

function extractMetaTag(html: string, property: string): string | null {
  const regex1 = new RegExp(`<meta\\s+(?:[^>]*?\\s+)?(?:property|name)=["']${property}["']\\s+(?:[^>]*?\\s+)?content=["']([^"']+)["'][^>]*>`, "i")
  const regex2 = new RegExp(`<meta\\s+(?:[^>]*?\\s+)?content=["']([^"']+)["']\\s+(?:[^>]*?\\s+)?(?:property|name)=["']${property}["'][^>]*>`, "i")
  const match = html.match(regex1) || html.match(regex2)
  return match ? decodeHtmlEntities(match[1].trim()) : null
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const url = searchParams.get("url")

  if (!url) {
    return NextResponse.json({ error: "URL is required" }, { status: 400 })
  }

  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8"
      },
      signal: AbortSignal.timeout(5000)
    })
    
    if (!res.ok) {
      return NextResponse.json({ error: "Failed to fetch URL" }, { status: 400 })
    }

    const html = await res.text()

    let title = extractMetaTag(html, "og:title")
    if (!title) {
      const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i)
      title = titleMatch ? decodeHtmlEntities(titleMatch[1].trim()) : ""
    }
    
    let imageUrl = extractMetaTag(html, "og:image")
    let description = extractMetaTag(html, "og:description") || extractMetaTag(html, "description") || ""

    const urlObj = new URL(url)
    const domain = urlObj.hostname.replace(/^www\./, "")

    return NextResponse.json({
      title: title || domain,
      description,
      domain,
      imageUrl: imageUrl ? new URL(imageUrl, url).href : "", 
      url
    })
  } catch (error) {
    console.error("Link preview error:", error)
    return NextResponse.json({ error: "Failed to parse link preview" }, { status: 500 })
  }
}
