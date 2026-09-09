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
  CircleCheck,
  MoreVertical,
  Trash2,
  Pencil,
  RotateCcw,
  Columns3,
  Settings2,
  Palette,
  Check,
  Tag,
  ChevronsUpDown,
} from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Command, CommandInput, CommandList, CommandEmpty, CommandGroup, CommandItem } from "@/components/ui/command"
import { IconPicker } from "@/components/icon-picker"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { cn } from "@/lib/utils"
import type { ListItem, ListCategory } from "@/lib/types"

const MAX_ITEMS = 200

// ─── SortableListRow ────────────────────────────────────────────────────────

function SortableListRow({
  item,
  categoryDef,
  showCategoryIcon,
  onToggleStatus,
  onDelete,
  onEdit,
}: {
  item: ListItem
  categoryDef?: ListCategory
  showCategoryIcon?: boolean
  onToggleStatus: (id: string) => void
  onDelete: (id: string) => void
  onEdit: () => void
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
      </div>

      {item.category && showCategoryIcon && (
        <div 
          className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-sm border"
          style={{
            color: categoryDef?.color || "var(--muted-foreground)",
            borderColor: categoryDef?.color || "var(--border)",
            backgroundColor: categoryDef?.color ? `color-mix(in oklch, ${categoryDef.color} 10%, transparent)` : "var(--muted)"
          }}
          title={item.category}
        >
          <CatIcon className="h-2.5 w-2.5" />
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
  onSave,
  categories,
  isEdit = false,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  initialDescription?: string
  initialDetails?: string | null
  initialCategory?: string | null
  onSave: (description: string, categoryId: string | null, details: string | null, newCategoryName?: string | null) => void
  categories: ListCategory[]
  isEdit?: boolean
}) {
  const [desc, setDesc] = useState(initialDescription)
  const [details, setDetails] = useState(initialDetails || "")
  const [selectedCatId, setSelectedCatId] = useState<string | null>(null)
  const [newCatName, setNewCatName] = useState<string>("")
  const [catOpen, setCatOpen] = useState(false)
  const [catInput, setCatInput] = useState("")
  
  useEffect(() => {
    if (open) {
      setDesc(initialDescription)
      setDetails(initialDetails || "")
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
  }, [open, initialDescription, initialDetails, initialCategory, categories])

  const handleSave = () => {
    if (!desc.trim()) return
    onSave(desc.trim(), selectedCatId, details.trim() || null, newCatName.trim() || null)
    onOpenChange(false)
  }

  const selectedCat = categories.find((c) => c.id === selectedCatId) || (newCatName ? { id: "temp", name: newCatName, color: undefined, icon: undefined } : null)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit Item" : "Add Item"}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <label className="text-sm font-medium">Item name</label>
            <input
              type="text"
              autoFocus
              value={desc}
              onChange={(e) => setDesc(e.target.value)}
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              placeholder="What needs to be done?"
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault()
                  handleSave()
                }
              }}
            />
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
                          Create "{catInput.trim()}"
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
                            Create "{catInput.trim()}"
                          </CommandItem>
                        )}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>
          </div>
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

type StatusFilter = "all" | "open" | "done"

