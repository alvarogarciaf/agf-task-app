import type { Metadata } from "next"
import {
  PublicPageNotFound,
  PublicPageView,
} from "@/components/public-page-view"
import { markdownToPlainText } from "@/lib/markdown"
import { getPublicPageBySlug } from "@/lib/public-pages.server"

export const dynamic = "force-dynamic"

type PublicPageProps = {
  params: Promise<{ slug: string }>
}

export async function generateMetadata({
  params,
}: PublicPageProps): Promise<Metadata> {
  const { slug } = await params
  const page = await getPublicPageBySlug(slug).catch(() => null)

  if (!page) {
    return {
      title: "Page Not Found · TASKER AGF",
      robots: { index: false, follow: false },
    }
  }

  const title =
    page.description.trim() || (page.type === "note" ? "Note" : "Task")
  const snippet = page.details
    ? markdownToPlainText(page.details).slice(0, 160)
    : ""
  const description = snippet || title

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: "article",
    },
    twitter: {
      card: "summary",
      title,
      description,
    },
    robots: { index: false, follow: false },
  }
}

export default async function PublicPage({ params }: PublicPageProps) {
  const { slug } = await params
  const page = await getPublicPageBySlug(slug)

  if (!page) {
    return <PublicPageNotFound />
  }

  return <PublicPageView page={page} />
}
