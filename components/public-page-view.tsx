"use client"

import React, { useMemo, useState } from "react"
import {
  Calendar,
  Check,
  Circle,
  CircleCheck,
  FileText,
  Globe,
  Link as LinkIcon,
  Lock,
  Share2,
} from "lucide-react"
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog"
import { PublicListView } from "@/components/public-list-view"
import { ICONS } from "@/lib/constants"
import { getSafeHref } from "@/lib/list-field-utils"
import { parseImageDimensions } from "@/lib/markdown"
import {
  buildPublicPageUrl,
  copyTextToClipboard,
} from "@/lib/public-pages-client"
import { cn } from "@/lib/utils"
import type {
  PublicEmbeddedTask,
  PublicPageData,
} from "@/lib/public-page-types"
import { toast } from "sonner"

const TASK_RE = /^[-*]\s+\[([ xX])\]\s?(.*)$/

function isSafeImageSrc(raw: string | null | undefined): string | null {
  const trimmed = (raw ?? "").trim()
  if (!trimmed) return null
  if (trimmed.startsWith("/") && !trimmed.startsWith("//")) {
    return trimmed
  }
  return getSafeHref(trimmed)
}

function isBlockLine(trimmed: string): boolean {
  return (
    trimmed === "" ||
    TASK_RE.test(trimmed) ||
    trimmed === "#" ||
    trimmed === "##" ||
    trimmed === "###" ||
    trimmed.startsWith("# ") ||
    trimmed.startsWith("## ") ||
    trimmed.startsWith("### ") ||
    trimmed.startsWith("* ") ||
    trimmed.startsWith("- ") ||
    trimmed.startsWith("• ") ||
    trimmed === "---"
  )
}

function formatReadableDate(raw: string | null | undefined): string | null {
  if (!raw) return null
  const dateOnly = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  const dt = dateOnly
    ? new Date(Number(dateOnly[1]), Number(dateOnly[2]) - 1, Number(dateOnly[3]))
    : new Date(raw)
  if (Number.isNaN(dt.getTime())) return raw
  return dt.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  })
}

type InlineSegment =
  | { type: "text"; content: string }
  | { type: "task"; id: string }
  | { type: "image"; alt: string; dimSpec?: string; url: string }
  | { type: "card"; title: string; domain: string; image: string; url: string }
  | { type: "link"; label: string; url: string }
  | { type: "code"; content: string }
  | { type: "bold"; content: string }
  | { type: "italic"; content: string }

function splitByRegex(
  segments: InlineSegment[],
  regex: RegExp,
  onMatch: (match: RegExpExecArray) => InlineSegment,
): InlineSegment[] {
  return segments.flatMap((seg) => {
    if (seg.type !== "text") return [seg]
    const out: InlineSegment[] = []
    let lastIndex = 0
    let m: RegExpExecArray | null
    regex.lastIndex = 0
    while ((m = regex.exec(seg.content)) !== null) {
      if (m.index > lastIndex) {
        out.push({ type: "text", content: seg.content.slice(lastIndex, m.index) })
      }
      out.push(onMatch(m))
      lastIndex = regex.lastIndex
    }
    if (lastIndex < seg.content.length) {
      out.push({ type: "text", content: seg.content.slice(lastIndex) })
    }
    return out
  })
}

function PublicEmbeddedTaskCard({ task }: { task?: PublicEmbeddedTask }) {
  if (!task) {
    return (
      <div className="my-2 flex items-center gap-2 rounded-xl border border-border/50 bg-muted/20 px-3.5 py-2.5 text-xs text-muted-foreground">
        <Lock className="h-3.5 w-3.5 shrink-0 opacity-60" />
        <span>Referenced item is private or unavailable</span>
      </div>
    )
  }

  const isNote = task.type === "note"
  const isDone = task.status === "Done"
  const NoteIcon =
    (task.icon && ICONS[task.icon]) || FileText

  return (
    <div
      className={cn(
        "relative my-2 flex min-h-[46px] items-center gap-3 rounded-xl border border-border/80 bg-card py-2 pr-3 pl-4 shadow-sm",
        isDone && "bg-muted/20 opacity-65",
      )}
    >
      {!isNote && task.urgency && !isDone && (
        <div
          className="absolute top-0 bottom-0 left-0 w-[3.5px] rounded-l-xl"
          style={{ backgroundColor: task.urgency.color }}
        />
      )}

      {isNote ? (
        <NoteIcon
          className="h-4 w-4 shrink-0 text-muted-foreground"
          style={task.color ? { color: task.color } : undefined}
        />
      ) : (
        <div
          className={cn(
            "flex h-4.5 w-4.5 shrink-0 items-center justify-center rounded-full border-2",
            isDone
              ? "border-primary bg-primary text-primary-foreground"
              : "border-muted-foreground/60 bg-muted/20",
          )}
        >
          {isDone && <Check className="h-3 w-3 stroke-[3]" />}
        </div>
      )}

      <span
        className={cn(
          "min-w-0 flex-1 truncate text-sm font-medium leading-tight",
          !isNote && isDone ? "text-muted-foreground line-through" : "text-foreground",
        )}
      >
        {task.description}
      </span>

      {!isNote && task.urgency && !isDone && (
        <span
          className="hidden rounded-md px-1.5 py-0.5 font-mono text-xs font-semibold uppercase tracking-wider sm:inline-block"
          style={{
            backgroundColor: `color-mix(in oklch, ${task.urgency.color} 12%, transparent)`,
            color: task.urgency.color,
          }}
        >
          {task.urgency.name}
        </span>
      )}
    </div>
  )
}

