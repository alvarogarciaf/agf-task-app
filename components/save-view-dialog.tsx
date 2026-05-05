import * as React from "react"
import { useState } from "react"
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

interface SaveViewDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSave: (name: string) => void
}

export function SaveViewDialog({ open, onOpenChange, onSave }: SaveViewDialogProps) {
  const [name, setName] = useState("")

  const handleSave = () => {
    if (name.trim()) {
      onSave(name.trim())
      setName("")
      onOpenChange(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Save Current View</DialogTitle>
          <DialogDescription>
            Give this view a name to save it to your sidebar.
          </DialogDescription>
        </DialogHeader>
        <div className="flex items-center space-x-2 py-4">
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g., Focus Mode, Work Projects..."
            onKeyDown={(e) => {
              if (e.key === "Enter") handleSave()
            }}
            autoFocus
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={!name.trim()}>
            Save View
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