export function ListEditor({
  listId,
  items,
  onChange,
  categories = [],
  onCategoriesChange = () => {},
}: {
  listId?: string
  items: ListItem[]
  onChange: (items: ListItem[]) => void
  categories?: ListCategory[]
  onCategoriesChange?: (cats: ListCategory[]) => void
}) {
  const [filter, setFilter] = useState<StatusFilter>("open")
  const [isGrouped, setIsGrouped] = useState(() => {
    if (typeof window !== "undefined" && listId) {
      const stored = localStorage.getItem(`list_grouped_${listId}`)
      if (stored !== null) return stored === "true"
    }
    return false
  })
  
  useEffect(() => {
    if (listId) {
      localStorage.setItem(`list_grouped_${listId}`, isGrouped.toString())
    }
  }, [isGrouped, listId])

  const [showCategoriesModal, setShowCategoriesModal] = useState(false)
  const [editingCategory, setEditingCategory] = useState<ListCategory | null>(null)
  
  // States for Item Modal
  const [addingToCategory, setAddingToCategory] = useState<string | null | undefined>(undefined)
  const [editingItem, setEditingItem] = useState<ListItem | null>(null)

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
    (categoryId: string | null, newCategoryName?: string | null): { id: string | null; name: string | null } => {
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
        onCategoriesChange([...categories, newCat])
        return { id: newCat.id, name: newCat.name }
      }
      if (categoryId) {
        const cat = categories.find((c) => c.id === categoryId)
        return { id: categoryId, name: cat ? cat.name : null }
      }
      return { id: null, name: null }
    },
    [categories, onCategoriesChange],
  )

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event
      if (!over || active.id === over.id) return
      const oldIndex = items.findIndex((i) => i.id === active.id)
      const newIndex = items.findIndex((i) => i.id === over.id)
      if (oldIndex === -1 || newIndex === -1) return
      
      let reordered = arrayMove(items, oldIndex, newIndex)
      
      // If grouped, dragging into a new category should update its category
      if (isGrouped) {
        const targetItem = items[newIndex]
        const targetCatDef = getCategoryDef(targetItem)
        const targetCatId = targetCatDef ? targetCatDef.id : null
        const targetCatName = targetCatDef ? targetCatDef.name : null
        reordered = reordered.map((item) => 
          item.id === active.id
            ? { ...item, category_id: targetCatId, category: targetCatName }
            : item
        )
      }

      onChange(reordered.map((item, idx) => ({ ...item, order: idx })))
    },
    [items, onChange, isGrouped, getCategoryDef],
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

  const handleRename = useCallback(
    (
      id: string,
      description: string,
      categoryId: string | null,
      details: string | null = null,
      newCategoryName?: string | null,
    ) => {
      const { id: finalCatId, name: finalCatName } = resolveCategory(categoryId, newCategoryName)
      onChange(
        items.map((item) =>
          item.id === id
            ? { ...item, description, category_id: finalCatId, category: finalCatName, details }
            : item,
        ),
      )
    },
    [items, onChange, resolveCategory],
  )

  const handleAdd = useCallback(
    (
      description: string,
      categoryId: string | null = null,
      details: string | null = null,
      newCategoryName?: string | null,
    ) => {
      if (items.length >= MAX_ITEMS) return
      const now = new Date().toISOString()
      const { id: finalCatId, name: finalCatName } = resolveCategory(categoryId, newCategoryName)

      const newItem: ListItem = {
        id: nanoid(),
        description,
        status: "Open",
        order: items.length,
        date_created: now,
        category_id: finalCatId,
        category: finalCatName,
        details,
      }
      onChange([...items, newItem])
      setAddingToCategory(undefined)
    },
    [items, onChange, resolveCategory],
  )

  const openCount = items.filter((i) => i.status === "Open").length
  const doneCount = items.filter((i) => i.status === "Done").length

  const visibleItems = items
    .filter((i) => {
      if (filter === "open") return i.status === "Open"
      if (filter === "done") return i.status === "Done"
      return true
    })
    .sort((a, b) => a.order - b.order)

  const allCategories = useMemo(() => {
    const cats = new Set(items.map((i) => i.category).filter(Boolean) as string[])
    return Array.from(cats).sort()
  }, [items])

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
  }, [items.length])

  return (
    <div className="flex flex-col gap-3 relative pb-20">
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

      {/* Filter bar */}
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
              <DropdownMenuItem onClick={() => setShowCategoriesModal(true)}>
                <Settings2 className="mr-2 h-4 w-4 text-muted-foreground" />
                Categories
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>



      {/* List / Groups */}
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
                        <span className="flex items-center justify-center shrink-0 h-5 w-5 rounded-sm" style={{ color: catDef?.color || "var(--primary)", backgroundColor: catDef?.color ? `color-mix(in oklch, ${catDef.color} 15%, transparent)` : undefined }}>
                          {CatIcon ? <CatIcon className="h-3 w-3" /> : <span className="h-1.5 w-1.5 rounded-full bg-current" />}
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
                        onToggleStatus={handleToggleStatus}
                        onDelete={handleDelete}
                        onEdit={() => setEditingItem(item)}
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
                    onToggleStatus={handleToggleStatus}
                    onDelete={handleDelete}
                    onEdit={() => setEditingItem(item)}
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
                    onCategoriesChange(newCats)

                    // Clear category_id and category on all items that had this category
                    const updatedItems = items.map((item) =>
                      item.category_id === deletedId || item.category === targetName
                        ? { ...item, category_id: null, category: null }
                        : item,
                    )
                    onChange(updatedItems)
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
                      onCategoriesChange(newCats)

                      // Also sync category name string on items for backwards compatibility
                      if (oldCat && oldCat.name !== editingCategory.name) {
                        const updatedItems = items.map((item) =>
                          item.category_id === editingCategory.id || item.category === oldCat.name
                            ? { ...item, category_id: editingCategory.id, category: editingCategory.name }
                            : item,
                        )
                        onChange(updatedItems)
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

      <ItemModal
        open={addingToCategory !== undefined}
        onOpenChange={(open) => {
          if (!open) setAddingToCategory(undefined)
        }}
        initialCategory={addingToCategory || null}
        categories={categories}
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
        categories={categories}
        isEdit
        onSave={(desc, catId, details, newCatName) => {
          if (editingItem) {
            handleRename(editingItem.id, desc, catId, details, newCatName)
            setEditingItem(null)
          }
        }}
      />

</div>
  )
}