function PublicMarkdownBody({
  markdown,
  embeddedTasks,
  onImageClick,
}: {
  markdown: string | null
  embeddedTasks: Record<string, PublicEmbeddedTask>
  onImageClick: (url: string, alt?: string) => void
}) {
  const rendered = useMemo(() => {
    if (!markdown || !markdown.trim()) return null
    const lines = markdown.split("\n")
    const elements: React.ReactNode[] = []
    let currentList: React.ReactNode[] = []

    const flushList = (keyPrefix: string) => {
      if (currentList.length > 0) {
        elements.push(
          <ul
            key={`ul-${keyPrefix}`}
            className="mb-4 list-disc space-y-1.5 pl-6 font-sans text-[15px] text-foreground/90"
          >
            {currentList}
          </ul>,
        )
        currentList = []
      }
    }

    const parseInline = (text: string): React.ReactNode[] => {
      let segments: InlineSegment[] = [{ type: "text", content: text }]

      segments = splitByRegex(
        segments,
        /\[task:([a-zA-Z0-9-]+)\]/g,
        (m) => ({ type: "task", id: m[1] }),
      )

      segments = splitByRegex(
        segments,
        /!\[([^|\]]*)(?:\|([^\]]+))?\]\(([^)]+)\)/g,
        (m) => ({ type: "image", alt: m[1], dimSpec: m[2], url: m[3] }),
      )

      segments = splitByRegex(
        segments,
        /\[card:([^|\]]*)\|([^|\]]*)\|([^\]]*)\]\(([^)]+)\)/g,
        (m) => ({
          type: "card",
          title: m[1],
          domain: m[2],
          image: m[3],
          url: m[4],
        }),
      )

      segments = splitByRegex(
        segments,
        /\[([^\]]+)\]\(([^)]+)\)/g,
        (m) => ({ type: "link", label: m[1], url: m[2] }),
      )

      segments = splitByRegex(
        segments,
        /`([^`]+)`/g,
        (m) => ({ type: "code", content: m[1] }),
      )

      segments = splitByRegex(
        segments,
        /(\*\*|__)(.+?)\1/g,
        (m) => ({ type: "bold", content: m[2] }),
      )

      segments = splitByRegex(
        segments,
        /(\*|_)([^*_]+?)\1/g,
        (m) => ({ type: "italic", content: m[2] }),
      )

      return segments.map((seg, idx) => {
        if (seg.type === "task") {
          return (
            <PublicEmbeddedTaskCard
              key={idx}
              task={embeddedTasks[seg.id]}
            />
          )
        }
        if (seg.type === "image") {
          const safeSrc = isSafeImageSrc(seg.url)
          if (!safeSrc) return null
          const { style, align } = parseImageDimensions(seg.dimSpec)
          const styleObj = style
            ? Object.fromEntries(
                style
                  .split(";")
                  .filter(Boolean)
                  .map((s) => {
                    const colonIdx = s.indexOf(":")
                    return [
                      s.slice(0, colonIdx).trim(),
                      s.slice(colonIdx + 1).trim(),
                    ]
                  }),
              )
            : undefined
          return (
            <span
              key={idx}
              className={cn(
                "my-2 inline-block max-w-full align-bottom",
                align === "center" && "block mx-auto",
                align === "right" && "block ml-auto",
              )}
              style={styleObj}
            >
              <button
                type="button"
                onClick={() => onImageClick(safeSrc, seg.alt)}
                className="block w-full cursor-zoom-in overflow-hidden rounded-lg border border-border/40"
              >
                <img
                  src={safeSrc}
                  alt={seg.alt}
                  className="block h-auto w-full rounded-lg object-contain"
                />
              </button>
            </span>
          )
        }
        if (seg.type === "card") {
          const safeHref = getSafeHref(seg.url)
          const safeCardImg = isSafeImageSrc(seg.image)
          if (!safeHref) {
            return (
              <span key={idx} className="text-sm text-foreground">
                {seg.title || seg.url}
              </span>
            )
          }
          return (
            <span
              key={idx}
              className="my-2 inline-flex max-w-sm items-center overflow-hidden rounded-lg border border-border/60 bg-muted/30 align-middle"
            >
              <a
                href={safeHref}
                target="_blank"
                rel="noopener noreferrer"
                className="flex min-w-0 flex-1 items-center gap-3 text-foreground transition-colors hover:bg-muted/50"
              >
                {safeCardImg ? (
                  <img
                    src={safeCardImg}
                    alt=""
                    className="h-16 w-16 shrink-0 rounded-l-lg bg-muted object-cover"
                    onError={(e) => {
                      e.currentTarget.style.display = "none"
                    }}
                  />
                ) : (
                  <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-l-lg bg-muted text-muted-foreground">
                    <LinkIcon className="h-5 w-5" />
                  </span>
                )}
                <span className="flex min-w-0 flex-col py-2 pr-3 text-left">
                  <span className="truncate text-sm font-semibold leading-tight">
                    {seg.title || seg.url}
                  </span>
                  {seg.domain && (
                    <span className="mt-0.5 truncate text-xs leading-tight text-muted-foreground">
                      {seg.domain}
                    </span>
                  )}
                </span>
              </a>
            </span>
          )
        }
        if (seg.type === "link") {
          const safeHref = getSafeHref(seg.url)
          if (!safeHref) return <React.Fragment key={idx}>{seg.label}</React.Fragment>
          return (
            <a
              key={idx}
              href={safeHref}
              target="_blank"
              rel="noopener noreferrer"
              className="font-semibold text-primary hover:underline"
            >
              {seg.label}
            </a>
          )
        }
        if (seg.type === "code") {
          return (
            <code
              key={idx}
              className="rounded bg-muted px-1.5 py-0.5 font-mono text-[0.85em] text-foreground"
            >
              {seg.content}
            </code>
          )
        }
        if (seg.type === "bold") {
          return (
            <strong key={idx} className="font-bold text-foreground">
              {seg.content}
            </strong>
          )
        }
        if (seg.type === "italic") {
          return (
            <em key={idx} className="italic text-foreground/90">
              {seg.content}
            </em>
          )
        }
        return <React.Fragment key={idx}>{seg.content}</React.Fragment>
      })
    }

    let i = 0
    while (i < lines.length) {
      const raw = lines[i]
      const trimmed = raw.trim()
      const taskMatch = trimmed.match(TASK_RE)

      if (trimmed === "#" || trimmed.startsWith("# ")) {
        flushList(String(i))
        const content = trimmed === "#" ? "" : trimmed.slice(2)
        elements.push(
          <h1
            key={i}
            className="mt-6 mb-2 border-b border-border/40 pb-1 font-sans text-xl font-bold text-foreground"
          >
            {content ? parseInline(content) : <br />}
          </h1>,
        )
        i++
      } else if (trimmed === "##" || trimmed.startsWith("## ")) {
        flushList(String(i))
        const content = trimmed === "##" ? "" : trimmed.slice(3)
        elements.push(
          <h2
            key={i}
            className="mt-5 mb-2 font-sans text-lg font-semibold text-foreground"
          >
            {content ? parseInline(content) : <br />}
          </h2>,
        )
        i++
      } else if (trimmed === "###" || trimmed.startsWith("### ")) {
        flushList(String(i))
        const content = trimmed === "###" ? "" : trimmed.slice(4)
        elements.push(
          <h3
            key={i}
            className="mt-4 mb-1.5 font-sans text-sm font-semibold uppercase tracking-wider text-muted-foreground"
          >
            {content ? parseInline(content) : <br />}
          </h3>,
        )
        i++
      } else if (taskMatch) {
        flushList(String(i))
        const checked = taskMatch[1].toLowerCase() === "x"
        const content = taskMatch[2]
        elements.push(
          <div key={i} className="mb-1.5 flex items-start gap-2.5">
            <div
              className={cn(
                "mt-1 flex h-4 w-4 shrink-0 items-center justify-center rounded border",
                checked
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-muted-foreground/50 bg-transparent",
              )}
              aria-label={checked ? "Checked" : "Unchecked"}
            >
              {checked && <Check className="h-3 w-3 stroke-[3]" />}
            </div>
            <span
              className={cn(
                "text-[15px] leading-relaxed text-foreground/90",
                checked && "text-muted-foreground line-through",
              )}
            >
              {parseInline(content)}
            </span>
          </div>,
        )
        i++
      } else if (
        trimmed.startsWith("* ") ||
        trimmed.startsWith("- ") ||
        trimmed.startsWith("• ")
      ) {
        const content = trimmed.slice(2)
        currentList.push(
          <li key={`li-${i}`} className="leading-relaxed">
            {content ? parseInline(content) : <br />}
          </li>,
        )
        i++
      } else if (trimmed === "---") {
        flushList(String(i))
        elements.push(<hr key={i} className="my-5 border-t border-border" />)
        i++
      } else if (trimmed === "") {
        flushList(String(i))
        elements.push(<div key={`br-${i}`} className="h-2.5" />)
        i++
      } else {
        flushList(String(i))
        const parts: string[] = []
        const startIdx = i
        while (i < lines.length) {
          const r = lines[i]
          if (isBlockLine(r.trim())) break
          parts.push(r.trim())
          const soft = /  +$/.test(r)
          i++
          if (!soft) break
        }
        elements.push(
          <p
            key={startIdx}
            className="mb-3.5 font-sans text-[15px] leading-relaxed text-foreground/90"
          >
            {parts.map((part, pi) => (
              <React.Fragment key={pi}>
                {pi > 0 && <br />}
                {parseInline(part)}
              </React.Fragment>
            ))}
          </p>,
        )
      }
    }

    flushList("end")
    return elements
  }, [markdown, embeddedTasks, onImageClick])

  if (!rendered) {
    return (
      <p className="text-sm italic text-muted-foreground/70">
        No additional details.
      </p>
    )
  }

  return <div className="space-y-0.5">{rendered}</div>
}

export function PublicPageNotFound() {
  return (
    <div className="flex min-h-[100dvh] w-full flex-col items-center justify-center bg-background px-6 py-12 text-center text-foreground">
      <div className="flex max-w-md flex-col items-center rounded-2xl border border-border bg-card p-8 shadow-lg">
        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full border border-border bg-muted/50 text-muted-foreground">
          <Lock className="h-5 w-5" />
        </div>
        <h1 className="text-lg font-semibold text-foreground">
          This page isn&apos;t available
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          It may be private, unpublished, or deleted.
        </p>
      </div>
    </div>
  )
}

export function PublicPageView({ page }: { page: PublicPageData }) {
  const [listViewMode, setListViewMode] = useState<"list" | "cards" | "table">(
    "list",
  )
  const [copied, setCopied] = useState(false)
  const [lightboxImage, setLightboxImage] = useState<{
    url: string
    alt?: string
  } | null>(null)

  const isNote = page.type === "note"
  const isDone = page.status === "Done"
  const NoteIcon = (page.icon && ICONS[page.icon]) || FileText
  const actionDateFormatted = formatReadableDate(page.action_date)
  const createdDateFormatted = formatReadableDate(page.date_created)
  const updatedDateFormatted = page.updated_at
    ? new Date(page.updated_at).toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
        year: "numeric",
      })
    : null

  const wideLayout =
    page.is_list && (listViewMode === "cards" || listViewMode === "table")

  const handleCopyLink = async () => {
    const url = buildPublicPageUrl(page.public_id)
    const ok = await copyTextToClipboard(url)
    if (ok) {
      setCopied(true)
      toast.success("Public link copied to clipboard")
      setTimeout(() => setCopied(false), 2000)
    } else {
      toast.error("Could not copy link")
    }
  }

  return (
    <div className="flex min-h-[100dvh] w-full flex-col bg-background text-foreground">
      {/* Minimal full-page header — no sidebar or workspace tabs */}
      <header className="sticky top-0 z-30 flex h-12 shrink-0 items-center justify-between border-b border-border/60 bg-background/85 px-4 backdrop-blur supports-[backdrop-filter]:bg-background/65 sm:px-6">
        <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
          <span className="inline-flex items-center gap-1.5 rounded-md border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-emerald-400">
            <Globe className="h-3 w-3" />
            Public page
          </span>
        </div>
        <button
          type="button"
          onClick={handleCopyLink}
          className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-2.5 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          {copied ? (
            <>
              <Check className="h-3.5 w-3.5 text-emerald-400" />
              <span>Copied</span>
            </>
          ) : (
            <>
              <Share2 className="h-3.5 w-3.5" />
              <span>Copy link</span>
            </>
          )}
        </button>
      </header>

      {/* Main full-page content */}
      <main className="flex-1 px-4 py-8 sm:px-8 sm:py-12">
        <div
          className={cn(
            "mx-auto w-full transition-[max-width] duration-200",
            wideLayout ? "max-w-6xl" : "max-w-3xl",
          )}
        >
          {/* Page Header */}
          <div className="flex items-start gap-3">
            {isNote ? (
              <div
                className="mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border/60 bg-card"
                style={page.color ? { color: page.color } : undefined}
              >
                <NoteIcon className="h-5 w-5" />
              </div>
            ) : (
              <div className="mt-1.5 shrink-0">
                {isDone ? (
                  <CircleCheck className="h-6 w-6 text-primary" />
                ) : (
                  <Circle className="h-6 w-6 text-muted-foreground/70" />
                )}
              </div>
            )}

            <div className="min-w-0 flex-1">
              <h1
                className={cn(
                  "text-2xl font-bold leading-tight tracking-tight text-foreground sm:text-3xl",
                  !isNote && isDone && "text-muted-foreground line-through",
                )}
              >
                {page.description || (isNote ? "Untitled Note" : "Untitled Task")}
              </h1>

              {/* Metadata Pills */}
              <div className="mt-3 flex flex-wrap items-center gap-2">
                {isNote ? (
                  <span className="inline-flex items-center gap-1.5 rounded-md border border-primary/20 bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary">
                    <FileText className="h-3 w-3" />
                    Note
                  </span>
                ) : (
                  <>
                    <span
                      className={cn(
                        "inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-xs font-medium",
                        isDone
                          ? "border-primary/40 bg-primary/10 text-primary"
                          : "border-border bg-card text-muted-foreground",
                      )}
                    >
                      {isDone ? (
                        <CircleCheck className="h-3 w-3" />
                      ) : (
                        <Circle className="h-3 w-3" />
                      )}
                      {page.status}
                    </span>

                    {page.urgency && (
                      <span className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-2 py-0.5 font-mono text-xs uppercase tracking-wider text-muted-foreground">
                        <span
                          className="h-1.5 w-1.5 rounded-full"
                          style={{ backgroundColor: page.urgency.color }}
                        />
                        {page.urgency.name}
                      </span>
                    )}
                  </>
                )}

                {actionDateFormatted && (
                  <span className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-2 py-0.5 font-mono text-xs text-muted-foreground">
                    <Calendar className="h-3 w-3" />
                    {actionDateFormatted}
                  </span>
                )}

                {createdDateFormatted && (
                  <span className="font-mono text-xs text-muted-foreground">
                    Created {createdDateFormatted}
                  </span>
                )}

                {updatedDateFormatted && (
                  <span className="font-mono text-xs text-muted-foreground">
                    · Updated {updatedDateFormatted}
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="my-6 border-b border-border/60" />

          {/* Page Body */}
          {page.is_list ? (
            <PublicListView
              items={page.list_items ?? []}
              categories={page.list_categories ?? []}
              fields={page.list_fields ?? []}
              onViewModeChange={setListViewMode}
            />
          ) : (
            <PublicMarkdownBody
              markdown={page.details}
              embeddedTasks={page.embedded_tasks}
              onImageClick={(url, alt) => setLightboxImage({ url, alt })}
            />
          )}
        </div>
      </main>

      {/* Image Lightbox */}
      <Dialog
        open={lightboxImage !== null}
        onOpenChange={(open) => {
          if (!open) setLightboxImage(null)
        }}
      >
        <DialogContent className="max-w-4xl border-border/60 bg-background/95 p-3">
          <DialogTitle className="sr-only">
            {lightboxImage?.alt || "Image preview"}
          </DialogTitle>
          {lightboxImage && (
            <div className="flex flex-col items-center gap-2">
              <img
                src={lightboxImage.url}
                alt={lightboxImage.alt || "Image"}
                className="max-h-[82vh] w-auto rounded-md object-contain"
              />
              {lightboxImage.alt && (
                <p className="text-xs text-muted-foreground">
                  {lightboxImage.alt}
                </p>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
