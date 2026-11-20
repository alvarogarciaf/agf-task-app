"use client"

import React, { useCallback, useEffect, useMemo } from "react"
import {
  DndContext,
  closestCenter,
  PointerSensor,
  TouchSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core"
import {
  SortableContext,
  rectSortingStrategy,
  useSortable,
  sortableKeyboardCoordinates,
} from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import {
  Calendar,
  Check,
  ExternalLink,
  Image as ImageIcon,
  LayoutGrid,
  Link2,
  MoreVertical,
  Pencil,
  Plus,
  RotateCcw,
  SlidersHorizontal,
  Tag,
  Trash2,
} from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { MediaCard } from "@/components/ui/media-card"
import { useDynamicTableColumns, type DynamicColumnSpec } from "@/hooks/use-table-columns"
import { ICON_OPTIONS } from "@/lib/constants"
import { preloadImage } from "@/lib/image-cache"
import { cn } from "@/lib/utils"
import {
  formatDateValue,
  formatLinkLabel,
  formatNumberValue,
  getCustomFieldId,
  getSafeHref,
  isCustomColumnKey,
  makeCustomColumnKey,
  sanitizeCustomFieldValue,
} from "@/lib/list-field-utils"
import { FieldTypeIcon, ImageThumbnail } from "@/components/list-field-inputs"
import type { ListCategory, ListField, ListItem } from "@/lib/types"

type BuiltInCardFieldKey = "status" | "category" | "details" | "date_created"

const BUILTIN_CARD_FIELDS: {
  key: BuiltInCardFieldKey
  label: string
  defaultVisible: boolean
}[] = [
  { key: "status", label: "Status checkbox", defaultVisible: true },
  { key: "category", label: "Category", defaultVisible: true },
  { key: "details", label: "Description", defaultVisible: true },
  { key: "date_created", label: "Created", defaultVisible: false },
]

const BUILTIN_CARD_LABEL_MAP: Record<BuiltInCardFieldKey, string> = {
  status: "Status checkbox",
  category: "Category",
  details: "Description",
  date_created: "Created",
}

function SortableCardWrapper({
  id,
  children,
}: {
  id: string
  children: React.ReactNode
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id })

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.45 : undefined,
    position: "relative",
    zIndex: isDragging ? 10 : 0,
  }

  return (
    <div ref={setNodeRef} style={style} className="h-full" {...attributes} {...listeners}>
      {children}
    </div>
  )
}

