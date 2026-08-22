"use client"

import React, { useState, useRef, useCallback, useEffect } from "react"
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
} from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { cn } from "@/lib/utils"
import type { ListItem } from "@/lib/types"

const MAX_ITEMS = 200

// ─── SortableListRow ────────────────────────────────────────────────────────

function SortableListRow({
  item,
  onToggleStatus,
  onDelete,
  onRename,
}: {
  item: ListItem
  onToggleStatus: (id: string) => void
  onDelete: (id: string) => void
  onRename: (id: string, value: string) => void
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
  const [editValue, setEditValue] = useState(item.description)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (editing) {
      inputRef.current?.focus()
      inputRef.current?.select()
    }
  }, [editing])

  const commitRename = () => {
    const trimmed = editValue.trim()
    if (trimmed && trimmed !== item.description) {
      onRename(item.id, trimmed)
    } else {
      setEditValue(item.description)
    }
    setEditing(false)
  }

  const isDone = item.status === "Done"

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

      {/* Description / inline edit */}
      {editing ? (
        <input
          ref={inputRef}
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onBlur={commitRename}
          onKeyDown={(e) => {
            if (e.key === "Enter") { e.preventDefault(); commitRename() }
            if (e.key === "Escape") { setEditValue(item.description); setEditing(false) }
          }}
          className="flex-1 min-w-0 bg-transparent text-sm font-medium leading-tight text-foreground outline-none border-b border-primary"
        />
      ) : (
        <span
          className={cn(
            "flex-1 min-w-0 truncate text-sm font-medium leading-tight",
            isDone ? "text-muted-foreground line-through" : "text-foreground",
          )}
          onDoubleClick={() => { setEditing(true); setEditValue(item.description) }}
        >
          {item.description}
        </span>
      )}

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
              onClick={() => { setMenuOpen(false); setEditing(true); setEditValue(item.description) }}
            >
              <Pencil className="mr-3 h-5 w-5 shrink-0 text-muted-foreground" />
              <span>Rename</span>
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

function AddItemRow({ onAdd }: { onAdd: (description: string) => void }) {
  const [active, setActive] = useState(false)
  const [value, setValue] = useState("")
  const inputRef = useRef<HTMLInputElement>(null)

  const activate = () => {
    setActive(true)
    setTimeout(() => inputRef.current?.focus(), 0)
  }

  const commit = () => {
    const trimmed = value.trim()
    if (trimmed) onAdd(trimmed)
    setValue("")
    // Keep active so user can keep adding
    setTimeout(() => inputRef.current?.focus(), 0)
  }

  const cancel = () => {
    setValue("")
    setActive(false)
  }

  if (!active) {
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
    <div className="mt-1 flex items-center gap-3 rounded-xl border border-primary/40 bg-card pl-4 pr-2.5 py-2 shadow-sm">
      <div className="w-5 shrink-0" /> {/* grip placeholder */}
      <Circle className="h-4.5 w-4.5 shrink-0 text-muted-foreground/40" />
      <input
        ref={inputRef}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") { e.preventDefault(); commit() }
          if (e.key === "Escape") cancel()
        }}
        placeholder="Item description…"
        className="flex-1 min-w-0 bg-transparent text-sm font-medium leading-tight text-foreground outline-none placeholder:text-muted-foreground/50"
      />
      <div className="flex items-center gap-1 shrink-0">
        <button
          type="button"
          onMouseDown={(e) => { e.preventDefault(); commit() }}
          className="rounded-md bg-primary px-2.5 py-1 text-xs font-semibold text-primary-foreground hover:bg-primary/90 transition-colors"
        >
          Add
        </button>
        <button
          type="button"
          onMouseDown={(e) => { e.preventDefault(); cancel() }}
          className="rounded-md px-2.5 py-1 text-xs font-semibold text-muted-foreground hover:bg-muted transition-colors"
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
}: {
  items: ListItem[]
  onChange: (items: ListItem[]) => void
}) {
  const [filter, setFilter] = useState<StatusFilter>("all")

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
      const reordered = arrayMove(items, oldIndex, newIndex).map((item, idx) => ({
        ...item,
        order: idx,
      }))
      onChange(reordered)
    },
    [items, onChange],
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
    (id: string, description: string) => {
      onChange(items.map((item) => (item.id === id ? { ...item, description } : item)))
    },
    [items, onChange],
  )

  const handleAdd = useCallback(
    (description: string) => {
      if (items.length >= MAX_ITEMS) return
      const now = new Date().toISOString()
      const newItem: ListItem = {
        id: nanoid(),
        description,
        status: "Open",
        order: items.length,
        date_created: now,
      }
      onChange([...items, newItem])
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

  const atLimit = items.length >= MAX_ITEMS

  return (
    <div className="flex flex-col gap-3">
      {/* Filter bar — All / Open / Done only */}
      <div className="flex items-center gap-1.5">
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
        {atLimit && (
          <span className="ml-auto text-xs text-amber-500 font-medium">
            {MAX_ITEMS} item limit reached
          </span>
        )}
      </div>

      {/* List */}
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={visibleItems.map((i) => i.id)} strategy={verticalListSortingStrategy}>
          <div className="flex flex-col gap-2">
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
                  onToggleStatus={handleToggleStatus}
                  onDelete={handleDelete}
                  onRename={handleRename}
                />
              ))
            )}
          </div>
        </SortableContext>
      </DndContext>

      {/* Add item (only when not filtered) */}
      {filter !== "done" && !atLimit && (
        <AddItemRow onAdd={handleAdd} />
      )}
    </div>
  )
}
