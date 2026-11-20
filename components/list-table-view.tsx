"use client"

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react"
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
  verticalListSortingStrategy,
  useSortable,
  sortableKeyboardCoordinates,
} from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import {
  Calendar,
  Check,
  Circle,
  Columns3,
  ExternalLink,
  GripVertical,
  ImagePlus,
  Link2,
  MoreVertical,
  Pencil,
  Plus,
  RotateCcw,
  SlidersHorizontal,
  Tag,
  Trash2,
  X,
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
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import { useDynamicTableColumns, type DynamicColumnSpec } from "@/hooks/use-table-columns"
import { useIsMobile } from "@/hooks/use-mobile"
import { ICON_OPTIONS } from "@/lib/constants"
import { cn } from "@/lib/utils"
import {
  compareListItems,
  formatDateValue,
  formatLinkLabel,
  formatNumberValue,
  getCustomFieldId,
  getMatchingLinkPreview,
  getSafeHref,
  isCustomColumnKey,
  makeCustomColumnKey,
  normalizeDateValue,
  sanitizeCustomFieldValue,
} from "@/lib/list-field-utils"
import { FieldTypeIcon, ImageFieldInput, ImageThumbnail } from "@/components/list-field-inputs"
import type { ListCategory, ListField, ListItem } from "@/lib/types"

type BuiltInColumnKey = "status" | "description" | "category" | "details" | "date_created"

interface BuiltInColumnDef {
  key: BuiltInColumnKey
  label: string
  defaultVisible: boolean
}

const BUILTIN_COLUMNS: BuiltInColumnDef[] = [
  { key: "status", label: "Status", defaultVisible: true },
  { key: "description", label: "Item", defaultVisible: true },
  { key: "category", label: "Category", defaultVisible: true },
  { key: "details", label: "Details", defaultVisible: false },
  { key: "date_created", label: "Created", defaultVisible: false },
]

const BUILTIN_MAP: Record<BuiltInColumnKey, BuiltInColumnDef> = BUILTIN_COLUMNS.reduce(
  (acc, col) => {
    acc[col.key] = col
    return acc
  },
  {} as Record<BuiltInColumnKey, BuiltInColumnDef>,
)

const READONLY_COLUMNS = new Set<string>(["date_created"])

function InlineCellTextInput({
  value,
  type = "text",
  placeholder,
  allowEmpty,
  onCommit,
  onCancel,
  onTab,
}: {
  value: string
  type?: "text" | "number" | "url" | "date"
  placeholder?: string
  allowEmpty: boolean
  onCommit: (val: string) => void
  onCancel: () => void
  onTab: (reverse: boolean) => void
}) {
  const [text, setText] = useState(value)
  const inputRef = useRef<HTMLInputElement>(null)
  const finishedRef = useRef(false)

  useEffect(() => {
    inputRef.current?.focus()
    if (type === "date") {
      if (inputRef.current && "showPicker" in HTMLInputElement.prototype) {
        try {
          inputRef.current.showPicker()
        } catch {}
      }
    } else {
      inputRef.current?.select()
    }
  }, [type])

  const finishCommit = () => {
    if (finishedRef.current) return
    finishedRef.current = true
    const trimmed = text.trim()
    if (!allowEmpty && !trimmed) {
      onCancel()
      return
    }
    onCommit(text)
  }

  return (
    <div className="absolute inset-0 z-30 flex items-center px-1.5">
      <input
        ref={inputRef}
        type={type}
        lang={type === "date" ? "en-GB" : undefined}
        step={type === "number" ? "any" : undefined}
        value={text}
        placeholder={placeholder}
        onChange={(e) => setText(e.target.value)}
        onBlur={finishCommit}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault()
            finishCommit()
          } else if (e.key === "Escape") {
            e.preventDefault()
            finishedRef.current = true
            onCancel()
          } else if (e.key === "Tab" && !e.ctrlKey && !e.metaKey) {
            e.preventDefault()
            finishCommit()
            onTab(e.shiftKey)
          }
        }}
        className="w-full rounded border border-primary bg-card px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
      />
    </div>
  )
}

function CategoryBadge({
  categoryName,
  categoryDef,
}: {
  categoryName: string
  categoryDef?: ListCategory
}) {
  const CatIcon = categoryDef?.icon
    ? ICON_OPTIONS.find((o) => o.name === categoryDef.icon)?.icon || Tag
    : Tag

  return (
    <span
      className="inline-flex max-w-full items-center gap-1.5 rounded-md border px-2 py-0.5 text-xs font-medium"
      style={{
        color: categoryDef?.color || "var(--foreground)",
        borderColor: categoryDef?.color
          ? `color-mix(in oklch, ${categoryDef.color} 35%, transparent)`
          : "var(--border)",
        backgroundColor: categoryDef?.color
          ? `color-mix(in oklch, ${categoryDef.color} 12%, transparent)`
          : "var(--muted)",
      }}
    >
      <CatIcon className="h-3 w-3 shrink-0" />
      <span className="truncate">{categoryName}</span>
    </span>
  )
}

