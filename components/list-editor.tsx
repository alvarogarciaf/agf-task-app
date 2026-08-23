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
} from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { cn } from "@/lib/utils"
import type { ListItem, ListCategory } from "@/lib/types"

const MAX_ITEMS = 200

// ─── SortableListRow ────────────────────────────────────────────────────────

function SortableListRow({
  item,
  allCategories,
  onToggleStatus,
  onDelete,
  onRename,
}: {
  item: ListItem
  allCategories: string[]
  onToggleStatus: (id: string) => void
  onDelete: (id: string) => void
  onRename: (id: string, description: string, category: string | null) => void
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
  const [editing, setEditing] = useState(false)
  const [editDesc, setEditDesc] = useState(item.description)
  const [editCat, setEditCat] = useState(item.category || "")
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (editing) {
      inputRef.current?.focus()
      inputRef.current?.select()
    }
  }, [editing])

  const commitRename = () => {
    const trimmedDesc = editDesc.trim()
    const trimmedCat = editCat.trim() || null
    if (trimmedDesc) {
      onRename(item.id, trimmedDesc, trimmedCat)
    } else {
      setEditDesc(item.description)
      setEditCat(item.category || "")
    }
    setEditing(false)
  }

  const isDone = item.status === "Done"

  if (editing) {
    return (
      <div
        ref={setNodeRef}
        style={style}
        className="relative flex flex-col gap-2 rounded-xl border border-primary/40 bg-card p-3 shadow-sm"
      >
        <input
          ref={inputRef}
          value={editDesc}
          onChange={(e) => setEditDesc(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") { e.preventDefault(); commitRename() }
            if (e.key === "Escape") { setEditDesc(item.description); setEditing(false) }
          }}
          placeholder="Item description…"
          className="w-full bg-transparent text-sm font-medium leading-tight text-foreground outline-none border-b border-primary/30 pb-1"
        />
        <div className="flex items-center gap-2">
          <input
            list="category-options"
            value={editCat}
            onChange={(e) => setEditCat(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") { e.preventDefault(); commitRename() }
              if (e.key === "Escape") { setEditDesc(item.description); setEditing(false) }
            }}
            placeholder="Category (optional)"
            className="flex-1 bg-transparent text-xs text-muted-foreground outline-none border-b border-primary/30 pb-1"
          />
          <datalist id="category-options">
            {allCategories.map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
          <button
            type="button"
            onMouseDown={(e) => { e.preventDefault(); commitRename() }}
            className="rounded-md bg-primary px-3 py-1 text-xs font-semibold text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            Save
          </button>
        </div>
      </div>
    )
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "relative flex min-h-[48px] items-center gap-3 rounded-xl border pl-4 pr-2.5 py-2 transition-all select-none shadow-sm",
        isDone ? "opacity-65 bg-muted/20 border-border/60" : "border-border/80 bg-card hover:border-border",
        isDragging && "shadow-lg border-primary/30 bg-background/50",
      )}
    >
      {/* Drag grip */}
      <div
        {...attributes}
        {...listeners}
        data-drag-handle="true"
        className="flex h-7 w-5 shrink-0 items-center justify-center -ml-1 text-muted-foreground/35 active:text-foreground transition-colors cursor-grab active:cursor-grabbing touch-none select-none"
        onClick={(e) => e.stopPropagation()}
        aria-label="Drag to reorder"
      >
        <GripVertical className="h-4 w-4" />
      </div>

      {/* Status toggle */}
      <button
        type="button"
        onClick={() => onToggleStatus(item.id)}
        className="shrink-0 text-muted-foreground hover:text-primary transition-colors cursor-pointer"
        aria-label={isDone ? "Mark as open" : "Mark as done"}
      >
        {isDone ? (
          <CircleCheck className="h-4.5 w-4.5 text-primary" />
        ) : (
          <Circle className="h-4.5 w-4.5" />
        )}
      </button>

      {/* Description */}
      <div className="flex-1 min-w-0 flex flex-col justify-center">
        <span
          className={cn(
            "truncate text-sm font-medium leading-tight",
            isDone ? "text-muted-foreground line-through" : "text-foreground",
          )}
          onDoubleClick={() => { setEditing(true); setEditDesc(item.description); setEditCat(item.category || "") }}
        >
          {item.description}
        </span>
      </div>

      {/* Three-dot menu */}
      <div onClick={(e) => e.stopPropagation()}>
        <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted active:bg-muted cursor-pointer"
            >
              <MoreVertical className="h-4 w-4" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-52 p-1.5">
            <DropdownMenuLabel className="px-3 py-2 text-sm font-semibold">Item Actions</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="py-3 px-3 text-[15px] font-medium cursor-pointer"
              onClick={() => { setMenuOpen(false); setEditing(true); setEditDesc(item.description); setEditCat(item.category || "") }}
            >
              <Pencil className="mr-3 h-5 w-5 shrink-0 text-muted-foreground" />
              <span>Edit</span>
            </DropdownMenuItem>
            <DropdownMenuItem
              className="py-3 px-3 text-[15px] font-medium cursor-pointer"
              onClick={() => { setMenuOpen(false); onToggleStatus(item.id) }}
            >
              {isDone ? (
                <><RotateCcw className="mr-3 h-5 w-5 shrink-0 text-muted-foreground" /><span>Mark as Open</span></>
              ) : (
                <><CircleCheck className="mr-3 h-5 w-5 shrink-0 text-muted-foreground" /><span>Mark as Done</span></>
              )}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="py-3 px-3 text-[15px] font-medium cursor-pointer text-destructive focus:text-destructive"
              onClick={() => { setMenuOpen(false); onDelete(item.id) }}
            >
              <Trash2 className="mr-3 h-5 w-5 shrink-0" />
              <span>Delete</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  )
}

