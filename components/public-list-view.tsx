"use client"

import React, { useEffect, useMemo, useState } from "react"
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Calendar,
  Check,
  Columns3,
  ExternalLink,
  Hash,
  Image as ImageIcon,
  ImageOff,
  LayoutGrid,
  Link2,
  List,
  Table2,
  Tag,
  Type,
} from "lucide-react"
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog"
import { MediaCard } from "@/components/ui/media-card"
import { useIsMobile } from "@/hooks/use-mobile"
import { ICON_OPTIONS } from "@/lib/constants"
import {
  compareListItems,
  formatDateValue,
  formatLinkLabel,
  formatNumberValue,
  getMatchingLinkPreview,
  getSafeHref,
  sanitizeCustomFieldValue,
} from "@/lib/list-field-utils"
import { cn } from "@/lib/utils"
import type {
  ListCategory,
  ListField,
  ListFieldType,
  ListItem,
} from "@/lib/types"

type PublicListViewMode = "list" | "cards" | "table"
type StatusFilter = "all" | "open" | "done"

interface PublicListViewProps {
  items: ListItem[]
  categories: ListCategory[]
  fields: ListField[]
  onViewModeChange?: (mode: PublicListViewMode) => void
}

function CategoryIcon({
  name,
  className,
}: {
  name?: string | null
  className?: string
}) {
  const IconComp = name
    ? ICON_OPTIONS.find((o) => o.name === name)?.icon || Tag
    : Tag
  return <IconComp className={className} />
}

function PublicFieldTypeIcon({
  type,
  className,
}: {
  type: ListFieldType
  className?: string
}) {
  switch (type) {
    case "text":
      return <Type className={className} />
    case "number":
      return <Hash className={className} />
    case "link":
      return <Link2 className={className} />
    case "image":
      return <ImageIcon className={className} />
    case "date":
      return <Calendar className={className} />
  }
}

function PublicImageThumb({
  src,
  alt,
  className,
  onClick,
}: {
  src: string
  alt: string
  className?: string
  onClick?: (e: React.MouseEvent) => void
}) {
  const [hasError, setHasError] = useState(false)

  useEffect(() => {
    setHasError(false)
  }, [src])

  if (hasError || !src) {
    return (
      <div
        className={cn(
          "flex items-center justify-center rounded-md border border-border bg-muted/60 text-muted-foreground",
          className,
        )}
        title="Image could not be loaded"
      >
        <ImageOff className="h-4 w-4 opacity-60" />
      </div>
    )
  }

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "overflow-hidden rounded-md border border-border bg-muted/40 transition-opacity hover:opacity-90",
        onClick && "cursor-zoom-in",
        className,
      )}
      title="View image"
    >
      <img
        src={src}
        alt={alt}
        className="h-full w-full object-cover"
        onError={() => setHasError(true)}
      />
    </button>
  )
}

