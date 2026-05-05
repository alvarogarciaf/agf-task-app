"use client"

import { useState } from "react"
import {
  type LucideIcon,
  Brain, Plus, Trash2, Edit2, Check, X, MoreVertical
} from "lucide-react"
import { ICON_OPTIONS, ICONS, COLOR_PALETTE } from "@/lib/constants"
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
import type { Context, Task } from "@/lib/types"



interface ContextsViewProps {
  contexts: Context[]
  tasks: Task[]
  onSelect: (contextId: string) => void
  onUpdateContext?: (context: Context) => void
  onDeleteContext?: (id: string) => void
  onAddContext?: (context: Omit<Context, "id">) => void
}

export function ContextsView({ contexts, tasks, onSelect, onUpdateContext, onDeleteContext, onAddContext }: ContextsViewProps) {
  const [editing, setEditing] = useState<Context | null>(null)
  const [isAdding, setIsAdding] = useState(false)

  return (
    <div>
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

      <div className="space-y-1.5">
        {contexts.map((c) => {
          const Icon = ICONS[c.icon] ?? Brain
          const open = tasks.filter((t) => t.context_ids.includes(c.id) && t.processed && t.status === "Open" && !t.archived).length
          return (
            <div
              key={c.id}
              className="group flex items-center gap-3 rounded-lg border border-border bg-card px-4 py-3 transition-colors hover:border-primary/30 hover:bg-card/80"
            >
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

              {/* Name — tappable to navigate */}
              <button
                type="button"
                onClick={() => onSelect(c.id)}
                className="flex-1 text-left"
              >
                <span className="text-base font-medium tracking-tight md:text-sm">{c.name}</span>
              </button>

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
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground md:opacity-0 md:group-hover:opacity-100"
                    aria-label={`Options for ${c.name}`}
                  >
                    <MoreVertical className="h-4 w-4" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-32">
                  <DropdownMenuItem
                    onClick={() => {
                      const plain: Context = {
                        id: c.id,
                        name: c.name,
                        icon: c.icon,
                        color: c.color,
                      }
                      setEditing(plain)
                    }}
                  >
                    <Edit2 className="h-3.5 w-3.5 mr-2" />
                    Edit
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    className="text-destructive focus:text-destructive"
                    onClick={() => {
                      if (confirm(`Are you sure you want to delete context "${c.name}"?`)) {
                        onDeleteContext?.(c.id)
                      }
                    }}
                  >
                    <Trash2 className="h-3.5 w-3.5 mr-2" />
                    Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          )
        })}
      </div>

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
            <label className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-wider text-muted-foreground mb-1.5">
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
            <label className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-wider text-muted-foreground mb-2">
              Icon
            </label>
            <div className="grid grid-cols-8 gap-1.5 sm:grid-cols-9">
              {ICON_OPTIONS.map((opt) => {
                const OptIcon = opt.icon
                const isSelected = icon === opt.name
                return (
                  <button
                    key={opt.name}
                    type="button"
                    onClick={() => setIcon(opt.name)}
                    className={cn(
                      "flex h-10 w-10 items-center justify-center rounded-lg border transition-colors md:h-9 md:w-9",
                      isSelected
                        ? "border-primary bg-primary/15 text-primary"
                        : "border-transparent text-muted-foreground hover:bg-muted hover:text-foreground"
                    )}
                    aria-label={opt.name}
                  >
                    <OptIcon className="h-4.5 w-4.5 md:h-4 md:w-4" />
                  </button>
                )
              })}
            </div>
          </div>

          {/* Color picker */}
          <div>
            <label className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-wider text-muted-foreground mb-2">
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