// ─── AddItemRow ──────────────────────────────────────────────────────────────

function AddItemRow({
  onAdd,
  onCancel,
  defaultCategory,
  allCategories,
  isGrouped,
  defaultActive = false,
}: {
  onAdd: (description: string, category: string | null) => void
  onCancel?: () => void
  defaultCategory?: string | null
  allCategories: string[]
  isGrouped?: boolean
  defaultActive?: boolean
}) {
  const [active, setActive] = useState(defaultActive)
  const [desc, setDesc] = useState("")
  const [cat, setCat] = useState(defaultCategory || "")
  const inputRef = useRef<HTMLInputElement>(null)

  const activate = () => {
    setActive(true)
    setTimeout(() => inputRef.current?.focus(), 0)
  }

  const commit = () => {
    const trimmedDesc = desc.trim()
    const trimmedCat = cat.trim() || null
    if (trimmedDesc) onAdd(trimmedDesc, trimmedCat)
    setDesc("")
    setCat(defaultCategory || "")
    // Keep active so user can keep adding
    setTimeout(() => inputRef.current?.focus(), 0)
  }

  const cancel = () => {
    setDesc("")
    setCat(defaultCategory || "")
    setActive(false)
    onCancel?.()
  }

  if (!active) {
    if (isGrouped) {
      return (
        <button
          type="button"
          onClick={activate}
          className="inline-flex items-center gap-1 rounded bg-primary/10 px-2 py-1 text-xs font-medium text-primary transition-colors hover:bg-primary/20"
        >
          <Plus className="mr-1 h-3.5 w-3.5" />
          Add to category
        </button>
      )
    }

    return (
      <button
        type="button"
        onClick={activate}
        className="mt-1 flex w-full items-center gap-2 rounded-xl border border-dashed border-border/60 px-4 py-3 text-sm text-muted-foreground hover:border-primary/50 hover:text-foreground transition-colors"
      >
        <Plus className="h-4 w-4 shrink-0" />
        Add item
      </button>
    )
  }

  return (
    <div className="mt-1 flex flex-col gap-2 rounded-xl border border-primary/40 bg-card p-3 shadow-sm">
      <input
        ref={inputRef}
        value={desc}
        onChange={(e) => setDesc(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") { e.preventDefault(); commit() }
          if (e.key === "Escape") cancel()
        }}
        placeholder="Item description…"
        className="w-full bg-transparent text-sm font-medium leading-tight text-foreground outline-none border-b border-primary/30 pb-1"
      />
      <div className="flex items-center gap-2">
        <input
          list="category-options"
          value={cat}
          onChange={(e) => setCat(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") { e.preventDefault(); commit() }
            if (e.key === "Escape") cancel()
          }}
          placeholder="Category (optional)"
          className="flex-1 bg-transparent text-xs text-muted-foreground outline-none border-b border-primary/30 pb-1"
        />
        <button
          type="button"
          onMouseDown={(e) => { e.preventDefault(); commit() }}
          className="rounded-md bg-primary px-3 py-1 text-xs font-semibold text-primary-foreground hover:bg-primary/90 transition-colors"
        >
          Add
        </button>
        <button
          type="button"
          onMouseDown={(e) => { e.preventDefault(); cancel() }}
          className="rounded-md px-3 py-1 text-xs font-semibold text-muted-foreground hover:bg-muted transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>
  )
}

