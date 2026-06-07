"use client"

import { useState } from "react"
import {
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
import type { Tag, Task } from "@/lib/types"



interface TagsViewProps {
  tags: Tag[]
  notes: Task[]
  onSelect: (tagId: string) => void
  onUpdateTag?: (tag: Tag) => void
  onDeleteTag?: (id: string) => void
  onAddTag?: (tag: Omit<Tag, "id">) => void
}

export function TagsView({ tags, notes, onSelect, onUpdateTag, onDeleteTag, onAddTag }: TagsViewProps) {
  const [editing, setEditing] = useState<Tag | null>(null)
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
          Add Tag
        </button>
      </div>

      <div className="space-y-1.5">
        {tags.map((t) => {
          const Icon = ICONS[t.icon] ?? Brain
          const count = notes.filter((n) => (n.tag_ids || []).includes(t.id)).length
          return (
            <div
              key={t.id}
              onClick={(e) => {
                const target = e.target as HTMLElement
                if (target.closest('[data-options-trigger="true"]')) {
                  return
                }
                onSelect(t.id)
              }}
              className="group flex cursor-pointer items-center gap-3 rounded-lg border border-border bg-card px-4 py-3 transition-colors hover:border-primary/30 hover:bg-card/80"
            >
              {/* Icon */}
              <div
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg md:h-9 md:w-9"
                style={{
                  backgroundColor: `color-mix(in oklch, ${t.color} 15%, transparent)`,
                  color: t.color,
                  boxShadow: `inset 0 0 0 1px color-mix(in oklch, ${t.color} 30%, transparent)`,
                }}
              >
                <Icon className="h-5 w-5 md:h-4 md:w-4" />
              </div>

              {/* Name */}
              <div className="flex-1 text-left">
                <span className="text-base font-medium tracking-tight md:text-sm">{t.name}</span>
              </div>

              {/* Note count */}
              {count > 0 ? (
                <span className="rounded-md bg-primary/10 px-2 py-0.5 font-mono text-xs tabular-nums text-primary">
                  {count}
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
                    aria-label={`Options for ${t.name}`}
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
                      const plain: Tag = {
                        id: t.id,
                        name: t.name,
                        icon: t.icon,
                        color: t.color,
                      }
                      setEditing(plain)
                    }}
                  >
                    <Edit2 className="h-3.5 w-3.5 mr-2" />
                    Edit
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    className="text-destructive focus:text-destructive"
                    onClick={(e) => {
                      e.stopPropagation()
                      if (confirm(`Are you sure you want to delete tag "${t.name}"?`)) {
                        onDeleteTag?.(t.id)
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
        <TagDialog
          tag={editing}
          open={!!editing}
          onOpenChange={(open) => { if (!open) setEditing(null) }}
          onSave={(updated) => {
            onUpdateTag?.(updated)
            setEditing(null)
          }}
          onDelete={(id) => {
            onDeleteTag?.(id)
            setEditing(null)
          }}
        />
      )}

      {/* Add Dialog */}
      {isAdding && (
        <TagDialog
          open={isAdding}
          onOpenChange={setIsAdding}
          onSave={(newTag) => {
            onAddTag?.(newTag)
            setIsAdding(false)
          }}
        />
      )}
    </div>
  )
}

function TagDialog({
  tag,
  open,
  onOpenChange,
  onSave,
  onDelete,
}: {
  tag?: Tag
  open: boolean
  onOpenChange: (open: boolean) => void
  onSave: (tag: any) => void
  onDelete?: (id: string) => void
}) {
  const isEditing = !!tag
  const [name, setName] = useState(tag?.name ?? "")
  const [icon, setIcon] = useState(tag?.icon ?? "Brain")
  const [color, setColor] = useState(tag?.color ?? COLOR_PALETTE[0])

  const SelectedIcon = ICONS[icon] ?? Brain

  function handleSave() {
    if (!name.trim()) return
    onSave(isEditing ? { ...tag, name: name.trim(), icon, color } : { name: name.trim(), icon, color })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent showCloseButton={false} className="max-w-md gap-0 overflow-hidden p-0 sm:rounded-xl">
        <DialogTitle className="sr-only">{isEditing ? "Edit tag" : "Add tag"}</DialogTitle>

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
            <span className="text-sm font-semibold">{isEditing ? "Edit Tag" : "New Tag"}</span>
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
              placeholder="Tag name"
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
              onClick={() => onDelete(tag.id)}
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