export function PublicListView({
  items,
  categories,
  fields,
  onViewModeChange,
}: PublicListViewProps) {
  const isMobile = useIsMobile()
  const [filter, setFilter] = useState<StatusFilter>("all")
  const [isGrouped, setIsGrouped] = useState(false)
  const [viewMode, setViewMode] = useState<PublicListViewMode>("list")
  const [sortKey, setSortKey] = useState<string>("order")
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc")
  const [selectedItem, setSelectedItem] = useState<ListItem | null>(null)
  const [lightboxImage, setLightboxImage] = useState<{
    url: string
    title?: string
  } | null>(null)

  const effectiveViewMode: PublicListViewMode =
    isMobile && viewMode === "table" ? "list" : viewMode

  useEffect(() => {
    onViewModeChange?.(effectiveViewMode)
  }, [effectiveViewMode, onViewModeChange])

  const sortedFields = useMemo(
    () => [...fields].sort((a, b) => a.order - b.order),
    [fields],
  )

  const getCategoryDef = (item: ListItem): ListCategory | undefined => {
    if (item.category_id) {
      const byId = categories.find((c) => c.id === item.category_id)
      if (byId) return byId
    }
    if (item.category) {
      return categories.find(
        (c) => c.name === item.category || c.id === item.category,
      )
    }
    return undefined
  }

  const getCoverImageUrl = (item: ListItem): string | null => {
    for (const field of sortedFields) {
      if (field.type !== "image") continue
      const val = sanitizeCustomFieldValue("image", item.custom_fields?.[field.id])
      const safe = getSafeHref(typeof val === "string" ? val : null)
      if (safe) return safe
    }
    for (const field of sortedFields) {
      if (field.type !== "link") continue
      const preview = getMatchingLinkPreview(item, field.id)
      const safe = getSafeHref(preview?.imageUrl)
      if (safe) return safe
    }
    return null
  }

  const openCount = useMemo(
    () => items.filter((i) => i.status === "Open").length,
    [items],
  )
  const doneCount = useMemo(
    () => items.filter((i) => i.status === "Done").length,
    [items],
  )

  const visibleItems = useMemo(() => {
    const filtered = items.filter((item) => {
      if (filter === "open") return item.status === "Open"
      if (filter === "done") return item.status === "Done"
      return true
    })
    return [...filtered].sort((a, b) =>
      effectiveViewMode === "table"
        ? compareListItems(a, b, sortKey, sortDirection, categories, sortedFields)
        : a.order - b.order,
    )
  }, [
    items,
    filter,
    effectiveViewMode,
    sortKey,
    sortDirection,
    categories,
    sortedFields,
  ])

  const groupedItems = useMemo(() => {
    if (!isGrouped) return null
    const groups: Record<string, ListItem[]> = {}
    for (const item of visibleItems) {
      const cat = getCategoryDef(item)
      const gid = cat ? cat.id : "none"
      if (!groups[gid]) groups[gid] = []
      groups[gid].push(item)
    }
    return Object.entries(groups)
      .map(([gid, groupItems]) => {
        const cat = categories.find((c) => c.id === gid)
        return {
          id: gid,
          name: cat ? cat.name : "No Category",
          category: cat,
          items: groupItems,
        }
      })
      .sort((a, b) => {
        if (a.id === "none") return 1
        if (b.id === "none") return -1
        return a.name.localeCompare(b.name)
      })
  }, [visibleItems, isGrouped, categories])

  const toggleSort = (key: string) => {
    if (sortKey === key) {
      if (sortDirection === "asc") {
        setSortDirection("desc")
      } else {
        setSortKey("order")
        setSortDirection("asc")
      }
    } else {
      setSortKey(key)
      setSortDirection("asc")
    }
  }

  const renderFieldValue = (item: ListItem, field: ListField) => {
    const val = sanitizeCustomFieldValue(field.type, item.custom_fields?.[field.id])
    if (val === null) return null

    if (field.type === "number") {
      return <span>{formatNumberValue(val)}</span>
    }

    if (field.type === "date") {
      return <span>{formatDateValue(val)}</span>
    }

    if (field.type === "link") {
      const href = getSafeHref(String(val))
      if (!href) return null
      const preview = getMatchingLinkPreview(item, field.id)
      const label = preview?.title || formatLinkLabel(String(val))
      return (
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="inline-flex max-w-[220px] items-center gap-1 truncate text-primary hover:underline"
        >
          <span className="truncate">{label}</span>
          <ExternalLink className="h-3 w-3 shrink-0 opacity-70" />
        </a>
      )
    }

    if (field.type === "image") {
      const safe = getSafeHref(String(val))
      if (!safe) return null
      return (
        <PublicImageThumb
          src={safe}
          alt={item.description}
          className="h-7 w-7 shrink-0"
          onClick={(e) => {
            e.stopPropagation()
            setLightboxImage({ url: safe, title: item.description })
          }}
        />
      )
    }

    return <span className="truncate">{String(val)}</span>
  }

  const renderListRow = (item: ListItem) => {
    const cat = getCategoryDef(item)
    const isDone = item.status === "Done"
    const populatedFields = sortedFields.filter((f) => {
      const val = sanitizeCustomFieldValue(f.type, item.custom_fields?.[f.id])
      if (val === null) return false
      if (f.type === "link" || f.type === "image") {
        return !!getSafeHref(String(val))
      }
      return true
    })

    return (
      <div
        key={item.id}
        onClick={() => setSelectedItem(item)}
        className={cn(
          "group flex cursor-pointer items-start gap-3 rounded-xl border border-border bg-card px-3.5 py-3 transition-colors hover:border-primary/40 hover:bg-card/80",
          isDone && "opacity-65",
        )}
      >
        <div
          className={cn(
            "mt-0.5 flex h-4.5 w-4.5 shrink-0 items-center justify-center rounded-full border-2",
            isDone
              ? "border-primary bg-primary text-primary-foreground"
              : "border-muted-foreground/50 bg-transparent",
          )}
          aria-label={isDone ? "Done" : "Open"}
        >
          {isDone && <Check className="h-3 w-3 stroke-[3]" />}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={cn(
                "text-sm font-medium leading-snug text-foreground",
                isDone && "line-through text-muted-foreground",
              )}
            >
              {item.description}
            </span>
            {cat && (
              <span
                className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium"
                style={
                  cat.color
                    ? {
                        backgroundColor: `color-mix(in oklch, ${cat.color} 15%, transparent)`,
                        color: cat.color,
                      }
                    : { backgroundColor: "var(--muted)", color: "var(--muted-foreground)" }
                }
              >
                <CategoryIcon name={cat.icon} className="h-3 w-3" />
                {cat.name}
              </span>
            )}
          </div>

          {item.details && (
            <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-muted-foreground">
              {item.details}
            </p>
          )}

          {populatedFields.length > 0 && (
            <div className="mt-2 flex flex-wrap items-center gap-2">
              {populatedFields.map((field) => {
                const rendered = renderFieldValue(item, field)
                if (!rendered) return null
                return (
                  <div
                    key={field.id}
                    className="inline-flex max-w-full items-center gap-1.5 rounded-md border border-border/70 bg-muted/30 px-2 py-1 text-xs text-muted-foreground"
                  >
                    <PublicFieldTypeIcon
                      type={field.type}
                      className="h-3 w-3 shrink-0 opacity-70"
                    />
                    <span className="shrink-0 font-mono text-[10px] uppercase tracking-wider opacity-70">
                      {field.name}:
                    </span>
                    <div className="min-w-0 truncate text-foreground/90">
                      {rendered}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    )
  }

  const renderCard = (item: ListItem) => {
    const cat = getCategoryDef(item)
    const isDone = item.status === "Done"
    const coverUrl = getCoverImageUrl(item)
    const hasCoverFields = sortedFields.some(
      (f) => f.type === "image" || f.type === "link",
    )

    const nonImageFields = sortedFields.filter((f) => {
      if (f.type === "image") return false
      const val = sanitizeCustomFieldValue(f.type, item.custom_fields?.[f.id])
      if (val === null) return false
      if (f.type === "link") return !!getSafeHref(String(val))
      return true
    })

    return (
      <MediaCard
        key={item.id}
        imageUrl={coverUrl}
        imageAlt={item.description}
        showCoverWhenEmpty={hasCoverFields}
        accentColor={cat?.color}
        dimmed={isDone}
        onClick={() => setSelectedItem(item)}
        onImageClick={
          coverUrl
            ? (e) => {
                e.stopPropagation()
                setLightboxImage({ url: coverUrl, title: item.description })
              }
            : undefined
        }
        topLeft={
          <div
            className={cn(
              "flex h-5 w-5 items-center justify-center rounded-full border-2 shadow-sm",
              isDone
                ? "border-primary bg-primary text-primary-foreground"
                : coverUrl || hasCoverFields
                  ? "border-white/80 bg-black/50 backdrop-blur-sm"
                  : "border-muted-foreground/50 bg-transparent",
            )}
          >
            {isDone && <Check className="h-3 w-3 stroke-[3]" />}
          </div>
        }
        title={
          <div
            className={cn(
              "text-sm font-semibold leading-snug text-foreground line-clamp-2",
              isDone && "line-through text-muted-foreground",
            )}
          >
            {item.description}
          </div>
        }
        footer={
          cat ? (
            <span
              className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium"
              style={
                cat.color
                  ? {
                      backgroundColor: `color-mix(in oklch, ${cat.color} 15%, transparent)`,
                      color: cat.color,
                    }
                  : { backgroundColor: "var(--muted)", color: "var(--muted-foreground)" }
              }
            >
              <CategoryIcon name={cat.icon} className="h-3 w-3" />
              {cat.name}
            </span>
          ) : undefined
        }
      >
        {item.details && (
          <p className="line-clamp-2 text-xs leading-relaxed text-muted-foreground">
            {item.details}
          </p>
        )}
        {nonImageFields.length > 0 && (
          <div className="mt-1 flex flex-col gap-1">
            {nonImageFields.map((field) => {
              const rendered = renderFieldValue(item, field)
              if (!rendered) return null
              return (
                <div
                  key={field.id}
                  className="flex items-center gap-1.5 text-xs text-muted-foreground min-w-0"
                >
                  <PublicFieldTypeIcon
                    type={field.type}
                    className="h-3 w-3 shrink-0 opacity-70"
                  />
                  <span className="truncate font-medium text-muted-foreground/80">
                    {field.name}:
                  </span>
                  <div className="min-w-0 truncate text-foreground/90">
                    {rendered}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </MediaCard>
    )
  }

  const renderTable = (tableItems: ListItem[]) => (
    <div className="overflow-x-auto rounded-xl border border-border bg-card">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-border bg-muted/30 text-left text-xs font-mono uppercase tracking-wider text-muted-foreground">
            <th className="w-16 px-3 py-2.5">
              <button
                type="button"
                onClick={() => toggleSort("status")}
                className="inline-flex items-center gap-1 hover:text-foreground"
              >
                Status
                {sortKey === "status" ? (
                  sortDirection === "asc" ? (
                    <ArrowUp className="h-3 w-3" />
                  ) : (
                    <ArrowDown className="h-3 w-3" />
                  )
                ) : (
                  <ArrowUpDown className="h-3 w-3 opacity-40" />
                )}
              </button>
            </th>
            <th className="min-w-[200px] px-3 py-2.5">
              <button
                type="button"
                onClick={() => toggleSort("description")}
                className="inline-flex items-center gap-1 hover:text-foreground"
              >
                Item
                {sortKey === "description" ? (
                  sortDirection === "asc" ? (
                    <ArrowUp className="h-3 w-3" />
                  ) : (
                    <ArrowDown className="h-3 w-3" />
                  )
                ) : (
                  <ArrowUpDown className="h-3 w-3 opacity-40" />
                )}
              </button>
            </th>
            {categories.length > 0 && (
              <th className="min-w-[130px] px-3 py-2.5">
                <button
                  type="button"
                  onClick={() => toggleSort("category")}
                  className="inline-flex items-center gap-1 hover:text-foreground"
                >
                  Category
                  {sortKey === "category" ? (
                    sortDirection === "asc" ? (
                      <ArrowUp className="h-3 w-3" />
                    ) : (
                      <ArrowDown className="h-3 w-3" />
                    )
                  ) : (
                    <ArrowUpDown className="h-3 w-3 opacity-40" />
                  )}
                </button>
              </th>
            )}
            {sortedFields.map((field) => {
              const colKey = `custom:${field.id}`
              return (
                <th key={field.id} className="min-w-[130px] px-3 py-2.5">
                  <button
                    type="button"
                    onClick={() => toggleSort(colKey)}
                    className="inline-flex items-center gap-1.5 hover:text-foreground"
                  >
                    <PublicFieldTypeIcon
                      type={field.type}
                      className="h-3 w-3 opacity-70"
                    />
                    <span className="truncate">{field.name}</span>
                    {sortKey === colKey ? (
                      sortDirection === "asc" ? (
                        <ArrowUp className="h-3 w-3" />
                      ) : (
                        <ArrowDown className="h-3 w-3" />
                      )
                    ) : (
                      <ArrowUpDown className="h-3 w-3 opacity-40" />
                    )}
                  </button>
                </th>
              )
            })}
            <th className="min-w-[180px] px-3 py-2.5">Details</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border/60">
          {tableItems.map((item) => {
            const cat = getCategoryDef(item)
            const isDone = item.status === "Done"
            return (
              <tr
                key={item.id}
                onClick={() => setSelectedItem(item)}
                className={cn(
                  "cursor-pointer transition-colors hover:bg-muted/30",
                  isDone && "opacity-65",
                )}
              >
                <td className="px-3 py-2.5 align-middle">
                  <div
                    className={cn(
                      "flex h-4.5 w-4.5 items-center justify-center rounded-full border-2",
                      isDone
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-muted-foreground/50 bg-transparent",
                    )}
                  >
                    {isDone && <Check className="h-3 w-3 stroke-[3]" />}
                  </div>
                </td>
                <td
                  className={cn(
                    "px-3 py-2.5 align-middle font-medium text-foreground",
                    isDone && "line-through text-muted-foreground",
                  )}
                >
                  {item.description}
                </td>
                {categories.length > 0 && (
                  <td className="px-3 py-2.5 align-middle">
                    {cat ? (
                      <span
                        className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium"
                        style={
                          cat.color
                            ? {
                                backgroundColor: `color-mix(in oklch, ${cat.color} 15%, transparent)`,
                                color: cat.color,
                              }
                            : {
                                backgroundColor: "var(--muted)",
                                color: "var(--muted-foreground)",
                              }
                        }
                      >
                        <CategoryIcon name={cat.icon} className="h-3 w-3" />
                        {cat.name}
                      </span>
                    ) : (
                      <span className="text-xs text-muted-foreground/40">—</span>
                    )}
                  </td>
                )}
                {sortedFields.map((field) => {
                  const rendered = renderFieldValue(item, field)
                  return (
                    <td
                      key={field.id}
                      className="px-3 py-2.5 align-middle text-xs text-foreground/90"
                    >
                      {rendered ?? (
                        <span className="text-muted-foreground/40">—</span>
                      )}
                    </td>
                  )
                })}
                <td className="max-w-[260px] truncate px-3 py-2.5 align-middle text-xs text-muted-foreground">
                  {item.details || (
                    <span className="text-muted-foreground/40">—</span>
                  )}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )

  return (
    <div className="flex flex-col gap-4">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1">
          {(
            [
              { key: "all", label: "All", count: items.length },
              { key: "open", label: "Open", count: openCount },
              { key: "done", label: "Done", count: doneCount },
            ] as const
          ).map((tab) => {
            const active = filter === tab.key
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => setFilter(tab.key)}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition-colors",
                  active
                    ? "bg-primary/15 text-primary"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
              >
                <span>{tab.label}</span>
                <span className="font-mono text-[11px] opacity-75">
                  {tab.count}
                </span>
              </button>
            )
          })}
        </div>

        {categories.length > 0 && (
          <>
            <div className="h-4 w-px bg-border" />
            <button
              type="button"
              onClick={() => setIsGrouped((g) => !g)}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition-colors",
                isGrouped
                  ? "bg-primary/15 text-primary"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
            >
              <Columns3 className="h-3.5 w-3.5" />
              <span>Group by category</span>
            </button>
          </>
        )}

        <div
          role="radiogroup"
          aria-label="List display mode"
          className="ml-auto inline-flex items-center rounded-md border border-border bg-muted/40 p-0.5"
        >
          <button
            type="button"
            role="radio"
            aria-checked={effectiveViewMode === "list"}
            onClick={() => setViewMode("list")}
            className={cn(
              "inline-flex items-center gap-1 rounded px-2 py-1 text-xs font-medium transition-colors",
              effectiveViewMode === "list"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <List className="h-3.5 w-3.5" />
            <span>List</span>
          </button>
          <button
            type="button"
            role="radio"
            aria-checked={effectiveViewMode === "cards"}
            onClick={() => setViewMode("cards")}
            className={cn(
              "inline-flex items-center gap-1 rounded px-2 py-1 text-xs font-medium transition-colors",
              effectiveViewMode === "cards"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <LayoutGrid className="h-3.5 w-3.5" />
            <span>Cards</span>
          </button>
          {!isMobile && (
            <button
              type="button"
              role="radio"
              aria-checked={effectiveViewMode === "table"}
              onClick={() => setViewMode("table")}
              className={cn(
                "inline-flex items-center gap-1 rounded px-2 py-1 text-xs font-medium transition-colors",
                effectiveViewMode === "table"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <Table2 className="h-3.5 w-3.5" />
              <span>Table</span>
            </button>
          )}
        </div>
      </div>

      {/* Items */}
      {visibleItems.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border py-12 text-center text-sm text-muted-foreground">
          No items match this filter.
        </div>
      ) : groupedItems ? (
        <div className="flex flex-col gap-6">
          {groupedItems.map((group) => (
            <div key={group.id} className="flex flex-col gap-2.5">
              <div className="flex items-center gap-2">
                {group.category && (
                  <span
                    className="inline-flex h-5 w-5 items-center justify-center rounded"
                    style={
                      group.category.color
                        ? {
                            backgroundColor: `color-mix(in oklch, ${group.category.color} 15%, transparent)`,
                            color: group.category.color,
                          }
                        : undefined
                    }
                  >
                    <CategoryIcon
                      name={group.category.icon}
                      className="h-3.5 w-3.5"
                    />
                  </span>
                )}
                <h3 className="text-xs font-mono font-semibold uppercase tracking-wider text-muted-foreground">
                  {group.name} ({group.items.length})
                </h3>
              </div>

              {effectiveViewMode === "table" ? (
                renderTable(group.items)
              ) : effectiveViewMode === "cards" ? (
                <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                  {group.items.map(renderCard)}
                </div>
              ) : (
                <div className="flex flex-col gap-2">
                  {group.items.map(renderListRow)}
                </div>
              )}
            </div>
          ))}
        </div>
      ) : effectiveViewMode === "table" ? (
        renderTable(visibleItems)
      ) : effectiveViewMode === "cards" ? (
        <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {visibleItems.map(renderCard)}
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {visibleItems.map(renderListRow)}
        </div>
      )}

      {/* Read-only Item Detail Dialog */}
      <Dialog
        open={selectedItem !== null}
        onOpenChange={(open) => {
          if (!open) setSelectedItem(null)
        }}
      >
        <DialogContent className="max-w-lg gap-4 p-6">
          {selectedItem && (() => {
            const cat = getCategoryDef(selectedItem)
            const isDone = selectedItem.status === "Done"
            return (
              <>
                <div className="flex items-start gap-3 pr-6">
                  <div
                    className={cn(
                      "mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2",
                      isDone
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-muted-foreground/50 bg-transparent",
                    )}
                  >
                    {isDone && <Check className="h-3 w-3 stroke-[3]" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <DialogTitle
                      className={cn(
                        "text-lg font-bold leading-snug",
                        isDone && "line-through text-muted-foreground",
                      )}
                    >
                      {selectedItem.description}
                    </DialogTitle>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <span className="rounded-md border border-border bg-muted/40 px-2 py-0.5 text-xs font-medium text-muted-foreground">
                        {isDone ? "Done" : "Open"}
                      </span>
                      {cat && (
                        <span
                          className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium"
                          style={
                            cat.color
                              ? {
                                  backgroundColor: `color-mix(in oklch, ${cat.color} 15%, transparent)`,
                                  color: cat.color,
                                }
                              : {
                                  backgroundColor: "var(--muted)",
                                  color: "var(--muted-foreground)",
                                }
                          }
                        >
                          <CategoryIcon name={cat.icon} className="h-3 w-3" />
                          {cat.name}
                        </span>
                      )}
                      {selectedItem.date_created && (
                        <span className="font-mono text-xs text-muted-foreground">
                          Added{" "}
                          {new Date(
                            selectedItem.date_created,
                          ).toLocaleDateString(undefined, {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                          })}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {sortedFields.length > 0 && (
                  <div className="grid gap-3 border-t border-border/60 pt-3">
                    {sortedFields.map((field) => {
                      const val = sanitizeCustomFieldValue(
                        field.type,
                        selectedItem.custom_fields?.[field.id],
                      )
                      if (val === null) return null
                      if (field.type === "image") {
                        const safe = getSafeHref(String(val))
                        if (!safe) return null
                        return (
                          <div key={field.id} className="flex flex-col gap-1.5">
                            <span className="flex items-center gap-1.5 font-mono text-xs uppercase tracking-wider text-muted-foreground">
                              <ImageIcon className="h-3.5 w-3.5" />
                              {field.name}
                            </span>
                            <button
                              type="button"
                              onClick={() =>
                                setLightboxImage({
                                  url: safe,
                                  title: selectedItem.description,
                                })
                              }
                              className="max-h-56 w-fit overflow-hidden rounded-lg border border-border cursor-zoom-in"
                            >
                              <img
                                src={safe}
                                alt={selectedItem.description}
                                className="max-h-56 w-auto object-contain"
                              />
                            </button>
                          </div>
                        )
                      }
                      if (field.type === "link") {
                        const safe = getSafeHref(String(val))
                        if (!safe) return null
                        const preview = getMatchingLinkPreview(
                          selectedItem,
                          field.id,
                        )
                        return (
                          <div key={field.id} className="flex flex-col gap-1.5">
                            <span className="flex items-center gap-1.5 font-mono text-xs uppercase tracking-wider text-muted-foreground">
                              <Link2 className="h-3.5 w-3.5" />
                              {field.name}
                            </span>
                            <a
                              href={safe}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center gap-3 rounded-lg border border-border bg-muted/30 p-2.5 text-sm transition-colors hover:bg-muted/60"
                            >
                              {preview?.imageUrl && getSafeHref(preview.imageUrl) && (
                                <img
                                  src={getSafeHref(preview.imageUrl)!}
                                  alt=""
                                  className="h-10 w-10 shrink-0 rounded object-cover"
                                />
                              )}
                              <div className="min-w-0 flex-1">
                                <div className="truncate font-medium text-primary">
                                  {preview?.title || formatLinkLabel(String(val))}
                                </div>
                                {preview?.domain && (
                                  <div className="truncate text-xs text-muted-foreground">
                                    {preview.domain}
                                  </div>
                                )}
                              </div>
                              <ExternalLink className="h-4 w-4 shrink-0 text-muted-foreground" />
                            </a>
                          </div>
                        )
                      }
                      return (
                        <div key={field.id} className="flex flex-col gap-0.5">
                          <span className="flex items-center gap-1.5 font-mono text-xs uppercase tracking-wider text-muted-foreground">
                            <PublicFieldTypeIcon
                              type={field.type}
                              className="h-3.5 w-3.5"
                            />
                            {field.name}
                          </span>
                          <span className="text-sm text-foreground">
                            {field.type === "number"
                              ? formatNumberValue(val)
                              : field.type === "date"
                                ? formatDateValue(val, true)
                                : String(val)}
                          </span>
                        </div>
                      )
                    })}
                  </div>
                )}

                {selectedItem.details && (
                  <div className="border-t border-border/60 pt-3">
                    <span className="mb-1.5 block font-mono text-xs uppercase tracking-wider text-muted-foreground">
                      Details
                    </span>
                    <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground/90">
                      {selectedItem.details}
                    </p>
                  </div>
                )}
              </>
            )
          })()}
        </DialogContent>
      </Dialog>

      {/* Lightbox Dialog */}
      <Dialog
        open={lightboxImage !== null}
        onOpenChange={(open) => {
          if (!open) setLightboxImage(null)
        }}
      >
        <DialogContent className="max-w-4xl border-border/60 bg-background/95 p-3">
          <DialogTitle className="sr-only">
            {lightboxImage?.title || "Image preview"}
          </DialogTitle>
          {lightboxImage && (
            <div className="flex flex-col items-center gap-2">
              <img
                src={lightboxImage.url}
                alt={lightboxImage.title || "Image"}
                className="max-h-[82vh] w-auto rounded-md object-contain"
              />
              {lightboxImage.title && (
                <p className="text-xs text-muted-foreground">
                  {lightboxImage.title}
                </p>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