// ─── ListEditor (main export) ────────────────────────────────────────────────

type StatusFilter = "all" | "open" | "done"

export function ListEditor({
  items,
  onChange,
  categories = [],
  onCategoriesChange = () => {},
}: {
  items: ListItem[]
  onChange: (items: ListItem[]) => void
  categories?: ListCategory[]
  onCategoriesChange?: (cats: ListCategory[]) => void
}) {
  const [filter, setFilter] = useState<StatusFilter>("all")
  const [isGrouped, setIsGrouped] = useState(false)
  const [showCategoriesModal, setShowCategoriesModal] = useState(false)
  const [editingCategory, setEditingCategory] = useState<ListCategory | null>(null)
  
  // State to trigger the global add FAB
  const [showGlobalAdd, setShowGlobalAdd] = useState(false)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
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
        reordered = reordered.map((item) => 
          item.id === active.id ? { ...item, category: targetItem.category } : item
        )
      }

      onChange(reordered.map((item, idx) => ({ ...item, order: idx })))
    },
    [items, onChange, isGrouped],
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
    (id: string, description: string, category: string | null) => {
      onChange(items.map((item) => (item.id === id ? { ...item, description, category } : item)))
    },
    [items, onChange],
  )

  const handleAdd = useCallback(
    (description: string, category: string | null = null) => {
      if (items.length >= MAX_ITEMS) return
      const now = new Date().toISOString()
      const newItem: ListItem = {
        id: nanoid(),
        description,
        status: "Open",
        order: items.length,
        date_created: now,
        category,
      }
      onChange([...items, newItem])
      setShowGlobalAdd(false) // Close global add if open
    },
    [items, onChange],
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
      const cid = t.category || "none"
      if (!groups[cid]) groups[cid] = []
      groups[cid].push(t)
    })
    return Object.entries(groups)
      .map(([cid, groupItems]) => ({
        id: cid,
        name: cid === "none" ? "No Category" : cid,
        items: groupItems,
      }))
      .sort((a, b) => {
        if (a.id === "none") return 1
        if (b.id === "none") return -1
        return a.name.localeCompare(b.name)
      })
  }, [visibleItems, isGrouped])

  const atLimit = items.length >= MAX_ITEMS

  return (
    <div className="flex flex-col gap-3 relative pb-20">
      {/* Filter bar */}
      <div className="flex items-center gap-1.5 flex-wrap">
        {(["all", "open", "done"] as StatusFilter[]).map((f) => {
          const count = f === "all" ? items.length : f === "open" ? openCount : doneCount
          const active = filter === f
          return (
            <button
              key={f}
              type="button"
              onClick={() => setFilter(f)}
              className={cn(
                "flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold transition-colors",
                active
                  ? "bg-primary/15 text-primary"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
            >
              {f.charAt(0).toUpperCase() + f.slice(1)}
              <span
                className={cn(
                  "rounded-full px-1.5 py-0.5 font-mono text-[10px] leading-none",
                  active ? "bg-primary/20 text-primary" : "bg-muted text-muted-foreground",
                )}
              >
                {count}
              </span>
            </button>
          )
        })}
        
        <div className="w-px h-4 bg-border mx-1" />

        <button
          type="button"
          onClick={() => setIsGrouped(!isGrouped)}
          className={cn(
            "flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold transition-colors",
            isGrouped
              ? "bg-primary/15 text-primary"
              : "text-muted-foreground hover:bg-muted hover:text-foreground",
          )}
        >
          <Columns3 className="h-3.5 w-3.5" />
          Group by category
        </button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="flex h-6 w-6 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground ml-0.5 outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <MoreVertical className="h-3.5 w-3.5" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuItem onClick={() => setShowCategoriesModal(true)}>
              <Settings2 className="mr-2 h-4 w-4 text-muted-foreground" />
              Categories
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {atLimit && (
          <span className="ml-auto text-xs text-amber-500 font-medium">
            {MAX_ITEMS} item limit
          </span>
        )}
      </div>

      {/* Global Add (if triggered by FAB) */}
      {showGlobalAdd && !atLimit && (
        <div className="mb-2">
          <AddItemRow onAdd={handleAdd} onCancel={() => setShowGlobalAdd(false)} allCategories={allCategories} defaultActive={true} />
        </div>
      )}

      {/* List / Groups */}
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        {groupedItems ? (
          <div className="flex flex-col gap-6 p-0 mt-2">
            {groupedItems.map((group) => (
              <div key={group.id} className="flex flex-col gap-2">
                <div className="sticky top-0 z-10 flex items-center justify-between bg-background/95 md:bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-background/75 md:supports-[backdrop-filter]:bg-card/75 py-2 px-1">
                  <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                    {(() => {
                      const catDef = categories.find(c => c.name === group.name)
                      const CatIcon = catDef?.icon ? ICON_OPTIONS.find(o => o.name === catDef.icon)?.icon : undefined
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
                    <AddItemRow 
                      onAdd={handleAdd} 
                      allCategories={allCategories} 
                      defaultCategory={group.id === "none" ? null : group.name}
                      isGrouped
                    />
                  )}
                </div>
                <SortableContext items={group.items.map((i) => i.id)} strategy={verticalListSortingStrategy}>
                  <div className="flex flex-col gap-2">
                    {group.items.map((item) => (
                      <SortableListRow
                        key={item.id}
                        item={item}
                        allCategories={allCategories}
                        onToggleStatus={handleToggleStatus}
                        onDelete={handleDelete}
                        onRename={handleRename}
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
                    allCategories={allCategories}
                    onToggleStatus={handleToggleStatus}
                    onDelete={handleDelete}
                    onRename={handleRename}
                  />
                ))
              )}
            </div>
          </SortableContext>
        )}
      </DndContext>

      {/* Add item at bottom (only when not filtered and not grouped) */}
      {!isGrouped && filter !== "done" && !atLimit && (
        <AddItemRow onAdd={handleAdd} allCategories={allCategories} />
      )}

      {/* Floating Add Button (FAB) */}
      {!atLimit && (
        <div className="sticky bottom-4 mt-8 flex justify-end right-4 z-50 pointer-events-none">
          <button
            type="button"
            onClick={() => setShowGlobalAdd(true)}
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
                <div className="grid grid-cols-8 gap-1.5 sm:grid-cols-9 max-h-40 overflow-y-auto rounded-md border border-border bg-background/40 p-2">
                  {ICON_OPTIONS.map((opt) => {
                    const OptIcon = opt.icon
                    const isSelected = editingCategory.icon === opt.name
                    return (
                      <button
                        key={opt.name}
                        type="button"
                        onClick={() => setEditingCategory({...editingCategory, icon: opt.name})}
                        className={`flex h-9 w-9 items-center justify-center rounded-lg border transition-colors ${isSelected ? "border-primary bg-primary/15 text-primary" : "border-transparent text-muted-foreground hover:bg-muted hover:text-foreground"}`}
                      >
                        <OptIcon className="h-4 w-4" />
                      </button>
                    )
                  })}
                </div>
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
                    const newCats = categories.filter(c => c.id !== editingCategory.id)
                    onCategoriesChange(newCats)
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
                      const idx = categories.findIndex(c => c.id === editingCategory.id)
                      const newCats = [...categories]
                      if (idx >= 0) newCats[idx] = editingCategory
                      else newCats.push(editingCategory)
                      onCategoriesChange(newCats)
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
</div>
  )
}

