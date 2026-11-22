import type { Metadata } from "next"
import PageClient from "@/components/page-client"
import { markdownToPlainText } from "@/lib/markdown"
import { getPublicPageBySlug } from "@/lib/public-pages.server"

type PageProps = {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}

export async function generateMetadata({ searchParams }: PageProps): Promise<Metadata> {
  const params = await searchParams
  const titleParam = params.title || params.t
  const title = typeof titleParam === "string" ? titleParam : Array.isArray(titleParam) ? titleParam[0] : null

  if (title && title.trim()) {
    const cleanTitle = title.trim()
    return {
      title: cleanTitle,
      description: cleanTitle,
      openGraph: {
        title: cleanTitle,
        description: cleanTitle,
        siteName: cleanTitle,
      },
      twitter: {
        card: "summary",
        title: cleanTitle,
        description: cleanTitle,
      },
      appleWebApp: {
        capable: true,
        statusBarStyle: "black-translucent",
        title: cleanTitle,
      },
    }
  }

  const objParam = params.objectId || params.taskId || params.noteId
  const objId = typeof objParam === "string" ? objParam : Array.isArray(objParam) ? objParam[0] : null
  if (objId && objId.trim()) {
    const publicPage = await getPublicPageBySlug(objId.trim()).catch(() => null)
    if (publicPage) {
      const cleanTitle =
        publicPage.description.trim() ||
        (publicPage.type === "note" ? "Note" : "Task")
      const snippet = publicPage.details
        ? markdownToPlainText(publicPage.details).slice(0, 160)
        : ""
      const description = snippet || cleanTitle
      return {
        title: cleanTitle,
        description,
        openGraph: {
          title: cleanTitle,
          description,
          type: "article",
        },
        twitter: {
          card: "summary",
          title: cleanTitle,
          description,
        },
      }
    }
  }

  return {
    title: "TASKER AGF",
  }
}

export default function Page() {
  return <PageClient />
}
