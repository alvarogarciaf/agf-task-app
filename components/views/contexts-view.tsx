"use client"

import { useState } from "react"
import {
  Brain,
  Phone,
  ShoppingBag,
  Home,
  Eye,
  PenLine,
  WifiOff,
  Zap,
  Pencil,
  Check,
  X,
  Briefcase,
  Car,
  Coffee,
  Dumbbell,
  Globe,
  Heart,
  Laptop,
  Mail,
  MapPin,
  MessageCircle,
  Music,
  Package,
  Plane,
  School,
  Settings,
  Star,
  Sun,
  Wrench,
  type LucideIcon,
} from "lucide-react"
import { cn } from "@/lib/utils"
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog"
import type { Context, Task } from "@/lib/types"

// Full icon set available for context editing
const ICON_OPTIONS: { name: string; icon: LucideIcon }[] = [
  { name: "Brain", icon: Brain },
  { name: "Phone", icon: Phone },
  { name: "ShoppingBag", icon: ShoppingBag },
  { name: "Home", icon: Home },
  { name: "Eye", icon: Eye },
  { name: "PenLine", icon: PenLine },
  { name: "WifiOff", icon: WifiOff },
  { name: "Zap", icon: Zap },
  { name: "Briefcase", icon: Briefcase },
  { name: "Car", icon: Car },
  { name: "Coffee", icon: Coffee },
  { name: "Dumbbell", icon: Dumbbell },
  { name: "Globe", icon: Globe },
  { name: "Heart", icon: Heart },
  { name: "Laptop", icon: Laptop },
  { name: "Mail", icon: Mail },
  { name: "MapPin", icon: MapPin },
  { name: "MessageCircle", icon: MessageCircle },
  { name: "Music", icon: Music },
  { name: "Package", icon: Package },
  { name: "Plane", icon: Plane },
  { name: "School", icon: School },
  { name: "Settings", icon: Settings },
  { name: "Star", icon: Star },
  { name: "Sun", icon: Sun },
  { name: "Wrench", icon: Wrench },
]

const ICONS: Record<string, LucideIcon> = Object.fromEntries(
  ICON_OPTIONS.map((o) => [o.name, o.icon])
)

const COLOR_PALETTE = [
  "#ef4444", "#f97316", "#f59e0b", "#eab308",
  "#84cc16", "#22c55e", "#14b8a6", "#06b6d4",
  "#3b82f6", "#6366f1", "#8b5cf6", "#a855f7",
  "#d946ef", "#ec4899", "#f43f5e", "#78716c",
]

interface ContextsViewProps {
  contexts: Context[]
  tasks: Task[]
  onSelect: (contextId: string) => void
  onUpdateContext?: (context: Context) => void
}

export function ContextsView({ contexts, tasks, onSelect, onUpdateContext }: ContextsViewProps) {
  const [editing, setEditing] = useState<Context | null>(null)

  return (
    <div className="px-6 py-6">
      <div className="space-y-1.5">
        {contexts.map((c) => {
          const Icon = ICONS[c.icon] ?? Brain
          const open = tasks.filter((t) => t.context_ids.includes(c.id) && !t.processed && !t.archived).length
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

              {/* Edit button */}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  setEditing({ ...c })
                }}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground md:opacity-0 md:group-hover:opacity-100"
                aria-label={`Edit ${c.name}`}
              >
                <Pencil className="h-4 w-4" />
              </button>
            </div>
          )
        })}
      </div>

      {/* Edit Dialog */}
      {editing && (
        <EditContextDialog
          context={editing}
          open={!!editing}
          onOpenChange={(open) => { if (!open) setEditing(null) }}
          onSave={(updated) => {
            onUpdateContext?.(updated)
            setEditing(null)
          }}
        />
      )}
    </div>
  )
}

function EditContextDialog({
  context,
  open,
  onOpenChange,
  onSave,
}: {
  context: Context
  open: boolean
  onOpenChange: (open: boolean) => void
  onSave: (context: Context) => void
}) {
  const [name, setName] = useState(context.name)
  const [icon, setIcon] = useState(context.icon)
  const [color, setColor] = useState(context.color)

  const SelectedIcon = ICONS[icon] ?? Brain

  function handleSave() {
    if (!name.trim()) return
    onSave({ ...context, name: name.trim(), icon, color })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent showCloseButton={false} className="max-w-md gap-0 overflow-hidden p-0 sm:rounded-xl">
        <DialogTitle className="sr-only">Edit context</DialogTitle>

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
            <span className="text-sm font-semibold">Edit Context</span>
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
        <div className="flex items-center justify-end gap-2 border-t border-border bg-background/40 px-5 py-3">
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
      </DialogContent>
    </Dialog>
  )
}
