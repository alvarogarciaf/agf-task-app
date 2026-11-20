"use client"
import { ICON_OPTIONS, COLOR_PALETTE } from "@/lib/constants"

import React, { useState, useRef, useCallback, useEffect, useMemo } from "react"
import { nanoid } from "nanoid"
import {
  DndContext,
  closestCenter,
  PointerSensor,
  TouchSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core"
import {
  SortableContext,
  arrayMove,
  verticalListSortingStrategy,
  useSortable,
  sortableKeyboardCoordinates,
} from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import {
  GripVertical,
  Plus,
  Circle,
  MoreVertical,
  Trash2,
  Pencil,
  RotateCcw,
  Columns3,
  Settings2,
  Check,
  Tag,
  ChevronsUpDown,
  List,
  LayoutGrid,
  Table2,
  SlidersHorizontal,
  Link2,
  ExternalLink,
  Calendar,
} from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Command, CommandInput, CommandList, CommandEmpty, CommandGroup, CommandItem } from "@/components/ui/command"
import { IconPicker } from "@/components/icon-picker"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { useDatabase } from "@/components/db-provider"
import { useIsMobile } from "@/hooks/use-mobile"
import { cn } from "@/lib/utils"
import { fetchLinkPreviewMetadata } from "@/lib/link-preview-client"
import {
  cleanCustomFields,
  cleanLinkPreviews,
  formatDateValue,
  formatLinkLabel,
  formatNumberValue,
  getMatchingLinkPreview,
  getSafeHref,
  reconcileItemLinkPreviews,
  sanitizeCustomFieldValue,
} from "@/lib/list-field-utils"
import {
  AddFieldDialog,
  DateFieldInput,
  FieldTypeIcon,
  FieldsManagerModal,
  ImageFieldInput,
  ImageLightboxDialog,
  ImageThumbnail,
} from "@/components/list-field-inputs"
import { ListCardsView } from "@/components/list-cards-view"
import { ListTableView } from "@/components/list-table-view"
import type { LinkFieldPreview, ListItem, ListCategory, ListField } from "@/lib/types"

const MAX_ITEMS = 200

// ─── SortableListRow ────────────────────────────────────────────────────────

function SortableListRow({
  item,
  categoryDef,
  showCategoryIcon,
  fields = [],
  onToggleStatus,
  onDelete,
  onEdit,
  onPreviewImage,
}: {
  item: ListItem
  categoryDef?: ListCategory
  showCategoryIcon?: boolean
  fields?: ListField[]
  onToggleStatus: (id: string) => void
  onDelete: (id: string) => void
  onEdit: () => void
  onPreviewImage?: (url: string, title?: string) => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: item.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : undefined,
    position: "relative" as const,
    zIndex: isDragging ? 1 : 0,
  }

  const [menuOpen, setMenuOpen] = useState(false)
  const isDone = item.status === "Done"

  const CatIcon = categoryDef?.icon ? ICON_OPTIONS.find(o => o.name === categoryDef?.icon)?.icon || Tag : Tag

  const populatedMetaFields = useMemo(() => {
    if (!fields.length || !item.custom_fields) return []
    const entries: { field: ListField; value: string | number }[] = []
    for (const field of fields) {
      if (field.type === "image") continue
      const val = sanitizeCustomFieldValue(field.type, item.custom_fields[field.id])
      if (val !== null) entries.push({ field, value: val })
    }
    return entries
  }, [fields, item.custom_fields])

  const populatedImageFields = useMemo(() => {
    if (!fields.length || !item.custom_fields) return []
    const entries: { field: ListField; value: string }[] = []
    for (const field of fields) {
      if (field.type !== "image") continue
      const val = sanitizeCustomFieldValue("image", item.custom_fields[field.id])
      if (typeof val === "string") entries.push({ field, value: val })
    }
    return entries
  }, [fields, item.custom_fields])

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "group flex items-start gap-2 rounded-lg border bg-card p-2 transition-colors",
        isDone ? "border-muted/50 bg-muted/20" : "border-border shadow-sm",
        menuOpen && "border-primary/50 shadow-md",
      )}
    >
      <div
        {...attributes}
        {...listeners}
        className="mt-0.5 flex cursor-grab items-center justify-center text-muted-foreground opacity-30 hover:opacity-100 active:cursor-grabbing"
      >
        <GripVertical className="h-4 w-4" />
      </div>

      <button
        type="button"
        onClick={() => onToggleStatus(item.id)}
        className={cn(
          "mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-sm border transition-colors",
          isDone
            ? "border-primary bg-primary text-primary-foreground"
            : "border-muted-foreground text-transparent hover:border-primary",
        )}
      >
        {isDone && <Check className="h-3 w-3" />}
      </button>

      <div className="flex min-w-0 flex-1 flex-col">
        <span
          className={cn(
            "truncate text-sm font-medium leading-tight cursor-pointer hover:text-primary transition-colors",
            isDone ? "text-muted-foreground line-through" : "text-foreground",
          )}
          onClick={onEdit}
        >
          {item.description}
        </span>
        {item.details && (
          <span
            className={cn(
              "mt-0.5 truncate text-xs text-muted-foreground",
              isDone && "opacity-60"
            )}
          >
            {item.details}
          </span>
        )}
        {populatedMetaFields.length > 0 && (
          <div
            className={cn(
              "mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1",
              isDone && "opacity-65",
            )}
          >
            {populatedMetaFields.map(({ field, value }) => {
              if (field.type === "number") {
                return (
                  <span
                    key={field.id}
                    className="inline-flex items-center gap-1 rounded bg-muted/60 px-1.5 py-0.5 font-mono text-[11px] tabular-nums text-foreground/85"
                  >
                    <span className="font-sans text-muted-foreground">{field.name}:</span>
                    {formatNumberValue(value)}
                  </span>
                )
              }

              if (field.type === "date") {
                const formatted = formatDateValue(value)
                if (!formatted) return null
                return (
                  <span
                    key={field.id}
                    className="inline-flex items-center gap-1 rounded bg-muted/60 px-1.5 py-0.5 font-mono text-[11px] text-foreground/85"
                    title={`${field.name}: ${formatDateValue(value, true)}`}
                  >
                    <Calendar className="h-3 w-3 shrink-0 text-muted-foreground" />
                    <span className="font-sans text-muted-foreground">{field.name}:</span>
                    {formatted}
                  </span>
                )
              }

              if (field.type === "link") {
                const strVal = String(value)
                const safeHref = getSafeHref(strVal)
                if (safeHref) {
                  const preview = getMatchingLinkPreview(item, field.id)
                  const displayLabel = preview?.title || formatLinkLabel(strVal)
                  return (
                    <a
                      key={field.id}
                      href={safeHref}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="inline-flex max-w-[240px] items-center gap-1 text-xs font-medium text-primary hover:underline"
                      title={
                        preview?.title
                          ? `${field.name}: ${preview.title} (${safeHref})`
                          : `${field.name}: ${safeHref}`
                      }
                    >
                      <Link2 className="h-3 w-3 shrink-0" />
                      <span className="truncate">
                        {field.name}: {displayLabel}
                      </span>
                      <ExternalLink className="h-2.5 w-2.5 shrink-0 opacity-70" />
                    </a>
                  )
                }
              }

              return (
                <span
                  key={field.id}
                  className="inline-flex max-w-[220px] items-center gap-1 text-xs text-muted-foreground"
                  title={`${field.name}: ${String(value)}`}
                >
                  <span className="font-medium text-foreground/75 shrink-0">{field.name}:</span>
                  <span className="truncate">{String(value)}</span>
                </span>
              )
            })}
          </div>
        )}
      </div>

      {populatedImageFields.length > 0 && (
        <div className="flex items-center gap-1.5 shrink-0">
          {populatedImageFields.map(({ field, value }) => (
            <ImageThumbnail
              key={field.id}
              src={value}
              alt={`${item.description} - ${field.name}`}
              onClick={(e) => {
                e.stopPropagation()
                onPreviewImage?.(value, `${item.description} (${field.name})`)
              }}
              className="h-9 w-9 shrink-0 cursor-zoom-in transition-transform hover:scale-105"
            />
          ))}
        </div>
      )}

      {item.category && showCategoryIcon && (
        <div 
          className="mt-0.5 flex h-5 w-5 md:h-6 md:w-6 shrink-0 items-center justify-center rounded-sm border"
          style={{
            color: categoryDef?.color || "var(--muted-foreground)",
            borderColor: categoryDef?.color || "var(--border)",
            backgroundColor: categoryDef?.color ? `color-mix(in oklch, ${categoryDef.color} 10%, transparent)` : "var(--muted)"
          }}
          title={item.category}
        >
          <CatIcon className="h-3 w-3 md:h-4 md:w-4" />
        </div>
      )}

      <div onClick={(e) => e.stopPropagation()}>
        <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className={cn(
                "flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring",
                menuOpen && "bg-muted text-foreground",
              )}
            >
              <MoreVertical className="h-3.5 w-3.5" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-36">
            <DropdownMenuItem onClick={onEdit}>
              <Pencil className="mr-2 h-4 w-4 text-muted-foreground" />
              Edit
            </DropdownMenuItem>
            {isDone ? (
              <DropdownMenuItem onClick={() => onToggleStatus(item.id)}>
                <RotateCcw className="mr-2 h-4 w-4 text-muted-foreground" />
                Reopen
              </DropdownMenuItem>
            ) : (
              <DropdownMenuItem onClick={() => onToggleStatus(item.id)}>
                <Check className="mr-2 h-4 w-4 text-muted-foreground" />
                Done
              </DropdownMenuItem>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => onDelete(item.id)} className="text-destructive focus:bg-destructive/10">
              <Trash2 className="mr-2 h-4 w-4 text-destructive" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  )
}


