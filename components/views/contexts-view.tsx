"use client"

import { useState, useMemo, useEffect } from "react"
import {
  Brain, Plus, Trash2, Edit2, Check, X, MoreVertical, GripVertical
} from "lucide-react"
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core"
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { ICONS, COLOR_PALETTE } from "@/lib/constants"
import { IconPicker } from "@/components/icon-picker"
import { cn } from "@/lib/utils"
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import type { Context, Project, Task } from "@/lib/types"

interface ContextsViewProps {
  contexts: Context[]
  tasks: Task[]
  projects?: Project[]
  onSelect: (contextId: string) => void
  onUpdateContext?: (context: Context) => void
  onDeleteContext?: (id: string) => void
  onAddContext?: (context: Omit<Context, "id">) => void
  onReorderContexts?: (activeId: string, overId: string) => void
}

function SortableContextRow({
  context: c,
  openCount: open,
  onSelect,
  onEdit,
  onDelete,
}: {
  context: Context
  openCount: number
  onSelect: () => void
  onEdit: () => void
  onDelete: () => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: c.id,
  })
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.45 : undefined,
    position: "relative" as const,
    zIndex: isDragging ? 10 : 0,
  }
  const Icon = ICONS[c.icon] ?? Brain

  return (
    <div
      ref={setNodeRef}
      style={style}
      onClick={(e) => {
        const target = e.target as HTMLElement
        if (target.closest('[data-options-trigger="true"]') || target.closest('[data-drag-handle="true"]')) {
          return
        }
        onSelect()
      }}
      className={cn(
        "group flex cursor-pointer items-center gap-3 rounded-lg border border-border bg-card px-3 py-3 transition-colors hover:border-primary/30 hover:bg-card/80",
        isDragging && "shadow-md border-primary/40",
      )}
    >
      {/* Drag Handle */}
      <div
        {...attributes}
        {...listeners}
        data-drag-handle="true"
        onClick={(e) => e.stopPropagation()}
        className="cursor-grab active:cursor-grabbing text-muted-foreground/30 hover:text-muted-foreground p-1 -ml-1 shrink-0 touch-none"
        aria-label={`Reorder ${c.name}`}
      >
        <GripVertical className="h-4 w-4" />
      </div>

      {/* Icon */}
      <div
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg md:h-9 md:w-9"
        style={{
          backgroundColor: `color-mix(in oklch, ${c.color} 15%, transparent)`,
          color: c.color,
          boxShadow: `inset 0 0 0 1px color-mix(in oklch, ${c.color} 30%, transparent)`,
        }}
      >
        <Icon className="h-5 w-5 md:h-4 md:w-4" />
      </div>

      {/* Name */}
      <div className="flex-1 text-left">
        <span className="text-base font-medium tracking-tight md:text-sm">{c.name}</span>
      </div>

      {/* Open count */}
      {open > 0 ? (
        <span className="rounded-md bg-primary/10 px-2 py-0.5 font-mono text-xs tabular-nums text-primary">
          {open}
        </span>
      ) : (
        <span className="rounded-md bg-muted px-2 py-0.5 font-mono text-xs tabular-nums text-muted-foreground">
          0
        </span>
      )}

      {/* Options Menu */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            data-options-trigger="true"
            onClick={(e) => e.stopPropagation()}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground md:opacity-0 md:group-hover:opacity-100"
            aria-label={`Options for ${c.name}`}
          >
            <MoreVertical className="h-4 w-4" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="end"
          className="w-32"
          onClick={(e) => e.stopPropagation()}
        >
          <DropdownMenuItem
            onClick={(e) => {
              e.stopPropagation()
              onEdit()
            }}
          >
            <Edit2 className="h-3.5 w-3.5 mr-2" />
            Edit
          </DropdownMenuItem>
          <DropdownMenuItem
            className="text-destructive focus:text-destructive"
            onClick={(e) => {
              e.stopPropagation()
              onDelete()
            }}
          >
            <Trash2 className="h-3.5 w-3.5 mr-2" />
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}

export function ContextsView({
  contexts,
  tasks,
  projects = [],
  onSelect,
  onUpdateContext,
  onDeleteContext,
  onAddContext,
  onReorderContexts,
}: ContextsViewProps) {
  const [editing, setEditing] = useState<Context | null>(null)
  const [isAdding, setIsAdding] = useState(false)
  const [optimisticContexts, setOptimisticContexts] = useState(contexts)

  useEffect(() => {
    setOptimisticContexts(contexts)
  }, [contexts])

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    if (over && active.id !== over.id) {
      setOptimisticContexts((prev) => {
        const oldIndex = prev.findIndex((c) => c.id === active.id)
        const newIndex = prev.findIndex((c) => c.id === over.id)
        if (oldIndex === -1 || newIndex === -1) return prev
        return arrayMove(prev, oldIndex, newIndex).map((c, i) => ({ ...c, order: i }))
      })
      onReorderContexts?.(active.id as string, over.id as string)
    }
  }

  const closedProjectIds = useMemo(() => {
    return new Set(projects.filter((p) => p.status === "Closed").map((p) => p.id))
  }, [projects])

  return (
    <div className="px-2 pt-2 pb-24 md:px-0 md:pt-0 md:pb-0">
      {/* Header with Add Button */}
      <div className="mb-6">
        <button
          onClick={() => setIsAdding(true)}
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-all hover:bg-primary/90 hover:shadow-md active:scale-95"
        >
          <Plus className="h-4 w-4" />
          Add Context
        </button>
      </div>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext
          items={optimisticContexts.map((c) => c.id)}
          strategy={verticalListSortingStrategy}
        >
          <div className="space-y-1.5">
            {optimisticContexts.map((c) => {
              const open = tasks.filter(
                (t) =>
                  t.context_ids.includes(c.id) &&
                  t.processed &&
                  t.status === "Open" &&
                  !(t.project_id && closedProjectIds.has(t.project_id)),
              ).length
              return (
                <SortableContextRow
                  key={c.id}
                  context={c}
                  openCount={open}
                  onSelect={() => onSelect(c.id)}
                  onEdit={() =>
                    setEditing({
                      id: c.id,
                      name: c.name,
                      icon: c.icon,
                      color: c.color,
                      order: c.order,
                    })
                  }
                  onDelete={() => {
                    if (confirm(`Are you sure you want to delete context "${c.name}"?`)) {
                      onDeleteContext?.(c.id)
                    }
                  }}
                />
              )
            })}
          </div>
        </SortableContext>
      </DndContext>

      {/* Edit Dialog */}
      {editing && (
        <ContextDialog
          context={editing}
          open={!!editing}
          onOpenChange={(open) => { if (!open) setEditing(null) }}
          onSave={(updated) => {
            onUpdateContext?.(updated)
            setEditing(null)
          }}
          onDelete={(id) => {
            onDeleteContext?.(id)
            setEditing(null)
          }}
        />
      )}

      {/* Add Dialog */}
      {isAdding && (
        <ContextDialog
          open={isAdding}
          onOpenChange={setIsAdding}
          onSave={(newContext) => {
            onAddContext?.(newContext)
            setIsAdding(false)
          }}
        />
      )}
    </div>
  )
}

