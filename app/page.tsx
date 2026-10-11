import type { Metadata } from "next"
import PageClient from "@/components/page-client"

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
      description: "",
      openGraph: {
        title: cleanTitle,
        description: "",
        siteName: "TASKER AGF",
      },
      twitter: {
        card: "summary",
        title: cleanTitle,
        description: "",
      },
    }
  }

  return {
    title: "TASKER AGF",
  }
}

export default function Page() {
  return <PageClient />
}