// ─── ItemModal ──────────────────────────────────────────────────────────────

function ItemModal({
  open,
  onOpenChange,
  initialDescription = "",
  initialDetails = "",
  initialCategory = null,
  initialCustomFields = null,
  initialLinkPreviews = null,
  onSave,
  categories,
  fields = [],
  isEdit = false,
  items = [],
  onPreviewImage,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  initialDescription?: string
  initialDetails?: string | null
  initialCategory?: string | null
  initialCustomFields?: Record<string, string | number | null> | null
  initialLinkPreviews?: Record<string, LinkFieldPreview | null> | null
  onSave: (
    description: string,
    categoryId: string | null,
    details: string | null,
    newCategoryName?: string | null,
    existingItemId?: string,
    customFields?: Record<string, string | number | null> | null,
  ) => void
  categories: ListCategory[]
  fields?: ListField[]
  isEdit?: boolean
  items?: ListItem[]
  onPreviewImage?: (url: string, title?: string) => void
}) {
  const [desc, setDesc] = useState(initialDescription)
  const [details, setDetails] = useState(initialDetails || "")
  const [selectedCatId, setSelectedCatId] = useState<string | null>(null)
  const [newCatName, setNewCatName] = useState<string>("")
  const [catOpen, setCatOpen] = useState(false)
  const [catInput, setCatInput] = useState("")
  const [existingItemId, setExistingItemId] = useState<string | undefined>(undefined)
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [customFields, setCustomFields] = useState<Record<string, string | number | null>>({})

  useEffect(() => {
    if (open) {
      setDesc(initialDescription)
      setDetails(initialDetails || "")
      setExistingItemId(undefined)
      setShowSuggestions(false)
      setCustomFields(initialCustomFields ? { ...initialCustomFields } : {})
      if (initialCategory) {
        const found = categories.find((c) => c.id === initialCategory || c.name === initialCategory)
        if (found) {
          setSelectedCatId(found.id)
          setNewCatName("")
        } else {
          setSelectedCatId(null)
          setNewCatName(initialCategory)
        }
      } else {
        setSelectedCatId(null)
        setNewCatName("")
      }
      setCatInput("")
    }
  }, [open, initialDescription, initialDetails, initialCategory, initialCustomFields, categories])

  const handleSave = () => {
    if (!desc.trim()) return
    const sanitizedMap: Record<string, string | number | null> = {}
    for (const field of fields) {
      const val = sanitizeCustomFieldValue(field.type, customFields[field.id])
      if (val !== null) {
        sanitizedMap[field.id] = val
      }
    }
    const finalCustomFields = cleanCustomFields(sanitizedMap)
    onSave(
      desc.trim(),
      selectedCatId,
      details.trim() || null,
      newCatName.trim() || null,
      existingItemId,
      finalCustomFields,
    )
    onOpenChange(false)
  }

  const selectedCat = categories.find((c) => c.id === selectedCatId) || (newCatName ? { id: "temp", name: newCatName, color: undefined, icon: undefined } : null)

  const closedMatches = useMemo(() => {
    if (isEdit || !desc.trim()) return []
    const lower = desc.toLowerCase()
    return items.filter(i => i.status === "Done" && i.description.toLowerCase().includes(lower))
  }, [items, desc, isEdit])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit Item" : "Add Item"}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid gap-2 relative">
            <label className="text-sm font-medium">Item name</label>
            <input
              type="text"
              autoFocus
              value={desc}
              onFocus={() => setShowSuggestions(true)}
              onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
              onChange={(e) => {
                setDesc(e.target.value)
                setExistingItemId(undefined) // clear selection if typed manually
                setShowSuggestions(true)
              }}
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              placeholder="What needs to be done?"
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault()
                  handleSave()
                }
              }}
            />
            {showSuggestions && closedMatches.length > 0 && (
              <div className="absolute top-[100%] left-0 w-full z-50 mt-1 rounded-md border bg-popover text-popover-foreground shadow-md outline-none animate-in fade-in-0 zoom-in-95 max-h-48 overflow-y-auto overflow-x-hidden">
                {closedMatches.map(item => {
                   const selectClosedItem = () => {
                     setDesc(item.description)
                     setDetails(item.details || "")
                     setCustomFields(item.custom_fields ? { ...item.custom_fields } : {})
                     if (item.category_id) {
                       setSelectedCatId(item.category_id)
                       setNewCatName("")
                     } else if (item.category) {
                       setSelectedCatId(null)
                       setNewCatName(item.category)
                     } else {
                       setSelectedCatId(null)
                       setNewCatName("")
                     }
                     setExistingItemId(item.id)
                     setShowSuggestions(false)
                   }
                   return (
                     <button
                       key={item.id}
                       type="button"
                       className="w-full flex flex-col text-left px-3 py-2 text-sm hover:bg-muted cursor-pointer"
                       onPointerDown={(e) => {
                         // Prevent the input from blurring and select immediately on primary pointer/mouse/tap down
                         if (e.pointerType !== "touch" && e.button === 0) {
                           e.preventDefault()
                           selectClosedItem()
                         }
                       }}
                       onMouseDown={(e) => {
                         e.preventDefault()
                       }}
                       onClick={selectClosedItem}
                     >
                       <span className="font-medium truncate block">{item.description}</span>
                       {item.category && (
                         <span className="text-xs text-muted-foreground truncate block mt-0.5">Category: {item.category}</span>
                       )}
                     </button>
                   )
                })}
              </div>
            )}
          </div>
          <div className="grid gap-2">
            <label className="text-sm font-medium">Description (optional)</label>
            <textarea
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              className="flex min-h-[60px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              placeholder="Add more details..."
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault()
                  handleSave()
                }
              }}
            />
          </div>
          <div className="grid gap-2">
            <label className="text-sm font-medium">Category</label>
            <div className="relative">
              <Popover open={catOpen} onOpenChange={setCatOpen}>
                <PopoverTrigger asChild>
                  <button
                    type="button"
                    role="combobox"
                    aria-expanded={catOpen}
                    className="flex h-9 w-full items-center justify-between rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  >
                    {(() => {
                      if (!selectedCat) return <span className="text-muted-foreground">Select or create category...</span>
                      const SelectedIcon = selectedCat.icon ? ICON_OPTIONS.find((o) => o.name === selectedCat.icon)?.icon : Tag
                      const IconComp = SelectedIcon || Tag
                      return (
                        <div className="flex items-center gap-2">
                          <div 
                            className="flex h-5 w-5 shrink-0 items-center justify-center rounded-sm border"
                            style={{
                              color: selectedCat.color || "var(--muted-foreground)",
                              borderColor: selectedCat.color || "var(--border)",
                              backgroundColor: selectedCat.color ? `color-mix(in oklch, ${selectedCat.color} 10%, transparent)` : "var(--muted)"
                            }}
                          >
                            <IconComp className="h-3 w-3" />
                          </div>
                          {selectedCat.name}
                        </div>
                      )
                    })()}
                    <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
                  </button>
                </PopoverTrigger>
                <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                  <Command>
                    <CommandInput 
                      placeholder="Search or create..." 
                      value={catInput} 
                      onValueChange={setCatInput} 
                    />
                    <CommandList>
                      <CommandEmpty>
                        <button 
                          type="button" 
                          onClick={() => {
                            setSelectedCatId(null)
                            setNewCatName(catInput.trim())
                            setCatOpen(false)
                          }}
                          className="w-full text-left px-2 py-1.5 text-sm hover:bg-muted flex items-center gap-2"
                        >
                          <Plus className="h-3.5 w-3.5 text-muted-foreground" />
                          Create &ldquo;{catInput.trim()}&rdquo;
                        </button>
                      </CommandEmpty>
                      <CommandGroup>
                        <CommandItem
                          value="__none__"
                          onSelect={() => {
                            setSelectedCatId(null)
                            setNewCatName("")
                            setCatOpen(false)
                          }}
                          className="flex items-center gap-2 text-muted-foreground"
                        >
                          <Circle className="h-3 w-3 opacity-40" />
                          None (No Category)
                          <Check className={cn("ml-auto h-4 w-4", !selectedCatId && !newCatName ? "opacity-100" : "opacity-0")} />
                        </CommandItem>
                        {categories.map((c) => {
                          const CatIcon = c.icon ? ICON_OPTIONS.find((o) => o.name === c.icon)?.icon : undefined
                          const IconComp = CatIcon || Tag
                          return (
                            <CommandItem
                              key={c.id}
                              value={c.name}
                              onSelect={() => {
                                setSelectedCatId(c.id)
                                setNewCatName("")
                                setCatOpen(false)
                              }}
                              className="flex items-center gap-2"
                            >
                              <div 
                                className="flex h-5 w-5 shrink-0 items-center justify-center rounded-sm border"
                                style={{
                                  color: c.color || "var(--muted-foreground)",
                                  borderColor: c.color || "var(--border)",
                                  backgroundColor: c.color ? `color-mix(in oklch, ${c.color} 10%, transparent)` : "var(--muted)"
                                }}
                              >
                                <IconComp className="h-3 w-3" />
                              </div>
                              {c.name}
                              <Check className={cn("ml-auto h-4 w-4", selectedCatId === c.id ? "opacity-100" : "opacity-0")} />
                            </CommandItem>
                          )
                        })}
                        {catInput.trim() && !categories.some((c) => c.name.toLowerCase() === catInput.trim().toLowerCase()) && (
                          <CommandItem
                            value={catInput.trim()}
                            onSelect={() => {
                              setSelectedCatId(null)
                              setNewCatName(catInput.trim())
                              setCatOpen(false)
                            }}
                          >
                            <Plus className="mr-2 h-4 w-4 text-muted-foreground" />
                            Create &ldquo;{catInput.trim()}&rdquo;
                          </CommandItem>
                        )}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>
          </div>

          {fields.length > 0 && (
            <div className="border-t border-border pt-4 grid gap-3">
              {fields.map((field) => {
                const rawVal = customFields[field.id]
                const strVal = rawVal !== null && rawVal !== undefined ? String(rawVal) : ""
                const safeHref = field.type === "link" ? getSafeHref(strVal) : null

                return (
                  <div key={field.id} className="grid gap-1.5">
                    <label className="flex items-center gap-1.5 text-sm font-medium">
                      <FieldTypeIcon type={field.type} className="h-3.5 w-3.5 text-muted-foreground" />
                      <span>{field.name}</span>
                    </label>

                    {field.type === "text" && (
                      <input
                        type="text"
                        value={strVal}
                        onChange={(e) =>
                          setCustomFields((prev) => ({ ...prev, [field.id]: e.target.value }))
                        }
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault()
                            handleSave()
                          }
                        }}
                        placeholder={`Enter ${field.name}...`}
                        className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                      />
                    )}

                    {field.type === "number" && (
                      <input
                        type="number"
                        step="any"
                        inputMode="decimal"
                        value={strVal}
                        onChange={(e) =>
                          setCustomFields((prev) => ({ ...prev, [field.id]: e.target.value }))
                        }
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault()
                            handleSave()
                          }
                        }}
                        placeholder="0"
                        className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 font-mono text-sm tabular-nums shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                      />
                    )}

                    {field.type === "link" && (() => {
                      const savedPreview = initialLinkPreviews?.[field.id]
                      const previewMatches =
                        !!savedPreview &&
                        !!safeHref &&
                        getSafeHref(savedPreview.url) === safeHref &&
                        !!(savedPreview.title || savedPreview.imageUrl)

                      return (
                        <div className="flex flex-col gap-1.5">
                          <div className="flex items-center gap-1.5">
                            <input
                              type="url"
                              value={strVal}
                              onChange={(e) =>
                                setCustomFields((prev) => ({ ...prev, [field.id]: e.target.value }))
                              }
                              onKeyDown={(e) => {
                                if (e.key === "Enter") {
                                  e.preventDefault()
                                  handleSave()
                                }
                              }}
                              placeholder="https://example.com"
                              className="flex h-9 min-w-0 flex-1 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                            />
                            {safeHref && (
                              <a
                                href={safeHref}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-border text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                                title="Open link"
                              >
                                <ExternalLink className="h-4 w-4" />
                              </a>
                            )}
                          </div>
                          {previewMatches && savedPreview && (
                            <div className="flex items-center gap-2.5 rounded-md border border-border/70 bg-muted/30 px-2.5 py-1.5">
                              {savedPreview.imageUrl && (
                                <ImageThumbnail
                                  src={savedPreview.imageUrl}
                                  alt={savedPreview.title || field.name}
                                  onClick={() =>
                                    onPreviewImage?.(
                                      savedPreview.imageUrl!,
                                      savedPreview.title || field.name,
                                    )
                                  }
                                  className="h-9 w-9 shrink-0 cursor-zoom-in"
                                />
                              )}
                              <div className="min-w-0 flex-1">
                                {savedPreview.title && (
                                  <p className="truncate text-xs font-medium text-foreground">
                                    {savedPreview.title}
                                  </p>
                                )}
                                {savedPreview.domain && (
                                  <p className="truncate text-[11px] text-muted-foreground">
                                    {savedPreview.domain}
                                  </p>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      )
                    })()}

                    {field.type === "image" && (
                      <ImageFieldInput
                        value={strVal || null}
                        onPreview={(url) =>
                          onPreviewImage?.(url, `${desc.trim() || "Item"} (${field.name})`)
                        }
                        onChange={(nextUrl) =>
                          setCustomFields((prev) => ({ ...prev, [field.id]: nextUrl }))
                        }
                      />
                    )}

                    {field.type === "date" && (
                      <DateFieldInput
                        value={strVal || null}
                        onChange={(nextDate) =>
                          setCustomFields((prev) => ({ ...prev, [field.id]: nextDate }))
                        }
                      />
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
        <div className="flex items-center justify-end gap-2">
          <button type="button" onClick={() => onOpenChange(false)} className="rounded-md border px-4 py-2 text-sm font-medium transition-colors hover:bg-muted">Cancel</button>
          <button type="button" onClick={handleSave} className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow transition-colors hover:bg-primary/90">Save</button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ─── ListEditor (main export) ────────────────────────────────────────────────

export type ListViewMode = "list" | "cards" | "table"

type StatusFilter = "all" | "open" | "done"

export function ListEditor({
  listId,
  items,
  onChange,
  categories = [],
  onCategoriesChange = () => {},
  fields = [],
  onFieldsChange = () => {},
  onBatchChange,
  onBackgroundItemsUpdate,
  onViewModeChange,
}: {
  listId?: string
  items: ListItem[]
  onChange: (items: ListItem[]) => void
  categories?: ListCategory[]
  onCategoriesChange?: (cats: ListCategory[]) => void
  fields?: ListField[]
  onFieldsChange?: (fields: ListField[]) => void
  onBatchChange?: (patch: {
    list_items?: ListItem[]
    list_categories?: ListCategory[]
    list_fields?: ListField[]
  }) => void
  onBackgroundItemsUpdate?: (updater: (prevItems: ListItem[]) => ListItem[]) => void
  onViewModeChange?: (mode: ListViewMode) => void
}) {
  const db = useDatabase()
  const isMobile = useIsMobile()
  const [filter, setFilter] = useState<StatusFilter>("open")
  const [isGrouped, setIsGrouped] = useState(() => {
    if (typeof window !== "undefined" && listId) {
      const stored = localStorage.getItem(`list_grouped_${listId}`)
      if (stored !== null) return stored === "true"
    }
    return false
  })
  const [viewMode, setViewMode] = useState<ListViewMode>(() => {
    if (typeof window !== "undefined" && listId) {
      const stored = localStorage.getItem(`list_view_mode_${listId}`)
      if (stored === "table" || stored === "cards" || stored === "list") return stored
    }
    return "list"
  })

  const effectiveViewMode: ListViewMode = isMobile && viewMode === "table" ? "list" : viewMode

  useEffect(() => {
    if (listId) {
      localStorage.setItem(`list_grouped_${listId}`, isGrouped.toString())
    }
  }, [isGrouped, listId])

  useEffect(() => {
    if (listId) {
      localStorage.setItem(`list_view_mode_${listId}`, viewMode)
    }
  }, [viewMode, listId])

  useEffect(() => {
    onViewModeChange?.(effectiveViewMode)
  }, [effectiveViewMode, onViewModeChange])

  const [showCategoriesModal, setShowCategoriesModal] = useState(false)
  const [editingCategory, setEditingCategory] = useState<ListCategory | null>(null)
  const [showFieldsModal, setShowFieldsModal] = useState(false)
  const [showAddFieldModal, setShowAddFieldModal] = useState(false)
  const [lightboxImage, setLightboxImage] = useState<{ url: string; title?: string } | null>(null)

  // States for Item Modal
  const [addingToCategory, setAddingToCategory] = useState<string | null | undefined>(undefined)
  const [editingItem, setEditingItem] = useState<ListItem | null>(null)

  const sortedFields = useMemo(
    () => [...fields].sort((a, b) => a.order - b.order),
    [fields],
  )

  const commitBatch = useCallback(
    (patch: {
      list_items?: ListItem[]
      list_categories?: ListCategory[]
      list_fields?: ListField[]
    }) => {
      if (onBatchChange) {
        onBatchChange(patch)
        return
      }
      if (patch.list_categories !== undefined) onCategoriesChange(patch.list_categories)
      if (patch.list_fields !== undefined) onFieldsChange(patch.list_fields)
      if (patch.list_items !== undefined) onChange(patch.list_items)
    },
    [onBatchChange, onCategoriesChange, onFieldsChange, onChange],
  )

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  const getCategoryDef = useCallback(
    (item: ListItem) => {
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

  const resolveCategory = useCallback(
    (
      categoryId: string | null,
      newCategoryName?: string | null,
    ): { id: string | null; name: string | null; nextCategories?: ListCategory[] } => {
      if (newCategoryName && newCategoryName.trim()) {
        const trimmed = newCategoryName.trim()
        const existing = categories.find((c) => c.name.toLowerCase() === trimmed.toLowerCase())
        if (existing) {
          return { id: existing.id, name: existing.name }
        }
        const newCat: ListCategory = {
          id: nanoid(),
          name: trimmed,
          color: COLOR_PALETTE[categories.length % COLOR_PALETTE.length],
          icon: "Tag",
        }
        return { id: newCat.id, name: newCat.name, nextCategories: [...categories, newCat] }
      }
      if (categoryId) {
        const cat = categories.find((c) => c.id === categoryId)
        return { id: categoryId, name: cat ? cat.name : null }
      }
      return { id: null, name: null }
    },
    [categories],
  )

  const handleReorderItems = useCallback(
    (activeId: string, overId: string, targetCategoryId?: string | null) => {
      const oldIndex = items.findIndex((i) => i.id === activeId)
      const newIndex = items.findIndex((i) => i.id === overId)
      if (oldIndex === -1 || newIndex === -1) return

      let reordered = arrayMove(items, oldIndex, newIndex)

      if (targetCategoryId !== undefined) {
        const targetCatDef = targetCategoryId
          ? categories.find((c) => c.id === targetCategoryId)
          : undefined
        const resolvedId = targetCatDef ? targetCatDef.id : null
        const resolvedName = targetCatDef ? targetCatDef.name : null
        reordered = reordered.map((item) =>
          item.id === activeId
            ? { ...item, category_id: resolvedId, category: resolvedName }
            : item,
        )
      }

      onChange(reordered.map((item, idx) => ({ ...item, order: idx })))
    },
    [items, categories, onChange],
  )

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event
      if (!over || active.id === over.id) return
      const activeId = String(active.id)
      const overId = String(over.id)
      let targetCategoryId: string | null | undefined = undefined
      if (isGrouped) {
        const targetItem = items.find((i) => i.id === overId)
        if (targetItem) {
          const targetCatDef = getCategoryDef(targetItem)
          targetCategoryId = targetCatDef ? targetCatDef.id : null
        }
      }
      handleReorderItems(activeId, overId, targetCategoryId)
    },
    [items, isGrouped, getCategoryDef, handleReorderItems],
  )

  const handleToggleStatus = useCallback(
    (id: string) => {
      onChange(
        items.map((item) =>
          item.id === id ? { ...item, status: item.status === "Done" ? "Open" : "Done" } : item,
        ),
      )
    },
    [items, onChange],
  )

  const handleDelete = useCallback(
    (id: string) => {
      onChange(items.filter((item) => item.id !== id))
    },
    [items, onChange],
  )

  const handleUpdateItem = useCallback(
    (id: string, patch: Partial<ListItem>) => {
      onChange(items.map((item) => (item.id === id ? { ...item, ...patch } : item)))
    },
    [items, onChange],
  )

  const handleSelectItemCategory = useCallback(
    (itemId: string, categoryId: string | null, newCategoryName?: string | null) => {
      const { id: finalCatId, name: finalCatName, nextCategories } = resolveCategory(
        categoryId,
        newCategoryName,
      )
      const nextItems = items.map((item) =>
        item.id === itemId
          ? { ...item, category_id: finalCatId, category: finalCatName }
          : item,
      )
      if (nextCategories) {
        commitBatch({ list_categories: nextCategories, list_items: nextItems })
      } else {
        onChange(nextItems)
      }
    },
    [items, resolveCategory, commitBatch, onChange],
  )

  const handleUpdateItemCustomField = useCallback(
    (itemId: string, fieldId: string, value: string | number | null) => {
      const field = fields.find((f) => f.id === fieldId)
      const sanitized = field ? sanitizeCustomFieldValue(field.type, value) : value
      onChange(
        items.map((item) => {
          if (item.id !== itemId) return item
          const nextMap: Record<string, string | number | null> = {
            ...(item.custom_fields || {}),
          }
          if (sanitized === null || sanitized === undefined || sanitized === "") {
            delete nextMap[fieldId]
          } else {
            nextMap[fieldId] = sanitized
          }
          const cleanedCustomFields = cleanCustomFields(nextMap)
          if (field?.type === "link") {
            return {
              ...item,
              custom_fields: cleanedCustomFields,
              link_previews: reconcileItemLinkPreviews(
                item,
                cleanedCustomFields,
                fields,
              ),
            }
          }
          return { ...item, custom_fields: cleanedCustomFields }
        }),
      )
    },
    [fields, items, onChange],
  )

  const handleRename = useCallback(
    (
      id: string,
      description: string,
      categoryId: string | null,
      details: string | null = null,
      newCategoryName?: string | null,
      customFields?: Record<string, string | number | null> | null,
    ) => {
      const { id: finalCatId, name: finalCatName, nextCategories } = resolveCategory(
        categoryId,
        newCategoryName,
      )
      const cleanedCustomFields = cleanCustomFields(customFields)
      const nextItems = items.map((item) =>
        item.id === id
          ? {
              ...item,
              description,
              category_id: finalCatId,
              category: finalCatName,
              details,
              custom_fields: cleanedCustomFields,
              link_previews: reconcileItemLinkPreviews(
                item,
                cleanedCustomFields,
                fields,
              ),
            }
          : item,
      )
      if (nextCategories) {
        commitBatch({ list_categories: nextCategories, list_items: nextItems })
      } else {
        onChange(nextItems)
      }
    },
    [items, fields, onChange, resolveCategory, commitBatch],
  )

  const handleAdd = useCallback(
    (
      description: string,
      categoryId: string | null = null,
      details: string | null = null,
      newCategoryName?: string | null,
      existingItemId?: string,
      customFields?: Record<string, string | number | null> | null,
    ) => {
      const { id: finalCatId, name: finalCatName, nextCategories } = resolveCategory(
        categoryId,
        newCategoryName,
      )
      const cleanedCustomFields = cleanCustomFields(customFields)

      if (existingItemId) {
        const nextItems = items.map((item) =>
          item.id === existingItemId
            ? {
                ...item,
                status: "Open" as const,
                description,
                category_id: finalCatId,
                category: finalCatName,
                details,
                custom_fields: cleanedCustomFields,
                link_previews: reconcileItemLinkPreviews(
                  item,
                  cleanedCustomFields,
                  fields,
                ),
              }
            : item,
        )
        if (nextCategories) {
          commitBatch({ list_categories: nextCategories, list_items: nextItems })
        } else {
          onChange(nextItems)
        }
        setAddingToCategory(undefined)
        return
      }

      if (items.length >= MAX_ITEMS) return
      const now = new Date().toISOString()

      const newItem: ListItem = {
        id: nanoid(),
        description,
        status: "Open",
        order: items.length,
        date_created: now,
        category_id: finalCatId,
        category: finalCatName,
        details,
        custom_fields: cleanedCustomFields,
        link_previews: null,
      }
      const nextItems = [...items, newItem]
      if (nextCategories) {
        commitBatch({ list_categories: nextCategories, list_items: nextItems })
      } else {
        onChange(nextItems)
      }
      setAddingToCategory(undefined)
    },
    [items, fields, onChange, resolveCategory, commitBatch],
  )

  const handleAddField = useCallback(
    (field: ListField) => {
      onFieldsChange([...fields, field])
    },
    [fields, onFieldsChange],
  )

  const handleRenameField = useCallback(
    (fieldId: string, name: string) => {
      onFieldsChange(fields.map((f) => (f.id === fieldId ? { ...f, name } : f)))
    },
    [fields, onFieldsChange],
  )

  const handleReorderFields = useCallback(
    (reordered: ListField[]) => {
      onFieldsChange(reordered.map((f, idx) => ({ ...f, order: idx })))
    },
    [onFieldsChange],
  )

  const handleDeleteField = useCallback(
    (fieldId: string) => {
      const nextFields = fields
        .filter((f) => f.id !== fieldId)
        .map((f, idx) => ({ ...f, order: idx }))
      const allowedIds = new Set(nextFields.map((f) => f.id))
      const nextItems = items.map((item) => {
        const hasCustom = !!item.custom_fields && fieldId in item.custom_fields
        const hasPreview = !!item.link_previews && fieldId in item.link_previews
        if (!hasCustom && !hasPreview) return item

        let nextCustom = item.custom_fields ?? null
        if (hasCustom && item.custom_fields) {
          const nextMap = { ...item.custom_fields }
          delete nextMap[fieldId]
          nextCustom = cleanCustomFields(nextMap, allowedIds)
        }

        let nextPreviews = item.link_previews ?? null
        if (hasPreview && item.link_previews) {
          const nextPreviewMap = { ...item.link_previews }
          delete nextPreviewMap[fieldId]
          nextPreviews = cleanLinkPreviews(nextPreviewMap, allowedIds)
        }

        return {
          ...item,
          custom_fields: nextCustom,
          link_previews: nextPreviews,
        }
      })
      commitBatch({ list_fields: nextFields, list_items: nextItems })
    },
    [fields, items, commitBatch],
  )

  // Background metadata enrichment for link-type custom fields
  const isMountedRef = useRef(true)
  const latestItemsRef = useRef(items)
  const latestFieldsRef = useRef(fields)
  const onChangeRef = useRef(onChange)
  const onBackgroundItemsUpdateRef = useRef(onBackgroundItemsUpdate)
  const inFlightKeysRef = useRef<Set<string>>(new Set())
  const attemptedKeysRef = useRef<Set<string>>(new Set())

  useEffect(() => {
    isMountedRef.current = true
    return () => {
      isMountedRef.current = false
    }
  }, [])

  useEffect(() => {
    latestItemsRef.current = items
  }, [items])

  useEffect(() => {
    latestFieldsRef.current = fields
  }, [fields])

  useEffect(() => {
    onChangeRef.current = onChange
    onBackgroundItemsUpdateRef.current = onBackgroundItemsUpdate
  }, [onChange, onBackgroundItemsUpdate])

  useEffect(() => {
    const linkFields = sortedFields.filter((f) => f.type === "link")
    if (linkFields.length === 0 || items.length === 0) return

    const pending: {
      itemId: string
      fieldId: string
      safeHref: string
      key: string
    }[] = []

    for (const item of items) {
      if (!item.custom_fields) continue
      for (const field of linkFields) {
        const rawUrl = item.custom_fields[field.id]
        if (typeof rawUrl !== "string") continue
        const safeHref = getSafeHref(rawUrl)
        if (!safeHref) continue
        if (getMatchingLinkPreview(item, field.id)) continue

        const key = `${item.id}:${field.id}:${safeHref}`
        if (
          inFlightKeysRef.current.has(key) ||
          attemptedKeysRef.current.has(key)
        ) {
          continue
        }
        pending.push({ itemId: item.id, fieldId: field.id, safeHref, key })
      }
    }

    if (pending.length === 0) return

    for (const entry of pending) {
      inFlightKeysRef.current.add(entry.key)
      attemptedKeysRef.current.add(entry.key)
    }

    let index = 0
    const MAX_CONCURRENCY = 3

    const runWorker = async () => {
      while (index < pending.length) {
        const entry = pending[index++]
        if (!entry) break

        try {
          const preview = await fetchLinkPreviewMetadata(entry.safeHref)
          if (!preview) continue

          const applyPreview = (currentItems: ListItem[]): ListItem[] => {
            let didChange = false
            const allowedIds = new Set(latestFieldsRef.current.map((f) => f.id))
            const nextItems = currentItems.map((it) => {
              if (it.id !== entry.itemId) return it
              const currentHref = getSafeHref(
                typeof it.custom_fields?.[entry.fieldId] === "string"
                  ? String(it.custom_fields[entry.fieldId])
                  : null,
              )
              if (currentHref !== entry.safeHref) return it

              const existingMatch = getMatchingLinkPreview(it, entry.fieldId)
              if (
                existingMatch &&
                existingMatch.url === preview.url &&
                existingMatch.imageUrl === preview.imageUrl &&
                existingMatch.title === preview.title
              ) {
                return it
              }

              didChange = true
              const merged = cleanLinkPreviews(
                { ...(it.link_previews || {}), [entry.fieldId]: preview },
                allowedIds,
              )
              return { ...it, link_previews: merged }
            })
            return didChange ? nextItems : currentItems
          }

          if (isMountedRef.current) {
            if (onBackgroundItemsUpdateRef.current) {
              onBackgroundItemsUpdateRef.current(applyPreview)
            } else {
              onChangeRef.current(applyPreview(latestItemsRef.current))
            }
          } else if (db && listId) {
            const doc = await db.tasks.findOne(listId).exec()
            if (doc) {
              const currentDbItems = (doc.toJSON().list_items ?? []) as ListItem[]
              const nextDbItems = applyPreview(currentDbItems)
              if (nextDbItems !== currentDbItems) {
                await doc.incrementalPatch({
                  list_items: nextDbItems,
                  updated_at: Date.now(),
                })
              }
            }
          }
        } finally {
          inFlightKeysRef.current.delete(entry.key)
        }
      }
    }

    const workerCount = Math.min(MAX_CONCURRENCY, pending.length)
    for (let i = 0; i < workerCount; i++) {
      void runWorker()
    }
  }, [items, sortedFields, db, listId])

  const visibleItems = useMemo(
    () =>
      items
        .filter((i) => {
          if (filter === "open") return i.status === "Open"
          if (filter === "done") return i.status === "Done"
          return true
        })
        .sort((a, b) => a.order - b.order),
    [items, filter],
  )

  const groupedItems = useMemo(() => {
    if (!isGrouped) return null
    const groups: Record<string, ListItem[]> = {}
    visibleItems.forEach((t) => {
      const catDef = getCategoryDef(t)
      const gid = catDef ? catDef.id : "none"
      if (!groups[gid]) groups[gid] = []
      groups[gid].push(t)
    })
    return Object.entries(groups)
      .map(([gid, groupItems]) => {
        const cat = categories.find((c) => c.id === gid)
        return {
          id: gid,
          name: cat ? cat.name : "No Category",
          items: groupItems,
        }
      })
      .sort((a, b) => {
        if (a.id === "none") return 1
        if (b.id === "none") return -1
        return a.name.localeCompare(b.name)
      })
  }, [visibleItems, isGrouped, categories, getCategoryDef])

  const atLimit = items.length >= MAX_ITEMS

  const [showGroupInMenu, setShowGroupInMenu] = useState(() => {
    if (typeof window !== "undefined") return window.innerWidth < 480
    return false
  })
  const barContainerRef = useRef<HTMLDivElement>(null)
  const filtersRef = useRef<HTMLDivElement>(null)
  const rightControlsRef = useRef<HTMLDivElement>(null)
  const groupMeasureRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    const container = barContainerRef.current
    if (!container) return

    const checkFit = () => {
      const containerWidth = container.clientWidth
      if (!containerWidth) return

      const filtersWidth = filtersRef.current?.offsetWidth || 0
      const rightWidth = rightControlsRef.current?.offsetWidth || 0
      const groupWidth = groupMeasureRef.current?.offsetWidth || 155
      // 12px for spacing between groups + 16px comfortable padding buffer
      const totalNeeded = filtersWidth + groupWidth + rightWidth + 28

      setShowGroupInMenu(containerWidth < totalNeeded)
    }

    checkFit()

    const observer = new ResizeObserver(checkFit)
    observer.observe(container)
    return () => observer.disconnect()
  }, [items.length, sortedFields.length, effectiveViewMode, atLimit, isMobile])

  return (
    <div className={cn("flex flex-col gap-3 relative", effectiveViewMode === "list" ? "pb-20" : "pb-6")}>
      {/* Invisible measurement element to calculate natural button width */}
      <button
        ref={groupMeasureRef}
        type="button"
        aria-hidden="true"
        tabIndex={-1}
        className="pointer-events-none invisible absolute -left-[9999px] -top-[9999px] flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold"
      >
        <Columns3 className="h-3.5 w-3.5" />
        <span>Group by category</span>
      </button>

      {/* Filter & view toolbar */}
      <div
        ref={barContainerRef}
        className="flex items-center gap-1.5 flex-nowrap overflow-x-auto no-scrollbar pb-1 -mb-1"
      >
        <div ref={filtersRef} className="flex items-center gap-1.5 shrink-0">
          {(["all", "open", "done"] as StatusFilter[]).map((f) => {
            const active = filter === f
            return (
              <button
                key={f}
                type="button"
                onClick={() => setFilter(f)}
                className={cn(
                  "flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition-colors",
                  active
                    ? "bg-primary/15 text-primary"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
              >
                {f.charAt(0).toUpperCase() + f.slice(1)}
              </button>
            )
          })}

          <div className="w-px h-4 bg-border mx-1 shrink-0" />
        </div>

        {!showGroupInMenu && (
          <button
            type="button"
            onClick={() => setIsGrouped(!isGrouped)}
            title="Group by category"
            className={cn(
              "flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition-colors",
              isGrouped
                ? "bg-primary/15 text-primary"
                : "text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            <Columns3 className="h-3.5 w-3.5" />
            <span>Group by category</span>
          </button>
        )}

        <div ref={rightControlsRef} className="ml-auto flex items-center gap-2 shrink-0">
          {atLimit && (
            <span className="text-xs text-amber-500 font-medium whitespace-nowrap">
              {MAX_ITEMS} item limit
            </span>
          )}

          {/* List / Cards / Table View Switcher (Table hidden on mobile) */}
          <div
            role="radiogroup"
            aria-label="List display mode"
            className="inline-flex items-center rounded-md border border-border bg-muted/40 p-0.5"
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
              title="List view"
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
              title="Cards view"
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
                title="Table view"
              >
                <Table2 className="h-3.5 w-3.5" />
                <span>Table</span>
              </button>
            )}
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                aria-label="More list options"
                className={cn(
                  "flex h-6 w-6 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  showGroupInMenu && isGrouped && "text-primary bg-primary/15 hover:bg-primary/25",
                )}
              >
                <MoreVertical className="h-3.5 w-3.5" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52">
              {showGroupInMenu && (
                <>
                  <DropdownMenuItem onClick={() => setIsGrouped(!isGrouped)}>
                    <Columns3 className="mr-2 h-4 w-4 text-muted-foreground" />
                    <span className="flex-1">Group by category</span>
                    {isGrouped && <Check className="ml-auto h-4 w-4 text-primary" />}
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                </>
              )}
              <DropdownMenuItem onClick={() => setShowFieldsModal(true)}>
                <SlidersHorizontal className="mr-2 h-4 w-4 text-muted-foreground" />
                <span className="flex-1">Fields</span>
                {sortedFields.length > 0 && (
                  <span className="ml-auto rounded bg-muted px-1.5 py-0.5 font-mono text-[11px] text-muted-foreground">
                    {sortedFields.length}
                  </span>
                )}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setShowCategoriesModal(true)}>
                <Settings2 className="mr-2 h-4 w-4 text-muted-foreground" />
                Categories
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Main Content: Table View vs Cards View vs List View */}
      {effectiveViewMode === "table" ? (
        <ListTableView
          listId={listId}
          items={visibleItems}
          allItemsCount={items.length}
          categories={categories}
          fields={sortedFields}
          filter={filter}
          isGrouped={isGrouped}
          atLimit={atLimit}
          onToggleStatus={handleToggleStatus}
          onDeleteItem={handleDelete}
          onEditItem={(item) => setEditingItem(item)}
          onAddItem={(catId) => setAddingToCategory(catId)}
          onUpdateItem={handleUpdateItem}
          onSelectCategory={handleSelectItemCategory}
          onUpdateCustomField={handleUpdateItemCustomField}
          onReorderItems={handleReorderItems}
          onOpenAddField={() => setShowAddFieldModal(true)}
          onOpenFieldsManager={() => setShowFieldsModal(true)}
          onPreviewImage={(url, title) => setLightboxImage({ url, title })}
        />
      ) : effectiveViewMode === "cards" ? (
        <ListCardsView
          listId={listId}
          items={visibleItems}
          allItemsCount={items.length}
          categories={categories}
          fields={sortedFields}
          filter={filter}
          isGrouped={isGrouped}
          atLimit={atLimit}
          onToggleStatus={handleToggleStatus}
          onDeleteItem={handleDelete}
          onEditItem={(item) => setEditingItem(item)}
          onAddItem={(catId) => setAddingToCategory(catId)}
          onReorderItems={handleReorderItems}
          onOpenAddField={() => setShowAddFieldModal(true)}
          onOpenFieldsManager={() => setShowFieldsModal(true)}
          onPreviewImage={(url, title) => setLightboxImage({ url, title })}
        />
      ) : (
        <>
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            {groupedItems ? (
              <div className="flex flex-col gap-6 p-0 mt-2">
                {groupedItems.map((group) => (
                  <div key={group.id} className="flex flex-col gap-2">
                    <div className="sticky top-0 z-10 flex items-center justify-between bg-background/95 md:bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-background/75 md:supports-[backdrop-filter]:bg-card/75 py-2 px-1">
                      <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                        {(() => {
                          const catDef = categories.find((c) => c.id === group.id)
                          const CatIcon = catDef?.icon ? ICON_OPTIONS.find((o) => o.name === catDef.icon)?.icon : undefined
                          return (
                            <span className="flex items-center justify-center shrink-0 h-5 w-5 md:h-6 md:w-6 rounded-sm" style={{ color: catDef?.color || "var(--primary)", backgroundColor: catDef?.color ? `color-mix(in oklch, ${catDef.color} 15%, transparent)` : undefined }}>
                              {CatIcon ? <CatIcon className="h-3 w-3 md:h-4 md:w-4" /> : <span className="h-1.5 w-1.5 rounded-full bg-current" />}
                            </span>
                          )
                        })()}
                        {group.name}
                        <span className="ml-2 font-mono text-xs uppercase tracking-wider text-muted-foreground font-normal">
                          {group.items.length}
                        </span>
                      </h3>
                      {filter !== "done" && !atLimit && (
                        <button
                          type="button"
                          onClick={() => setAddingToCategory(group.id === "none" ? null : group.id)}
                          className="inline-flex items-center gap-1 rounded bg-primary/10 px-2 py-1 text-xs font-medium text-primary transition-colors hover:bg-primary/20 shrink-0"
                        >
                          <Plus className="h-3 w-3" />
                          Add item
                        </button>
                      )}
                    </div>
                    <SortableContext items={group.items.map((i) => i.id)} strategy={verticalListSortingStrategy}>
                      <div className="flex flex-col gap-2">
                        {group.items.map((item) => (
                          <SortableListRow
                            key={item.id}
                            item={item}
                            categoryDef={getCategoryDef(item)}
                            showCategoryIcon={false}
                            fields={sortedFields}
                            onToggleStatus={handleToggleStatus}
                            onDelete={handleDelete}
                            onEdit={() => setEditingItem(item)}
                            onPreviewImage={(url, title) => setLightboxImage({ url, title })}
                          />
                        ))}
                      </div>
                    </SortableContext>
                  </div>
                ))}
              </div>
            ) : (
              <SortableContext items={visibleItems.map((i) => i.id)} strategy={verticalListSortingStrategy}>
                <div className="flex flex-col gap-2 mt-2">
                  {visibleItems.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-10 text-center">
                      <p className="text-sm font-medium text-muted-foreground">
                        {filter === "all" ? "No items yet" : filter === "done" ? "No done items" : "No open items"}
                      </p>
                      {filter === "all" && (
                        <p className="mt-1 text-xs text-muted-foreground/60">
                          Add your first item below
                        </p>
                      )}
                    </div>
                  ) : (
                    visibleItems.map((item) => (
                      <SortableListRow
                        key={item.id}
                        item={item}
                        categoryDef={getCategoryDef(item)}
                        showCategoryIcon={true}
                        fields={sortedFields}
                        onToggleStatus={handleToggleStatus}
                        onDelete={handleDelete}
                        onEdit={() => setEditingItem(item)}
                        onPreviewImage={(url, title) => setLightboxImage({ url, title })}
                      />
                    ))
                  )}
                </div>
              </SortableContext>
            )}
          </DndContext>

          {/* Add item at bottom (only when not filtered and not grouped) */}
          {!isGrouped && filter !== "done" && !atLimit && (
            <button
              type="button"
              onClick={() => setAddingToCategory(null)}
              className="mt-2 flex w-full items-center gap-2 rounded-lg border border-dashed border-border p-3 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <Plus className="h-4 w-4" />
              Add item
            </button>
          )}

          {/* Floating Add Button (FAB) */}
          {!atLimit && (
            <div className="sticky bottom-4 mt-8 flex justify-end right-4 z-50 pointer-events-none">
              <button
                type="button"
                onClick={() => setAddingToCategory(null)}
                className="pointer-events-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg hover:scale-105 active:scale-95 transition-transform"
                aria-label="Add item"
              >
                <Plus className="h-5 w-5" />
              </button>
            </div>
          )}
        </>
      )}

      {/* Categories Modal */}
      <Dialog open={showCategoriesModal} onOpenChange={setShowCategoriesModal}>
        <DialogContent className="max-w-md max-h-[85vh] overflow-hidden flex flex-col p-0">
          <DialogHeader className="p-4 md:p-5 border-b pb-4">
            <DialogTitle>Categories</DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto p-4 md:p-5 flex flex-col gap-3">
            {categories.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">No categories configured yet.</p>
            ) : (
              categories.map(cat => {
                const CatIcon = cat.icon ? ICON_OPTIONS.find(o => o.name === cat.icon)?.icon : undefined
                return (
                  <div key={cat.id} onClick={() => setEditingCategory(cat)} className="flex items-center justify-between p-3 rounded-lg border bg-card hover:border-primary/50 cursor-pointer transition-colors">
                    <div className="flex items-center gap-3">
                      <div className="flex h-8 w-8 items-center justify-center rounded-md border border-border" style={{ color: cat.color || "var(--foreground)", backgroundColor: cat.color ? `color-mix(in oklch, ${cat.color} 15%, transparent)` : "var(--muted)" }}>
                        {CatIcon ? <CatIcon className="h-4 w-4" /> : <Circle className="h-4 w-4 opacity-50" />}
                      </div>
                      <span className="text-sm font-medium">{cat.name}</span>
                    </div>
                    <Settings2 className="h-4 w-4 text-muted-foreground" />
                  </div>
                )
              })
            )}
            <button
              type="button"
              onClick={() => setEditingCategory({ id: nanoid(), name: "New Category", color: COLOR_PALETTE[0], icon: "FolderKanban" })}
              className="mt-2 flex w-full items-center justify-center gap-2 rounded-lg border border-dashed p-3 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
            >
              <Plus className="h-4 w-4" />
              Add Category
            </button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Category Modal */}
      <Dialog open={!!editingCategory} onOpenChange={(open) => { if (!open) setEditingCategory(null) }}>
        <DialogContent className="max-w-md max-h-[90dvh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{categories.find(c => c.id === editingCategory?.id) ? "Edit Category" : "New Category"}</DialogTitle>
          </DialogHeader>
          {editingCategory && (
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <label className="text-sm font-medium">Name</label>
                <input
                  type="text"
                  value={editingCategory.name}
                  onChange={(e) => setEditingCategory({...editingCategory, name: e.target.value})}
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                />
              </div>
              <div className="grid gap-2">
                <label className="text-sm font-medium">Icon</label>
                <IconPicker 
                  value={editingCategory.icon || "Tag"} 
                  onChange={(val) => setEditingCategory({...editingCategory, icon: val})} 
                />
              </div>
              <div className="grid gap-2">
                <label className="text-sm font-medium">Color</label>
                <div className="flex flex-wrap gap-2">
                  {COLOR_PALETTE.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setEditingCategory({...editingCategory, color: c})}
                      className="flex h-8 w-8 items-center justify-center rounded-full border-2 transition-all hover:scale-110"
                      style={{
                        backgroundColor: c,
                        borderColor: editingCategory.color === c ? "var(--foreground)" : "transparent",
                      }}
                    />
                  ))}
                </div>
              </div>
              <div className="flex items-center justify-between mt-4">
                <button
                  type="button"
                  onClick={() => {
                    const deletedId = editingCategory.id
                    const oldCat = categories.find((c) => c.id === deletedId)
                    const targetName = oldCat?.name || editingCategory.name
                    const newCats = categories.filter((c) => c.id !== deletedId)

                    // Clear category_id and category on all items that had this category
                    const updatedItems = items.map((item) =>
                      item.category_id === deletedId || item.category === targetName
                        ? { ...item, category_id: null, category: null }
                        : item,
                    )
                    commitBatch({ list_categories: newCats, list_items: updatedItems })
                    setEditingCategory(null)
                  }}
                  className="text-sm text-destructive hover:underline"
                >
                  Delete
                </button>
                <div className="flex items-center gap-2">
                  <button type="button" onClick={() => setEditingCategory(null)} className="rounded-md border px-4 py-2 text-sm font-medium transition-colors hover:bg-muted">Cancel</button>
                  <button 
                    type="button" 
                    onClick={() => {
                      const oldCat = categories.find((c) => c.id === editingCategory.id)
                      const idx = categories.findIndex((c) => c.id === editingCategory.id)
                      const newCats = [...categories]
                      if (idx >= 0) newCats[idx] = editingCategory
                      else newCats.push(editingCategory)

                      // Also sync category name string on items for backwards compatibility
                      if (oldCat && oldCat.name !== editingCategory.name) {
                        const updatedItems = items.map((item) =>
                          item.category_id === editingCategory.id || item.category === oldCat.name
                            ? { ...item, category_id: editingCategory.id, category: editingCategory.name }
                            : item,
                        )
                        commitBatch({ list_categories: newCats, list_items: updatedItems })
                      } else {
                        onCategoriesChange(newCats)
                      }
                      setEditingCategory(null)
                    }} 
                    className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow transition-colors hover:bg-primary/90"
                  >
                    Save
                  </button>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <FieldsManagerModal
        open={showFieldsModal}
        onOpenChange={setShowFieldsModal}
        fields={sortedFields}
        items={items}
        onAddField={handleAddField}
        onRenameField={handleRenameField}
        onReorderFields={handleReorderFields}
        onDeleteField={handleDeleteField}
      />

      <AddFieldDialog
        open={showAddFieldModal}
        onOpenChange={setShowAddFieldModal}
        existingFields={fields}
        onAdd={handleAddField}
      />

      <ImageLightboxDialog
        open={!!lightboxImage}
        onOpenChange={(open) => {
          if (!open) setLightboxImage(null)
        }}
        imageUrl={lightboxImage?.url ?? null}
        title={lightboxImage?.title}
      />

      <ItemModal
        open={addingToCategory !== undefined}
        onOpenChange={(open) => {
          if (!open) setAddingToCategory(undefined)
        }}
        initialCategory={addingToCategory || null}
        categories={categories}
        fields={sortedFields}
        items={items}
        onPreviewImage={(url, title) => setLightboxImage({ url, title })}
        onSave={handleAdd}
      />
      <ItemModal
        open={!!editingItem}
        onOpenChange={(open) => {
          if (!open) setEditingItem(null)
        }}
        initialDescription={editingItem?.description || ""}
        initialDetails={editingItem?.details || ""}
        initialCategory={editingItem?.category_id || editingItem?.category || null}
        initialCustomFields={editingItem?.custom_fields || null}
        initialLinkPreviews={editingItem?.link_previews || null}
        categories={categories}
        fields={sortedFields}
        items={items}
        isEdit
        onPreviewImage={(url, title) => setLightboxImage({ url, title })}
        onSave={(desc, catId, details, newCatName, _existingId, customFields) => {
          if (editingItem) {
            handleRename(editingItem.id, desc, catId, details, newCatName, customFields)
            setEditingItem(null)
          }
        }}
      />
    </div>
  )
}