export function ListCardsView({
  listId,
  items,
  allItemsCount,
  categories,
  fields,
  filter,
  isGrouped,
  atLimit,
  onToggleStatus,
  onDeleteItem,
  onEditItem,
  onAddItem,
  onReorderItems,
  onOpenAddField,
  onOpenFieldsManager,
  onPreviewImage,
}: {
  listId?: string
  items: ListItem[]
  allItemsCount: number
  categories: ListCategory[]
  fields: ListField[]
  filter: "all" | "open" | "done"
  isGrouped: boolean
  atLimit: boolean
  onToggleStatus: (id: string) => void
  onDeleteItem: (id: string) => void
  onEditItem: (item: ListItem) => void
  onAddItem: (categoryId: string | null) => void
  onReorderItems: (activeId: string, overId: string, targetCategoryId?: string | null) => void
  onOpenAddField: () => void
  onOpenFieldsManager: () => void
  onPreviewImage: (url: string, title?: string) => void
}) {
  const sortedFields = useMemo(
    () => [...fields].sort((a, b) => a.order - b.order),
    [fields],
  )

  const fieldSpecs: DynamicColumnSpec[] = useMemo(
    () => [
      ...BUILTIN_CARD_FIELDS.map((f) => ({
        key: f.key,
        defaultVisible: f.defaultVisible,
      })),
      ...sortedFields.map((f) => ({
        key: makeCustomColumnKey(f.id),
        defaultVisible: true,
      })),
    ],
    [sortedFields],
  )

  const storageKey = listId ? `velocity:list-cards:${listId}:fields` : undefined
  const { order, visibility, toggle, reset } = useDynamicTableColumns(
    storageKey,
    fieldSpecs,
    { allowNoneVisible: true },
  )

  const fieldMap = useMemo(() => {
    const map = new Map<string, ListField>()
    for (const f of sortedFields) map.set(f.id, f)
    return map
  }, [sortedFields])

  const validFieldKeys = useMemo(
    () => new Set(fieldSpecs.map((f) => f.key)),
    [fieldSpecs],
  )

  const selectableKeys = useMemo(
    () => order.filter((k) => validFieldKeys.has(k)),
    [order, validFieldKeys],
  )

  const visibleCount = useMemo(
    () => selectableKeys.filter((k) => !!visibility[k]).length,
    [selectableKeys, visibility],
  )

  const getFieldLabel = useCallback(
    (key: string): string => {
      if (isCustomColumnKey(key)) {
        const f = fieldMap.get(getCustomFieldId(key))
        return f ? f.name : "Field"
      }
      return BUILTIN_CARD_LABEL_MAP[key as BuiltInCardFieldKey] ?? key
    },
    [fieldMap],
  )

  const getCustomField = useCallback(
    (key: string): ListField | undefined => {
      if (!isCustomColumnKey(key)) return undefined
      return fieldMap.get(getCustomFieldId(key))
    },
    [fieldMap],
  )

  const getCategoryDef = useCallback(
    (item: ListItem): ListCategory | undefined => {
      if (item.category_id) {
        const found = categories.find((c) => c.id === item.category_id)
        if (found) return found
      }
      if (item.category) {
        return categories.find((c) => c.name === item.category || c.id === item.category)
      }
      return undefined
    },
    [categories],
  )

  const visibleImageFields = useMemo(
    () =>
      sortedFields.filter(
        (f) => f.type === "image" && !!visibility[makeCustomColumnKey(f.id)],
      ),
    [sortedFields, visibility],
  )

  const visibleMetaFields = useMemo(
    () =>
      sortedFields.filter(
        (f) => f.type !== "image" && !!visibility[makeCustomColumnKey(f.id)],
      ),
    [sortedFields, visibility],
  )

  // Preload visible card images for smooth scrolling
  useEffect(() => {
    if (!visibleImageFields.length || !items.length) return
    for (const item of items) {
      if (!item.custom_fields) continue
      for (const f of visibleImageFields) {
        const val = sanitizeCustomFieldValue("image", item.custom_fields[f.id])
        if (typeof val === "string") {
          preloadImage(val)
        }
      }
    }
  }, [items, visibleImageFields])

  const groupedItems = useMemo(() => {
    if (!isGrouped) return null
    const groups: Record<string, ListItem[]> = {}
    for (const item of items) {
      const catDef = getCategoryDef(item)
      const gid = catDef ? catDef.id : "none"
      if (!groups[gid]) groups[gid] = []
      groups[gid].push(item)
    }
    return Object.entries(groups)
      .map(([gid, groupItems]) => {
        const cat = categories.find((c) => c.id === gid)
        return {
          id: gid,
          name: cat ? cat.name : "No Category",
          catDef: cat,
          items: groupItems,
        }
      })
      .sort((a, b) => {
        if (a.id === "none") return 1
        if (b.id === "none") return -1
        return a.name.localeCompare(b.name)
      })
  }, [isGrouped, items, categories, getCategoryDef])

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const activeId = String(active.id)
    const overId = String(over.id)
    let targetCategoryId: string | null | undefined = undefined
    if (isGrouped) {
      const overItem = items.find((i) => i.id === overId)
      if (overItem) {
        const catDef = getCategoryDef(overItem)
        targetCategoryId = catDef ? catDef.id : null
      }
    }
    onReorderItems(activeId, overId, targetCategoryId)
  }

  const renderCard = (item: ListItem) => {
    const isDone = item.status === "Done"
    const catDef = getCategoryDef(item)
    const catName = catDef?.name || item.category || null
    const CatIcon = catDef?.icon
      ? ICON_OPTIONS.find((o) => o.name === catDef.icon)?.icon || Tag
      : Tag

    const populatedImages: { field: ListField; url: string }[] = []
    for (const imgField of visibleImageFields) {
      const val = sanitizeCustomFieldValue("image", item.custom_fields?.[imgField.id])
      if (typeof val === "string") {
        populatedImages.push({ field: imgField, url: val })
      }
    }

    const coverImage = populatedImages[0] ?? null
    const extraImages = populatedImages.slice(1)
    const showCoverWhenEmpty = visibleImageFields.length > 0
    const hasCover = !!coverImage || showCoverWhenEmpty

    const populatedMetaValues: { field: ListField; value: string | number }[] = []
    for (const metaField of visibleMetaFields) {
      const val = sanitizeCustomFieldValue(metaField.type, item.custom_fields?.[metaField.id])
      if (val !== null) {
        populatedMetaValues.push({ field: metaField, value: val })
      }
    }

    const badgeValues = populatedMetaValues.filter(
      ({ field }) => field.type === "number" || field.type === "date",
    )
    const blockValues = populatedMetaValues.filter(
      ({ field }) => field.type !== "number" && field.type !== "date",
    )

    const showStatus = !!visibility["status"]
    const showCategory = !!visibility["category"] && !!catName
    const showDetails = !!visibility["details"] && !!item.details
    const showCreated = !!visibility["date_created"]

    const createdDate = new Date(item.date_created)
    const createdFormatted = !Number.isNaN(createdDate.getTime())
      ? createdDate.toLocaleDateString(undefined, { month: "short", day: "numeric" })
      : ""

    return (
      <SortableCardWrapper key={item.id} id={item.id}>
        <MediaCard
          imageUrl={coverImage?.url ?? null}
          imageAlt={coverImage ? `${item.description} - ${coverImage.field.name}` : item.description}
          onImageClick={
            coverImage
              ? (e) => {
                  e.stopPropagation()
                  onPreviewImage(
                    coverImage.url,
                    `${item.description} (${coverImage.field.name})`,
                  )
                }
              : undefined
          }
          showCoverWhenEmpty={showCoverWhenEmpty}
          accentColor={catDef?.color}
          fallbackIcon={catDef ? CatIcon : ImageIcon}
          dimmed={isDone}
          onClick={() => onEditItem(item)}
          className="h-full"
          topLeft={
            showStatus ? (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  onToggleStatus(item.id)
                }}
                aria-label={isDone ? "Mark as open" : "Mark as done"}
                className={cn(
                  "flex items-center justify-center transition-colors",
                  hasCover
                    ? "h-6 w-6 rounded-md border bg-background/80 backdrop-blur-sm shadow-sm"
                    : "h-4.5 w-4.5 rounded-sm border",
                  isDone
                    ? "border-primary bg-primary text-primary-foreground"
                    : hasCover
                      ? "border-border/80 text-transparent hover:border-primary"
                      : "border-muted-foreground text-transparent hover:border-primary",
                )}
              >
                {isDone && <Check className="h-3.5 w-3.5" />}
              </button>
            ) : undefined
          }
          topRight={
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  onClick={(e) => e.stopPropagation()}
                  aria-label="Card actions"
                  className={cn(
                    "flex items-center justify-center transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    hasCover
                      ? "h-7 w-7 rounded-full bg-background/80 backdrop-blur-sm text-foreground shadow-sm hover:bg-background/95 md:opacity-0 md:group-hover:opacity-100 data-[state=open]:opacity-100"
                      : "h-6 w-6 rounded-full text-muted-foreground hover:bg-muted hover:text-foreground",
                  )}
                >
                  <MoreVertical className="h-3.5 w-3.5" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-36">
                <DropdownMenuItem onClick={() => onEditItem(item)}>
                  <Pencil className="mr-2 h-3.5 w-3.5 text-muted-foreground" />
                  Edit
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onToggleStatus(item.id)}>
                  {isDone ? (
                    <>
                      <RotateCcw className="mr-2 h-3.5 w-3.5 text-muted-foreground" />
                      Reopen
                    </>
                  ) : (
                    <>
                      <Check className="mr-2 h-3.5 w-3.5 text-muted-foreground" />
                      Done
                    </>
                  )}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => onDeleteItem(item.id)}
                  className="text-destructive focus:bg-destructive/10"
                >
                  <Trash2 className="mr-2 h-3.5 w-3.5 text-destructive" />
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          }
          title={
            <h4
              className={cn(
                "text-sm font-semibold leading-snug line-clamp-2",
                isDone ? "text-muted-foreground line-through" : "text-foreground",
              )}
            >
              {item.description}
            </h4>
          }
          footer={
            showCreated && createdFormatted ? (
              <span className="inline-flex items-center gap-1 font-mono text-[11px] text-muted-foreground">
                <Calendar className="h-3 w-3" />
                {createdFormatted}
              </span>
            ) : undefined
          }
        >
          {showCategory && catName && (
            <div className="flex items-center">
              <span
                className="inline-flex max-w-full items-center gap-1.5 rounded-md border px-2 py-0.5 text-[11px] font-medium"
                style={{
                  color: catDef?.color || "var(--foreground)",
                  borderColor: catDef?.color
                    ? `color-mix(in oklch, ${catDef.color} 35%, transparent)`
                    : "var(--border)",
                  backgroundColor: catDef?.color
                    ? `color-mix(in oklch, ${catDef.color} 12%, transparent)`
                    : "var(--muted)",
                }}
              >
                <CatIcon className="h-3 w-3 shrink-0" />
                <span className="truncate">{catName}</span>
              </span>
            </div>
          )}

          {showDetails && item.details && (
            <p
              className={cn(
                "line-clamp-2 text-xs text-muted-foreground",
                isDone && "opacity-65",
              )}
            >
              {item.details}
            </p>
          )}

          {badgeValues.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
              {badgeValues.map(({ field, value }) => {
                if (field.type === "number") {
                  return (
                    <span
                      key={field.id}
                      className="inline-flex items-center gap-1 rounded bg-muted/70 px-1.5 py-0.5 font-mono text-[11px] tabular-nums text-foreground/90"
                    >
                      <span className="font-sans text-muted-foreground">{field.name}:</span>
                      {formatNumberValue(value)}
                    </span>
                  )
                }

                const formatted = formatDateValue(value)
                if (!formatted) return null
                return (
                  <span
                    key={field.id}
                    className="inline-flex items-center gap-1 rounded bg-muted/70 px-1.5 py-0.5 font-mono text-[11px] text-foreground/90"
                    title={`${field.name}: ${formatDateValue(value, true)}`}
                  >
                    <Calendar className="h-3 w-3 shrink-0 text-muted-foreground" />
                    <span className="font-sans text-muted-foreground">{field.name}:</span>
                    {formatted}
                  </span>
                )
              })}
            </div>
          )}

          {blockValues.length > 0 && (
            <div className="flex flex-col gap-1 pt-0.5">
              {blockValues.map(({ field, value }) => {
                if (field.type === "link") {
                  const strVal = String(value)
                  const safeHref = getSafeHref(strVal)
                  if (safeHref) {
                    return (
                      <a
                        key={field.id}
                        href={safeHref}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="inline-flex max-w-full items-center gap-1 text-xs font-medium text-primary hover:underline"
                        title={`${field.name}: ${safeHref}`}
                      >
                        <Link2 className="h-3 w-3 shrink-0" />
                        <span className="truncate">
                          {field.name}: {formatLinkLabel(strVal)}
                        </span>
                        <ExternalLink className="h-2.5 w-2.5 shrink-0 opacity-70" />
                      </a>
                    )
                  }
                }

                return (
                  <div
                    key={field.id}
                    className="text-xs text-muted-foreground line-clamp-2"
                    title={`${field.name}: ${String(value)}`}
                  >
                    <span className="font-medium text-foreground/75">{field.name}: </span>
                    <span>{String(value)}</span>
                  </div>
                )
              })}
            </div>
          )}

          {extraImages.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5 pt-1">
              {extraImages.map(({ field, url }) => (
                <ImageThumbnail
                  key={field.id}
                  src={url}
                  alt={`${item.description} - ${field.name}`}
                  onClick={(e) => {
                    e.stopPropagation()
                    onPreviewImage(url, `${item.description} (${field.name})`)
                  }}
                  className="h-9 w-9 shrink-0 cursor-zoom-in transition-transform hover:scale-105"
                />
              ))}
            </div>
          )}
        </MediaCard>
      </SortableCardWrapper>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border bg-card px-3 py-2">
        <span className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
          {items.length} {items.length === 1 ? "item" : "items"}
          {items.length !== allItemsCount ? ` of ${allItemsCount}` : ""}
        </span>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onOpenFieldsManager}
            className="inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-2.5 py-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
          >
            <SlidersHorizontal className="h-3.5 w-3.5" />
            <span>Fields</span>
            {sortedFields.length > 0 && (
              <span className="rounded bg-muted px-1.5 font-mono text-xs text-muted-foreground">
                {sortedFields.length}
              </span>
            )}
          </button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-2.5 py-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
              >
                <LayoutGrid className="h-3.5 w-3.5" />
                <span>Card fields</span>
                <span className="ml-0.5 rounded bg-muted px-1.5 font-mono text-xs text-muted-foreground">
                  {visibleCount}/{selectableKeys.length}
                </span>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-60">
              <DropdownMenuLabel className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
                Show on cards
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              {selectableKeys.map((key) => {
                const field = getCustomField(key)
                return (
                  <DropdownMenuCheckboxItem
                    key={key}
                    checked={!!visibility[key]}
                    onCheckedChange={() => toggle(key)}
                    onSelect={(e) => e.preventDefault()}
                  >
                    <span className="flex items-center gap-2 truncate">
                      {field && (
                        <FieldTypeIcon
                          type={field.type}
                          className="h-3.5 w-3.5 shrink-0 text-muted-foreground"
                        />
                      )}
                      <span className="truncate">{getFieldLabel(key)}</span>
                    </span>
                  </DropdownMenuCheckboxItem>
                )
              })}
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onSelect={onOpenAddField}
                className="text-xs font-medium text-primary"
              >
                <Plus className="mr-2 h-3.5 w-3.5" />
                Add field
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => reset()} className="text-xs">
                <RotateCcw className="mr-2 h-3 w-3" />
                Reset to defaults
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {filter !== "done" && !atLimit && (
            <button
              type="button"
              onClick={() => onAddItem(null)}
              className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/90"
            >
              <Plus className="h-3.5 w-3.5" />
              Add item
            </button>
          )}
        </div>
      </div>

      {/* Cards Grid */}
      {items.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border px-6 py-12 text-center">
          <p className="text-sm font-medium text-muted-foreground">
            {filter === "all"
              ? "No items yet"
              : filter === "done"
                ? "No done items"
                : "No open items"}
          </p>
          {filter !== "done" && !atLimit && (
            <button
              type="button"
              onClick={() => onAddItem(null)}
              className="mt-3 inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-muted"
            >
              <Plus className="h-3.5 w-3.5" />
              Add your first item
            </button>
          )}
        </div>
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          {groupedItems ? (
            <div className="flex flex-col gap-6">
              {groupedItems.map((group) => {
                const CatIcon = group.catDef?.icon
                  ? ICON_OPTIONS.find((o) => o.name === group.catDef?.icon)?.icon
                  : undefined
                return (
                  <div key={group.id} className="flex flex-col gap-2.5">
                    <div className="flex items-center justify-between px-1 py-1">
                      <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground">
                        <span
                          className="flex h-5 w-5 shrink-0 items-center justify-center rounded-sm"
                          style={{
                            color: group.catDef?.color || "var(--primary)",
                            backgroundColor: group.catDef?.color
                              ? `color-mix(in oklch, ${group.catDef.color} 15%, transparent)`
                              : undefined,
                          }}
                        >
                          {CatIcon ? (
                            <CatIcon className="h-3.5 w-3.5" />
                          ) : (
                            <span className="h-1.5 w-1.5 rounded-full bg-current" />
                          )}
                        </span>
                        <span>{group.name}</span>
                        <span className="font-mono text-xs font-normal text-muted-foreground">
                          {group.items.length}
                        </span>
                      </h3>
                      {filter !== "done" && !atLimit && (
                        <button
                          type="button"
                          onClick={() => onAddItem(group.id === "none" ? null : group.id)}
                          className="inline-flex items-center gap-1 rounded bg-primary/10 px-2 py-1 text-xs font-medium text-primary transition-colors hover:bg-primary/20"
                        >
                          <Plus className="h-3 w-3" />
                          Add item
                        </button>
                      )}
                    </div>
                    <SortableContext
                      items={group.items.map((i) => i.id)}
                      strategy={rectSortingStrategy}
                    >
                      <div className="grid gap-3 grid-cols-[repeat(auto-fill,minmax(min(230px,100%),1fr))]">
                        {group.items.map(renderCard)}
                      </div>
                    </SortableContext>
                  </div>
                )
              })}
            </div>
          ) : (
            <SortableContext
              items={items.map((i) => i.id)}
              strategy={rectSortingStrategy}
            >
              <div className="grid gap-3 grid-cols-[repeat(auto-fill,minmax(min(230px,100%),1fr))]">
                {items.map(renderCard)}
              </div>
            </SortableContext>
          )}
        </DndContext>
      )}

      {/* Bottom Add Item */}
      {!isGrouped && filter !== "done" && !atLimit && items.length > 0 && (
        <button
          type="button"
          onClick={() => onAddItem(null)}
          className="flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-border p-3 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <Plus className="h-4 w-4" />
          Add item
        </button>
      )}
    </div>
  )
}