function ContextDialog({
  context,
  open,
  onOpenChange,
  onSave,
  onDelete,
}: {
  context?: Context
  open: boolean
  onOpenChange: (open: boolean) => void
  onSave: (context: any) => void
  onDelete?: (id: string) => void
}) {
  const isEditing = !!context
  const [name, setName] = useState(context?.name ?? "")
  const [icon, setIcon] = useState(context?.icon ?? "Brain")
  const [color, setColor] = useState(context?.color ?? COLOR_PALETTE[0])

  const SelectedIcon = ICONS[icon] ?? Brain

  function handleSave() {
    if (!name.trim()) return
    onSave(isEditing ? { ...context, name: name.trim(), icon, color } : { name: name.trim(), icon, color })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent showCloseButton={false} className="max-w-md gap-0 overflow-hidden p-0 sm:rounded-xl">
        <DialogTitle className="sr-only">{isEditing ? "Edit context" : "Add context"}</DialogTitle>

        {/* Header */}
        <div className="flex items-center justify-between border-b border-border bg-card px-5 py-3">
          <div className="flex items-center gap-2">
            <div
              className="flex h-8 w-8 items-center justify-center rounded-md"
              style={{
                backgroundColor: `color-mix(in oklch, ${color} 15%, transparent)`,
                color: color,
              }}
            >
              <SelectedIcon className="h-4 w-4" />
            </div>
            <span className="text-sm font-semibold">{isEditing ? "Edit Context" : "New Context"}</span>
          </div>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body */}
        <div className="space-y-5 px-5 py-5">
          {/* Name */}
          <div>
            <label className="flex items-center gap-1.5 font-mono text-xs uppercase tracking-wider text-muted-foreground mb-1.5">
              Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="h-11 w-full rounded-md border border-border bg-background px-3 text-base focus:outline-none focus:ring-2 focus:ring-ring/40 md:h-9 md:text-sm"
              placeholder="Context name"
            />
          </div>

          {/* Icon picker */}
          <div>
            <label className="flex items-center gap-1.5 font-mono text-xs uppercase tracking-wider text-muted-foreground mb-2">
              Icon
            </label>
            <IconPicker value={icon} onChange={setIcon} />
          </div>

          {/* Color picker */}
          <div>
            <label className="flex items-center gap-1.5 font-mono text-xs uppercase tracking-wider text-muted-foreground mb-2">
              Color
            </label>
            <div className="flex flex-wrap gap-2">
              {COLOR_PALETTE.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  className={cn(
                    "h-8 w-8 rounded-full border-2 transition-all",
                    color === c
                      ? "border-foreground scale-110"
                      : "border-transparent hover:scale-110"
                  )}
                  style={{ backgroundColor: c }}
                  aria-label={c}
                />
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-border bg-background/40 px-5 py-3">
          {isEditing && onDelete ? (
            <button
              type="button"
              onClick={() => onDelete(context.id)}
              className="inline-flex items-center gap-1.5 rounded-md border border-destructive/30 px-4 py-2.5 text-sm text-destructive transition-colors hover:bg-destructive/10 md:px-3 md:py-1.5 md:text-xs"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Delete
            </button>
          ) : (
            <div />
          )}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="rounded-md border border-border bg-background px-4 py-2.5 text-sm text-muted-foreground transition-colors hover:text-foreground md:px-3 md:py-1.5 md:text-xs"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={!name.trim()}
              className="inline-flex items-center gap-1.5 rounded-md bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-40 md:px-3 md:py-1.5 md:text-xs"
            >
              <Check className="h-3.5 w-3.5" />
              Save
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