function SortableTableRow({
  item,
  canDrag,
  children,
}: {
  item: ListItem
  canDrag: boolean
  children: React.ReactNode
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: item.id, disabled: !canDrag })

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.45 : undefined,
    position: "relative",
    zIndex: isDragging ? 1 : 0,
  }

  const renderedChildren = React.Children.map(children, (child, index) => {
    if (index === 0 && React.isValidElement<{ children?: React.ReactNode }>(child)) {
      return React.cloneElement(child, {
        children: (
          <div className="flex items-center gap-1.5">
            <div
              {...(canDrag ? attributes : {})}
              {...(canDrag ? listeners : {})}
              onClick={(e) => e.stopPropagation()}
              title={canDrag ? "Drag to reorder" : "Clear sort to reorder"}
              className={cn(
                "shrink-0 p-0.5 transition-colors",
                canDrag
                  ? "cursor-grab active:cursor-grabbing text-muted-foreground/35 hover:text-muted-foreground touch-none"
                  : "cursor-default text-muted-foreground/15",
              )}
            >
              <GripVertical className="h-3.5 w-3.5" />
            </div>
            {child.props.children}
          </div>
        ),
      })
    }
    return child
  })

  return (
    <tr
      ref={setNodeRef}
      style={style}
      className="group border-b border-border/60 last:border-b-0 transition-colors hover:bg-muted/30 select-none"
    >
      {renderedChildren}
    </tr>
  )
}

function EmptyCell() {
  return <span className="font-mono text-xs text-muted-foreground/40">—</span>
}

