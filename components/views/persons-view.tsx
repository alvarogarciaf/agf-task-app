"use client"

import { useState } from "react"
import { MoreVertical, Edit2, Check, X, Trash2, Plus } from "lucide-react"
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
import type { Person, Task } from "@/lib/types"

const COLOR_PALETTE = [
  "#ef4444", "#f97316", "#f59e0b", "#eab308",
  "#84cc16", "#22c55e", "#14b8a6", "#06b6d4",
  "#3b82f6", "#6366f1", "#8b5cf6", "#a855f7",
  "#d946ef", "#ec4899", "#f43f5e", "#78716c",
]

interface PersonsViewProps {
  persons: Person[]
  tasks: Task[]
  onSelect: (personId: string) => void
  onUpdatePerson?: (person: Person) => void
  onDeletePerson?: (id: string) => void
  onAddPerson?: (person: Omit<Person, "id">) => void
}

export function PersonsView({ persons, tasks, onSelect, onUpdatePerson, onDeletePerson, onAddPerson }: PersonsViewProps) {
  const [editing, setEditing] = useState<Person | null>(null)
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
          Add Person
        </button>
      </div>

      <div className="space-y-1.5">
        {persons.map((p) => {
          const open = tasks.filter((t) => t.person_id === p.id && t.processed && t.status === "Open").length
          return (
            <div
              key={p.id}
              className="group flex items-center gap-3 rounded-lg border border-border bg-card px-4 py-3 transition-colors hover:border-primary/30 hover:bg-card/80"
            >
              {/* Avatar */}
              <div
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-semibold md:h-9 md:w-9"
                style={{
                  backgroundColor: `color-mix(in oklch, ${p.color} 15%, transparent)`,
                  color: p.color,
                  boxShadow: `inset 0 0 0 1px color-mix(in oklch, ${p.color} 30%, transparent)`,
                }}
              >
                {p.initials}
              </div>

              {/* Name — tappable to navigate */}
              <button
                type="button"
                onClick={() => onSelect(p.id)}
                className="flex-1 text-left"
              >
                <span className="text-base font-medium tracking-tight md:text-sm">{p.name}</span>
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
                    aria-label={`Options for ${p.name}`}
                  >
                    <MoreVertical className="h-4 w-4" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-32">
                  <DropdownMenuItem
                    onClick={() => {
                      const plain: Person = {
                        id: p.id,
                        name: p.name,
                        initials: p.initials,
                        color: p.color,
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
                      if (confirm(`Are you sure you want to delete person "${p.name}"?`)) {
                        onDeletePerson?.(p.id)
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
        <PersonDialog
          person={editing}
          open={!!editing}
          onOpenChange={(open) => { if (!open) setEditing(null) }}
          onSave={(updated) => {
            onUpdatePerson?.(updated)
            setEditing(null)
          }}
          onDelete={(id) => {
            onDeletePerson?.(id)
            setEditing(null)
          }}
        />
      )}

      {/* Add Dialog */}
      {isAdding && (
        <PersonDialog
          open={isAdding}
          onOpenChange={setIsAdding}
          onSave={(newPerson) => {
            onAddPerson?.(newPerson)
            setIsAdding(false)
          }}
        />
      )}
    </div>
  )
}

function PersonDialog({
  person,
  open,
  onOpenChange,
  onSave,
  onDelete,
}: {
  person?: Person
  open: boolean
  onOpenChange: (open: boolean) => void
  onSave: (person: any) => void
  onDelete?: (id: string) => void
}) {
  const isEditing = !!person
  const [name, setName] = useState(person?.name ?? "")
  const [initials, setInitials] = useState(person?.initials ?? "")
  const [color, setColor] = useState(person?.color ?? COLOR_PALETTE[0])

  function handleSave() {
    if (!name.trim() || !initials.trim()) return
    onSave(isEditing ? { ...person, name: name.trim(), initials: initials.trim().toUpperCase(), color } : { name: name.trim(), initials: initials.trim().toUpperCase(), color })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent showCloseButton={false} className="max-w-md gap-0 overflow-hidden p-0 sm:rounded-xl">
        <DialogTitle className="sr-only">{isEditing ? "Edit person" : "Add person"}</DialogTitle>

        {/* Header */}
        <div className="flex items-center justify-between border-b border-border bg-card px-5 py-3">
          <div className="flex items-center gap-2">
            <div
              className="flex h-8 w-8 items-center justify-center rounded-full text-[10px] font-bold"
              style={{
                backgroundColor: `color-mix(in oklch, ${color} 15%, transparent)`,
                color: color,
              }}
            >
              {initials || "?"}
            </div>
            <span className="text-sm font-semibold">{isEditing ? "Edit Person" : "New Person"}</span>
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
          <div className="grid gap-4 sm:grid-cols-[1fr_80px]">
            <div>
              <label className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-wider text-muted-foreground mb-1.5">
                Full Name
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => {
                  setName(e.target.value)
                  // Auto-generate initials if they match previous name's auto-initials
                  const words = e.target.value.trim().split(/\s+/)
                  const auto = words.length >= 2 
                    ? (words[0][0] + words[1][0]).toUpperCase()
                    : words[0][0]?.toUpperCase() || ""
                  if (!initials || initials === (name.trim().split(/\s+/).slice(0, 2).map(w => w[0]).join("").toUpperCase())) {
                    setInitials(auto)
                  }
                }}
                className="h-11 w-full rounded-md border border-border bg-background px-3 text-base focus:outline-none focus:ring-2 focus:ring-ring/40 md:h-9 md:text-sm"
                placeholder="Person name"
              />
            </div>
            <div>
              <label className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-wider text-muted-foreground mb-1.5">
                Initials
              </label>
              <input
                type="text"
                value={initials}
                onChange={(e) => setInitials(e.target.value.slice(0, 3).toUpperCase())}
                className="h-11 w-full rounded-md border border-border bg-background px-3 text-center text-base font-mono focus:outline-none focus:ring-2 focus:ring-ring/40 md:h-9 md:text-sm"
                placeholder="XY"
              />
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
              onClick={() => onDelete(person.id)}
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
              disabled={!name.trim() || !initials.trim()}
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
