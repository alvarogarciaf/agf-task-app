import * as React from "react"
import { useState, useEffect } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Check, X, Star } from "lucide-react"
import { cn } from "@/lib/utils"
import { ICON_OPTIONS, ICONS, COLOR_PALETTE } from "@/lib/constants"
import type { SavedView } from "@/lib/types"

interface SaveViewDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSave: (data: { name: string; icon: string; color: string }) => void
  editingView?: SavedView | null
}

export function SaveViewDialog({ open, onOpenChange, onSave, editingView }: SaveViewDialogProps) {
  const [name, setName] = useState("")
  const [icon, setIcon] = useState("Star")
  const [color, setColor] = useState(COLOR_PALETTE[0])

  useEffect(() => {
    if (editingView) {
      setName(editingView.name)
      setIcon(editingView.icon || "Star")
      setColor(editingView.color || COLOR_PALETTE[0])
    } else {
      setName("")
      setIcon("Star")
      setColor(COLOR_PALETTE[0])
    }
  }, [editingView, open])

  const handleSave = () => {
    if (name.trim()) {
      onSave({ 
        name: name.trim(), 
        icon, 
        color 
      })
      onOpenChange(false)
    }
  }

  const SelectedIcon = ICONS[icon] || Star

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent showCloseButton={false} className="max-w-md gap-0 overflow-hidden p-0 sm:rounded-xl">
        <DialogTitle className="sr-only">{editingView ? "Edit view" : "Save current view"}</DialogTitle>

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
            <span className="text-sm font-semibold">{editingView ? "Edit Saved View" : "New Saved View"}</span>
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
        <div className="space-y-5 px-5 py-5 max-h-[70vh] overflow-y-auto">
          {/* Name */}
          <div>
            <label className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-wider text-muted-foreground mb-1.5">
              Name
            </label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="h-11 w-full md:h-9"
              placeholder="e.g., Focus Mode, Work Projects..."
              onKeyDown={(e) => {
                if (e.key === "Enter") handleSave()
              }}
              autoFocus
            />
          </div>

          {/* Icon picker */}
          <div>
            <label className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-wider text-muted-foreground mb-2">
              Icon
            </label>
            <div className="grid grid-cols-7 gap-1.5 sm:grid-cols-9">
              {ICON_OPTIONS.slice(0, 45).map((opt) => {
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
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button size="sm" onClick={handleSave} disabled={!name.trim()}>
            <Check className="mr-2 h-3.5 w-3.5" />
            {editingView ? "Update View" : "Save View"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