export function ListTableView({
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
  onUpdateItem,
  onSelectCategory,
  onUpdateCustomField,
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
  onUpdateItem: (id: string, patch: Partial<ListItem>) => void
  onSelectCategory: (
    itemId: string,
    categoryId: string | null,
    newCategoryName?: string | null,
  ) => void
  onUpdateCustomField: (
    itemId: string,
    fieldId: string,
    value: string | number | null,
  ) => void
  onReorderItems: (activeId: string, overId: string, targetCategoryId?: string | null) => void
  onOpenAddField: () => void
  onOpenFieldsManager: () => void
  onPreviewImage: (url: string, title?: string) => void
}) {
  const isMobile = useIsMobile()
  const sortedFields = useMemo(
    () => [...fields].sort((a, b) => a.order - b.order),
    [fields],
  )

  const columnSpecs: DynamicColumnSpec[] = useMemo(
    () => [
      ...BUILTIN_COLUMNS.map((c) => ({
        key: c.key,
        defaultVisible: c.defaultVisible,
      })),
      ...sortedFields.map((f) => ({
        key: makeCustomColumnKey(f.id),
        defaultVisible: true,
      })),
    ],
    [sortedFields],
  )

  const storageKey = listId ? `velocity:list-table:${listId}:columns` : undefined
  const { order, visibility, toggle, reorder, reset } = useDynamicTableColumns(
    storageKey,
    columnSpecs,
  )

  const fieldMap = useMemo(() => {
    const map = new Map<string, ListField>()
    for (const f of sortedFields) map.set(f.id, f)
    return map
  }, [sortedFields])

  const validColumnSet = useMemo(
    () => new Set(columnSpecs.map((c) => c.key)),
    [columnSpecs],
  )

  const orderableKeys = useMemo(
    () => order.filter((k) => validColumnSet.has(k)),
    [order, validColumnSet],
  )
  const visibleColumns = useMemo(
    () => orderableKeys.filter((k) => visibility[k]),
    [orderableKeys, visibility],
  )

  const [sortConfig, setSortConfig] = useState<{
    key: string
    direction: "asc" | "desc"
  }>({ key: "order", direction: "asc" })

  const [dragColKey, setDragColKey] = useState<string | null>(null)
  const [dropColTarget, setDropColTarget] = useState<string | null>(null)

  const [selectedCell, setSelectedCell] = useState<{
    itemId: string
    column: string
  } | null>(null)
  const [editingCell, setEditingCell] = useState<{
    itemId: string
    column: string
  } | null>(null)
  const [openPopoverCell, setOpenPopoverCell] = useState<string | null>(null)
  const [categorySearch, setCategorySearch] = useState("")
  const cellRefs = useRef<Record<string, HTMLTableCellElement | null>>({})

  const getColumnLabel = useCallback(
    (key: string): string => {
      if (isCustomColumnKey(key)) {
        const f = fieldMap.get(getCustomFieldId(key))
        return f ? f.name : "Field"
      }
      return BUILTIN_MAP[key as BuiltInColumnKey]?.label ?? key
    },
    [fieldMap],
  )

  const getColumnField = useCallback(
    (key: string): ListField | undefined => {
      if (!isCustomColumnKey(key)) return undefined
      return fieldMap.get(getCustomFieldId(key))
    },
    [fieldMap],
  )

  const getHeaderClass = useCallback(
    (key: string): string => {
      if (key === "status") return "w-14"
      if (key === "description") return "min-w-[200px]"
      if (key === "category") return "min-w-[140px]"
      if (key === "details") return "min-w-[200px]"
      if (key === "date_created") return "w-24"
      const field = getColumnField(key)
      if (!field) return "min-w-[140px]"
      if (field.type === "number") return "min-w-[100px]"
      if (field.type === "image") return "min-w-[96px]"
      if (field.type === "date") return "min-w-[120px]"
      return "min-w-[140px]"
    },
    [getColumnField],
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

  const sortedItems = useMemo(() => {
    if (sortConfig.key === "order" && sortConfig.direction === "asc") {
      return [...items].sort((a, b) => a.order - b.order)
    }
    return [...items].sort((a, b) =>
      compareListItems(
        a,
        b,
        sortConfig.key,
        sortConfig.direction,
        categories,
        sortedFields,
      ),
    )
  }, [items, sortConfig, categories, sortedFields])

  const groupedItems = useMemo(() => {
    if (!isGrouped) return null
    const groups: Record<string, ListItem[]> = {}
    for (const item of sortedItems) {
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
  }, [isGrouped, sortedItems, categories, getCategoryDef])

  const flatOrderedItems = useMemo(() => {
    if (!groupedItems) return sortedItems
    return groupedItems.flatMap((g) => g.items)
  }, [groupedItems, sortedItems])

  // Reset sort if sorted column was deleted
  useEffect(() => {
    if (isCustomColumnKey(sortConfig.key) && !fieldMap.has(getCustomFieldId(sortConfig.key))) {
      setSortConfig({ key: "order", direction: "asc" })
    }
  }, [sortConfig.key, fieldMap])

  // Re-focus cell when exiting inline edit mode
  useEffect(() => {
    if (selectedCell && !editingCell && !openPopoverCell) {
      cellRefs.current[`${selectedCell.itemId}-${selectedCell.column}`]?.focus()
    }
  }, [selectedCell, editingCell, openPopoverCell])

  const handleSortClick = (key: string) => {
    setSortConfig((prev) => {
      if (prev.key !== key) return { key, direction: "asc" }
      if (prev.direction === "asc") return { key, direction: "desc" }
      return { key: "order", direction: "asc" }
    })
  }

  const navigateCell = useCallback(
    (
      itemId: string,
      column: string,
      rowOffset: number,
      colOffset: number,
      startEditing = false,
    ) => {
      const editableCols = visibleColumns.filter((k) => !READONLY_COLUMNS.has(k))
      const itemIdx = flatOrderedItems.findIndex((i) => i.id === itemId)
      const colIdx = editableCols.indexOf(column)
      if (itemIdx === -1 || colIdx === -1) return

      let nextRowIdx = itemIdx + rowOffset
      let nextColIdx = colIdx + colOffset

      if (colOffset !== 0 && rowOffset === 0) {
        if (nextColIdx >= editableCols.length) {
          nextColIdx = 0
          nextRowIdx++
        } else if (nextColIdx < 0) {
          nextColIdx = editableCols.length - 1
          nextRowIdx--
        }
      }

      if (
        nextRowIdx >= 0 &&
        nextRowIdx < flatOrderedItems.length &&
        nextColIdx >= 0 &&
        nextColIdx < editableCols.length
      ) {
        const nextItemId = flatOrderedItems[nextRowIdx].id
        const nextCol = editableCols[nextColIdx]
        setSelectedCell({ itemId: nextItemId, column: nextCol })
        if (startEditing) {
          if (nextCol === "category" || getColumnField(nextCol)?.type === "image") {
            setEditingCell(null)
            setOpenPopoverCell(`${nextItemId}:${nextCol}`)
          } else if (nextCol !== "status") {
            setEditingCell({ itemId: nextItemId, column: nextCol })
          }
        } else {
          setEditingCell(null)
        }
        setTimeout(() => {
          cellRefs.current[`${nextItemId}-${nextCol}`]?.focus()
        }, 0)
      } else {
        setSelectedCell(null)
        setEditingCell(null)
      }
    },
    [visibleColumns, flatOrderedItems, getColumnField],
  )

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  const canDragRows = sortConfig.key === "order" && sortConfig.direction === "asc"

  const handleDragEnd = (event: DragEndEvent) => {
    if (!canDragRows) return
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

  const startEditingCell = (itemId: string, key: string) => {
    if (READONLY_COLUMNS.has(key)) return
    setSelectedCell({ itemId, column: key })
    if (key === "status") {
      onToggleStatus(itemId)
      return
    }
    if (key === "category" || getColumnField(key)?.type === "image") {
      setEditingCell(null)
      setCategorySearch("")
      setOpenPopoverCell(`${itemId}:${key}`)
      return
    }
    setEditingCell({ itemId, column: key })
  }

  const clearCellValue = (item: ListItem, key: string) => {
    if (key === "details") {
      onUpdateItem(item.id, { details: null })
    } else if (key === "category") {
      onSelectCategory(item.id, null, null)
    } else if (isCustomColumnKey(key)) {
      onUpdateCustomField(item.id, getCustomFieldId(key), null)
    }
  }

  const renderCellContent = (item: ListItem, key: string) => {
    const isDone = item.status === "Done"
    const catDef = getCategoryDef(item)
    const cellPopoverKey = `${item.id}:${key}`
    const isPopoverOpen = openPopoverCell === cellPopoverKey

    if (key === "status") {
      return (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            onToggleStatus(item.id)
          }}
          aria-label={isDone ? "Mark as open" : "Mark as done"}
          className={cn(
            "flex h-4 w-4 shrink-0 items-center justify-center rounded-sm border transition-colors",
            isDone
              ? "border-primary bg-primary text-primary-foreground"
              : "border-muted-foreground text-transparent hover:border-primary",
          )}
        >
          {isDone && <Check className="h-3 w-3" />}
        </button>
      )
    }

    if (key === "description") {
      return (
        <div className="group/desc relative flex items-center gap-2 min-w-0">
          <span
            className={cn(
              "truncate text-sm font-medium",
              isDone ? "text-muted-foreground line-through" : "text-foreground",
            )}
          >
            {item.description}
          </span>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              onEditItem(item)
            }}
            className="ml-auto hidden group-hover/desc:inline-flex shrink-0 items-center gap-1 rounded border border-primary/40 bg-primary/5 px-1.5 py-0.5 text-[11px] font-semibold text-primary hover:bg-primary/10"
            title="Edit full item"
          >
            <Pencil className="h-3 w-3" />
            <span>Edit</span>
          </button>
        </div>
      )
    }

    if (key === "details") {
      return item.details ? (
        <span
          className={cn(
            "block max-w-[260px] truncate text-xs text-muted-foreground",
            isDone && "opacity-60",
          )}
        >
          {item.details}
        </span>
      ) : (
        <EmptyCell />
      )
    }

    if (key === "category") {
      const catName = catDef?.name || item.category || null
      return (
        <Popover
          open={isPopoverOpen}
          onOpenChange={(open) => {
            setOpenPopoverCell(open ? cellPopoverKey : null)
            if (open) setCategorySearch("")
          }}
        >
          <PopoverTrigger asChild>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                setSelectedCell({ itemId: item.id, column: key })
              }}
              className="flex max-w-full items-center text-left focus:outline-none"
            >
              {catName ? (
                <CategoryBadge categoryName={catName} categoryDef={catDef} />
              ) : (
                <span className="rounded px-1.5 py-0.5 text-xs text-muted-foreground/50 hover:bg-muted hover:text-muted-foreground">
                  —
                </span>
              )}
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-56 p-0" align="start">
            <Command>
              <CommandInput
                placeholder="Search or create..."
                value={categorySearch}
                onValueChange={setCategorySearch}
              />
              <CommandList>
                <CommandEmpty>
                  {categorySearch.trim() ? (
                    <button
                      type="button"
                      onClick={() => {
                        onSelectCategory(item.id, null, categorySearch.trim())
                        setOpenPopoverCell(null)
                      }}
                      className="flex w-full items-center gap-2 px-2 py-1.5 text-left text-sm hover:bg-muted"
                    >
                      <Plus className="h-3.5 w-3.5 text-muted-foreground" />
                      Create &ldquo;{categorySearch.trim()}&rdquo;
                    </button>
                  ) : (
                    <span className="block px-2 py-1.5 text-xs text-muted-foreground">
                      No categories
                    </span>
                  )}
                </CommandEmpty>
                <CommandGroup>
                  <CommandItem
                    value="__none__"
                    onSelect={() => {
                      onSelectCategory(item.id, null, null)
                      setOpenPopoverCell(null)
                    }}
                    className="flex items-center gap-2 text-muted-foreground"
                  >
                    <Circle className="h-3 w-3 opacity-40" />
                    None (No Category)
                    <Check
                      className={cn(
                        "ml-auto h-4 w-4",
                        !catDef && !item.category ? "opacity-100" : "opacity-0",
                      )}
                    />
                  </CommandItem>
                  {categories.map((c) => {
                    const CatIcon = c.icon
                      ? ICON_OPTIONS.find((o) => o.name === c.icon)?.icon || Tag
                      : Tag
                    const selected = catDef?.id === c.id
                    return (
                      <CommandItem
                        key={c.id}
                        value={c.name}
                        onSelect={() => {
                          onSelectCategory(item.id, c.id, null)
                          setOpenPopoverCell(null)
                        }}
                        className="flex items-center gap-2"
                      >
                        <div
                          className="flex h-5 w-5 shrink-0 items-center justify-center rounded-sm border"
                          style={{
                            color: c.color || "var(--muted-foreground)",
                            borderColor: c.color || "var(--border)",
                            backgroundColor: c.color
                              ? `color-mix(in oklch, ${c.color} 10%, transparent)`
                              : "var(--muted)",
                          }}
                        >
                          <CatIcon className="h-3 w-3" />
                        </div>
                        <span className="truncate">{c.name}</span>
                        <Check
                          className={cn(
                            "ml-auto h-4 w-4",
                            selected ? "opacity-100" : "opacity-0",
                          )}
                        />
                      </CommandItem>
                    )
                  })}
                  {categorySearch.trim() &&
                    !categories.some(
                      (c) => c.name.toLowerCase() === categorySearch.trim().toLowerCase(),
                    ) && (
                      <CommandItem
                        value={categorySearch.trim()}
                        onSelect={() => {
                          onSelectCategory(item.id, null, categorySearch.trim())
                          setOpenPopoverCell(null)
                        }}
                      >
                        <Plus className="mr-2 h-4 w-4 text-muted-foreground" />
                        Create &ldquo;{categorySearch.trim()}&rdquo;
                      </CommandItem>
                    )}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
      )
    }

    if (key === "date_created") {
      const d = new Date(item.date_created)
      return (
        <span className="inline-flex items-center gap-1 font-mono text-xs text-muted-foreground whitespace-nowrap">
          <Calendar className="h-3.5 w-3.5" />
          {Number.isNaN(d.getTime())
            ? "—"
            : d.toLocaleDateString(undefined, { month: "short", day: "numeric" })}
        </span>
      )
    }

    if (isCustomColumnKey(key)) {
      const field = getColumnField(key)
      if (!field) return <EmptyCell />
      const rawVal = sanitizeCustomFieldValue(field.type, item.custom_fields?.[field.id])

      if (field.type === "text") {
        return rawVal !== null ? (
          <span
            className={cn(
              "block max-w-[260px] truncate text-xs text-foreground",
              isDone && "opacity-60",
            )}
          >
            {String(rawVal)}
          </span>
        ) : (
          <EmptyCell />
        )
      }

      if (field.type === "number") {
        return rawVal !== null ? (
          <span
            className={cn(
              "font-mono text-xs tabular-nums text-foreground",
              isDone && "opacity-60",
            )}
          >
            {formatNumberValue(rawVal)}
          </span>
        ) : (
          <EmptyCell />
        )
      }

      if (field.type === "link") {
        if (rawVal === null) return <EmptyCell />
        const strVal = String(rawVal)
        const safeHref = getSafeHref(strVal)
        const preview = getMatchingLinkPreview(item, field.id)
        const displayLabel = preview?.title || formatLinkLabel(strVal)
        return (
          <div className="group/link flex items-center gap-1.5 min-w-0 max-w-[240px]">
            {safeHref ? (
              <a
                href={safeHref}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="inline-flex min-w-0 items-center gap-1 text-xs font-medium text-primary hover:underline"
                title={preview?.title ? `${preview.title} (${safeHref})` : safeHref}
              >
                <Link2 className="h-3 w-3 shrink-0" />
                <span className="truncate">{displayLabel}</span>
                <ExternalLink className="h-3 w-3 shrink-0 opacity-70" />
              </a>
            ) : (
              <span className="truncate text-xs text-muted-foreground">{strVal}</span>
            )}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                startEditingCell(item.id, key)
              }}
              className="ml-auto hidden group-hover/link:inline-flex h-5 w-5 shrink-0 items-center justify-center rounded text-muted-foreground hover:bg-muted hover:text-foreground"
              title="Edit link"
            >
              <Pencil className="h-3 w-3" />
            </button>
          </div>
        )
      }

      if (field.type === "date") {
        const formatted = rawVal !== null ? formatDateValue(rawVal) : ""
        return formatted ? (
          <span
            className={cn(
              "inline-flex items-center gap-1 font-mono text-xs text-muted-foreground whitespace-nowrap",
              isDone && "opacity-60",
            )}
            title={formatDateValue(rawVal, true)}
          >
            <Calendar className="h-3.5 w-3.5 shrink-0" />
            {formatted}
          </span>
        ) : (
          <EmptyCell />
        )
      }

      if (field.type === "image") {
        const strVal = rawVal !== null ? String(rawVal) : null
        return (
          <div className="group/img flex items-center gap-1.5">
            {strVal && (
              <ImageThumbnail
                src={strVal}
                alt={`${item.description} - ${field.name}`}
                onClick={(e) => {
                  e.stopPropagation()
                  onPreviewImage(strVal, `${item.description} (${field.name})`)
                }}
                className="h-9 w-9 shrink-0 cursor-zoom-in transition-transform hover:scale-105"
              />
            )}
            <Popover
              open={isPopoverOpen}
              onOpenChange={(open) => setOpenPopoverCell(open ? cellPopoverKey : null)}
            >
              <PopoverTrigger asChild>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    setSelectedCell({ itemId: item.id, column: key })
                  }}
                  title={strVal ? "Change image" : "Add image"}
                  className={cn(
                    "inline-flex items-center justify-center rounded border transition-colors",
                    strVal
                      ? "h-6 w-6 border-transparent text-muted-foreground opacity-0 group-hover/img:opacity-100 focus:opacity-100 hover:border-border hover:bg-muted hover:text-foreground"
                      : "h-7 w-7 border-dashed border-border text-muted-foreground/70 hover:bg-muted hover:text-foreground",
                  )}
                >
                  {strVal ? (
                    <Pencil className="h-3 w-3" />
                  ) : (
                    <ImagePlus className="h-3.5 w-3.5" />
                  )}
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-72 p-3" align="start">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-xs font-semibold text-foreground">{field.name}</span>
                  <button
                    type="button"
                    onClick={() => setOpenPopoverCell(null)}
                    className="rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
                <ImageFieldInput
                  compact
                  value={strVal}
                  onPreview={(url) => onPreviewImage(url, `${item.description} (${field.name})`)}
                  onChange={(nextUrl) => {
                    onUpdateCustomField(item.id, field.id, nextUrl)
                    setOpenPopoverCell(null)
                  }}
                />
              </PopoverContent>
            </Popover>
          </div>
        )
      }
    }

    return <EmptyCell />
  }

  const renderInlineEditor = (item: ListItem, key: string) => {
    const sharedTab = (reverse: boolean) => {
      navigateCell(item.id, key, 0, reverse ? -1 : 1, false)
    }

    if (key === "description") {
      return (
        <InlineCellTextInput
          value={item.description}
          allowEmpty={false}
          onCommit={(val) => {
            onUpdateItem(item.id, { description: val.trim() })
            setEditingCell(null)
          }}
          onCancel={() => setEditingCell(null)}
          onTab={sharedTab}
        />
      )
    }

    if (key === "details") {
      return (
        <InlineCellTextInput
          value={item.details ?? ""}
          allowEmpty={true}
          placeholder="Add details..."
          onCommit={(val) => {
            onUpdateItem(item.id, { details: val.trim() || null })
            setEditingCell(null)
          }}
          onCancel={() => setEditingCell(null)}
          onTab={sharedTab}
        />
      )
    }

    if (isCustomColumnKey(key)) {
      const field = getColumnField(key)
      if (!field) return null
      const currentVal = sanitizeCustomFieldValue(field.type, item.custom_fields?.[field.id])
      const strVal = currentVal !== null ? String(currentVal) : ""

      if (field.type === "number") {
        return (
          <InlineCellTextInput
            type="number"
            value={strVal}
            allowEmpty={true}
            placeholder="0"
            onCommit={(val) => {
              onUpdateCustomField(
                item.id,
                field.id,
                sanitizeCustomFieldValue("number", val),
              )
              setEditingCell(null)
            }}
            onCancel={() => setEditingCell(null)}
            onTab={sharedTab}
          />
        )
      }

      if (field.type === "link") {
        return (
          <InlineCellTextInput
            type="url"
            value={strVal}
            allowEmpty={true}
            placeholder="https://..."
            onCommit={(val) => {
              onUpdateCustomField(
                item.id,
                field.id,
                sanitizeCustomFieldValue("link", val),
              )
              setEditingCell(null)
            }}
            onCancel={() => setEditingCell(null)}
            onTab={sharedTab}
          />
        )
      }

      if (field.type === "date") {
        return (
          <InlineCellTextInput
            type="date"
            value={normalizeDateValue(currentVal) ?? ""}
            allowEmpty={true}
            onCommit={(val) => {
              onUpdateCustomField(
                item.id,
                field.id,
                sanitizeCustomFieldValue("date", val),
              )
              setEditingCell(null)
            }}
            onCancel={() => setEditingCell(null)}
            onTab={sharedTab}
          />
        )
      }

      if (field.type === "text") {
        return (
          <InlineCellTextInput
            type="text"
            value={strVal}
            allowEmpty={true}
            placeholder={`Enter ${field.name}...`}
            onCommit={(val) => {
              onUpdateCustomField(
                item.id,
                field.id,
                sanitizeCustomFieldValue("text", val),
              )
              setEditingCell(null)
            }}
            onCancel={() => setEditingCell(null)}
            onTab={sharedTab}
          />
        )
      }
    }

    return null
  }

  const renderItemRow = (item: ListItem) => {
    const isDone = item.status === "Done"

    return (
      <SortableTableRow key={item.id} item={item} canDrag={canDragRows}>
        {visibleColumns.map((key) => {
          const isEditable = !READONLY_COLUMNS.has(key)
          const isSelected =
            selectedCell?.itemId === item.id && selectedCell?.column === key
          const isEditingThis =
            editingCell?.itemId === item.id && editingCell?.column === key
          const field = getColumnField(key)

          return (
            <td
              key={key}
              ref={(el) => {
                cellRefs.current[`${item.id}-${key}`] = el
              }}
              tabIndex={isEditable ? 0 : -1}
              onFocus={() => {
                if (isEditable && !isSelected) {
                  setSelectedCell({ itemId: item.id, column: key })
                }
              }}
              onClick={(e) => {
                if (!isEditable) return
                e.stopPropagation()
                if (isMobile) {
                  startEditingCell(item.id, key)
                  return
                }
                setSelectedCell({ itemId: item.id, column: key })
              }}
              onDoubleClick={(e) => {
                if (!isEditable || key === "status") return
                e.stopPropagation()
                startEditingCell(item.id, key)
              }}
              onKeyDown={(e) => {
                if (!isSelected || isEditingThis) return

                if (
                  e.key.length === 1 &&
                  !e.ctrlKey &&
                  !e.metaKey &&
                  !e.altKey
                ) {
                  if (key === "status" && e.key === " ") {
                    e.preventDefault()
                    onToggleStatus(item.id)
                  } else if (
                    key !== "status" &&
                    key !== "category" &&
                    field?.type !== "image"
                  ) {
                    startEditingCell(item.id, key)
                  }
                  return
                }

                if (e.key === "ArrowRight") {
                  e.preventDefault()
                  navigateCell(item.id, key, 0, 1)
                } else if (e.key === "ArrowLeft") {
                  e.preventDefault()
                  navigateCell(item.id, key, 0, -1)
                } else if (e.key === "ArrowDown") {
                  e.preventDefault()
                  navigateCell(item.id, key, 1, 0)
                } else if (e.key === "ArrowUp") {
                  e.preventDefault()
                  navigateCell(item.id, key, -1, 0)
                } else if (e.key === "Tab" && !e.ctrlKey && !e.metaKey) {
                  e.preventDefault()
                  navigateCell(item.id, key, 0, e.shiftKey ? -1 : 1)
                } else if (e.key === "Enter") {
                  e.preventDefault()
                  startEditingCell(item.id, key)
                } else if (e.key === "Backspace" || e.key === "Delete") {
                  e.preventDefault()
                  clearCellValue(item, key)
                }
              }}
              className={cn(
                "relative px-3 py-2 align-middle outline-none transition-shadow",
                dropColTarget === key && dragColKey !== key && "bg-primary/5",
                isEditable && "cursor-cell",
                isSelected && "ring-2 ring-inset ring-primary z-20",
                isEditingThis && "bg-background shadow-md",
              )}
            >
              {isEditingThis ? renderInlineEditor(item, key) : renderCellContent(item, key)}
            </td>
          )
        })}

        {/* Row actions */}
        <td className="w-10 px-2 py-2 text-right align-middle">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                onClick={(e) => e.stopPropagation()}
                className="inline-flex h-6 w-6 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                aria-label="Row actions"
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
        </td>
      </SortableTableRow>
    )
  }

  return (
    <div className="overflow-hidden rounded-lg border border-border bg-card">
      {/* Table toolbar (matching TasksTable) */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-3 py-2">
        <div className="flex items-center gap-2">
          <span className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
            {sortedItems.length} {sortedItems.length === 1 ? "item" : "items"}
            {sortedItems.length !== allItemsCount ? ` of ${allItemsCount}` : ""}
          </span>
          {sortConfig.key !== "order" && (
            <button
              type="button"
              onClick={() => setSortConfig({ key: "order", direction: "asc" })}
              className="inline-flex items-center gap-1 rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary transition-colors hover:bg-primary/20"
              title="Reset to manual order"
            >
              <span>Sorted by {getColumnLabel(sortConfig.key)}</span>
              <X className="h-3 w-3" />
            </button>
          )}
        </div>

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
                <Columns3 className="h-3.5 w-3.5" />
                <span>Columns</span>
                <span className="ml-0.5 rounded bg-muted px-1.5 font-mono text-xs text-muted-foreground">
                  {visibleColumns.length}/{orderableKeys.length}
                </span>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-60">
              <DropdownMenuLabel className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
                Toggle columns
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              {orderableKeys.map((key) => {
                const field = getColumnField(key)
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
                      <span className="truncate">{getColumnLabel(key)}</span>
                    </span>
                  </DropdownMenuCheckboxItem>
                )
              })}
              <DropdownMenuSeparator />
              <div className="px-2 py-1.5 text-xs leading-relaxed text-muted-foreground">
                Drag column headers to reorder. Order &amp; visibility are saved per device.
              </div>
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={onOpenAddField} className="text-xs font-medium text-primary">
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

      {/* Table body */}
      {sortedItems.length === 0 ? (
        <div className="flex flex-col items-center justify-center px-6 py-12 text-center">
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
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead className="sticky top-0 z-10 bg-card">
                <tr className="border-b border-border">
                  {visibleColumns.map((key) => {
                    const label = getColumnLabel(key)
                    const field = getColumnField(key)
                    const isDragging = dragColKey === key
                    const isDropTarget = dropColTarget === key && dragColKey !== key
                    const isSorted = sortConfig.key === key

                    return (
                      <th
                        key={key}
                        scope="col"
                        onDragOver={(e) => {
                          if (!dragColKey || dragColKey === key) return
                          e.preventDefault()
                          e.dataTransfer.dropEffect = "move"
                          if (dropColTarget !== key) setDropColTarget(key)
                        }}
                        onDragLeave={() => {
                          if (dropColTarget === key) setDropColTarget(null)
                        }}
                        onDrop={(e) => {
                          e.preventDefault()
                          if (dragColKey && dragColKey !== key) {
                            reorder(dragColKey, key)
                          }
                          setDragColKey(null)
                          setDropColTarget(null)
                        }}
                        onClick={() => handleSortClick(key)}
                        className={cn(
                          "relative px-3 py-2 text-left font-mono text-xs font-medium uppercase tracking-wider text-muted-foreground transition-colors cursor-pointer select-none hover:bg-muted/50",
                          getHeaderClass(key),
                          isDragging && "opacity-40",
                          isDropTarget && "bg-primary/10",
                          isSorted && "text-foreground",
                        )}
                      >
                        {isDropTarget && (
                          <span
                            aria-hidden
                            className="pointer-events-none absolute inset-y-0 left-0 w-0.5 bg-primary"
                          />
                        )}
                        <div
                          draggable
                          onDragStart={(e) => {
                            setDragColKey(key)
                            e.dataTransfer.effectAllowed = "move"
                            e.dataTransfer.setData("text/plain", key)
                          }}
                          onDragEnd={() => {
                            setDragColKey(null)
                            setDropColTarget(null)
                          }}
                          title="Click to sort, drag to reorder"
                          className={cn(
                            "flex w-full items-center gap-1.5",
                            isDragging && "cursor-grabbing",
                          )}
                        >
                          {field && (
                            <FieldTypeIcon
                              type={field.type}
                              className="h-3 w-3 shrink-0 opacity-70"
                            />
                          )}
                          <span className="truncate">{label}</span>
                          {isSorted && (
                            <span className="ml-0.5 shrink-0 text-xs text-primary">
                              {sortConfig.direction === "asc" ? "↑" : "↓"}
                            </span>
                          )}
                        </div>
                      </th>
                    )
                  })}
                  <th className="w-10 px-2 py-2 text-right align-middle">
                    <button
                      type="button"
                      onClick={onOpenAddField}
                      title="Add field"
                      aria-label="Add field"
                      className="inline-flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                    >
                      <Plus className="h-3.5 w-3.5" />
                    </button>
                  </th>
                </tr>
              </thead>

              <SortableContext
                items={flatOrderedItems.map((i) => i.id)}
                strategy={verticalListSortingStrategy}
              >
                <tbody className="bg-card">
                  {groupedItems ? (
                    groupedItems.map((group) => {
                      const CatIcon = group.catDef?.icon
                        ? ICON_OPTIONS.find((o) => o.name === group.catDef?.icon)?.icon
                        : undefined
                      return (
                        <React.Fragment key={group.id}>
                          <tr className="border-b border-border bg-muted/30">
                            <td colSpan={visibleColumns.length + 1} className="px-3 py-2">
                              <div className="flex items-center justify-between gap-2">
                                <div className="flex items-center gap-2">
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
                                  <span className="text-xs font-semibold text-foreground">
                                    {group.name}
                                  </span>
                                  <span className="font-mono text-xs text-muted-foreground">
                                    {group.items.length}
                                  </span>
                                </div>
                                {filter !== "done" && !atLimit && (
                                  <button
                                    type="button"
                                    onClick={() =>
                                      onAddItem(group.id === "none" ? null : group.id)
                                    }
                                    className="inline-flex items-center gap-1 rounded bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary transition-colors hover:bg-primary/20"
                                  >
                                    <Plus className="h-3 w-3" />
                                    Add item
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                          {group.items.map(renderItemRow)}
                        </React.Fragment>
                      )
                    })
                  ) : (
                    flatOrderedItems.map(renderItemRow)
                  )}
                </tbody>
              </SortableContext>
            </table>
          </div>
        </DndContext>
      )}

      {/* Bottom quick add row */}
      {!isGrouped && filter !== "done" && !atLimit && sortedItems.length > 0 && (
        <button
          type="button"
          onClick={() => onAddItem(null)}
          className="flex w-full items-center gap-2 border-t border-border/60 px-3 py-2.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted/40 hover:text-foreground"
        >
          <Plus className="h-3.5 w-3.5" />
          Add item
        </button>
      )}
    </div>
  )
}
