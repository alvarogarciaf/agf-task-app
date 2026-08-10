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
    let html = ""
    let fetchSuccess = false
    let title = ""
    let imageUrl = ""
    let description = ""
    let domain = new URL(url).hostname.replace(/^www\./, "")

    try {
      const res = await fetch(url, {
        headers: {
          // Spoof a known social media crawler (WhatsApp) so big sites like Google/Gemini 
          // serve us the pre-rendered SSR metadata instead of an empty JavaScript payload
          "User-Agent": "WhatsApp/2.21.12.21 A",
          "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8"
        },
        signal: AbortSignal.timeout(5000)
      })
      
      if (res.ok) {
        html = await res.text()
        fetchSuccess = true
      }
    } catch (e) {
      console.warn("Primary fetch failed, falling back to Microlink:", e)
    }

    if (fetchSuccess && html) {
      title = extractMetaTag(html, "og:title") || ""
      if (!title) {
        const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i)
        title = titleMatch ? decodeHtmlEntities(titleMatch[1].trim()) : ""
      }
      imageUrl = extractMetaTag(html, "og:image") || ""
      description = extractMetaTag(html, "og:description") || extractMetaTag(html, "description") || ""
      if (imageUrl) {
        try {
          imageUrl = new URL(imageUrl, url).href
        } catch (e) {}
      }
    }

    // Fallback to Microlink API if fetch failed or if we got a highly generic title (like Google Maps) with no image
    if (!fetchSuccess || (!title && !imageUrl) || title === "Google Maps") {
      try {
        const mlRes = await fetch(`https://api.microlink.io?url=${encodeURIComponent(url)}`, {
          signal: AbortSignal.timeout(5000)
        })
        if (mlRes.ok) {
          const mlData = await mlRes.json()
          if (mlData.status === "success" && mlData.data) {
            title = mlData.data.title || title
            description = mlData.data.description || description
            imageUrl = mlData.data.image?.url || imageUrl
            domain = mlData.data.publisher || domain
          }
        }
      } catch (e) {
        console.error("Microlink fallback failed:", e)
      }
    }

    if (!title && !fetchSuccess) {
      return NextResponse.json({ error: "Failed to parse link preview" }, { status: 400 })
    }

    return NextResponse.json({
      title: title || domain,
      description,
      domain,
      imageUrl,
      url
    })
  } catch (error) {
    console.error("Error generating link preview:", error)
    return NextResponse.json({ error: "Failed to generate link preview" }, { status: 500 })
  }
}
