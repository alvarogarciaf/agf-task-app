"use client"

import { useState } from "react"
import { Check, ChevronDown } from "lucide-react"
import { cn } from "@/lib/utils"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"

interface FormMultiSelectOption {
  id: string
  label: string
  color?: string
}

interface FormMultiSelectProps {
  options: FormMultiSelectOption[]
  selectedIds: string[]
  onChange: (ids: string[]) => void
  placeholder?: string
}

export function FormMultiSelect({
  options,
  selectedIds,
  onChange,
  placeholder = "Select…",
}: FormMultiSelectProps) {
  const [open, setOpen] = useState(false)

  const selected = options.filter((o) => selectedIds.includes(o.id))

  function toggle(id: string) {
    const next = selectedIds.includes(id)
      ? selectedIds.filter((x) => x !== id)
      : [...selectedIds, id]
    onChange(next)
  }

  const triggerLabel =
    selected.length === 0
      ? placeholder
      : selected.length === 1
        ? selected[0].label
        : `${selected.length} selected`

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            "mt-1.5 flex h-11 w-full items-center justify-between gap-2 rounded-md border border-border bg-background px-3 text-base transition-colors focus:outline-none focus:ring-2 focus:ring-ring/40 md:h-9 md:text-sm",
            selected.length === 0 && "text-muted-foreground",
          )}
        >
          <span className="flex min-w-0 flex-1 items-center gap-1.5">
            {selected.length === 1 && selected[0].color ? (
              <span
                className="h-1.5 w-1.5 shrink-0 rounded-full"
                style={{ backgroundColor: selected[0].color }}
              />
            ) : null}
            <span className="truncate">{triggerLabel}</span>
          </span>
          <ChevronDown className="h-4 w-4 shrink-0 opacity-50" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[var(--radix-popover-trigger-width)] p-1">
        <div className="max-h-64 overflow-auto">
          {options.length === 0 ? (
            <p className="px-3 py-2 text-sm text-muted-foreground">No options</p>
          ) : (
            options.map((opt) => {
              const isSelected = selectedIds.includes(opt.id)
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => toggle(opt.id)}
                  className="flex w-full items-center gap-3 rounded px-4 py-3.5 text-left text-lg hover:bg-muted md:px-2 md:py-1.5 md:text-sm"
                >
                  {opt.color ? (
                    <span
                      className="h-2 w-2 shrink-0 rounded-full"
                      style={{ backgroundColor: opt.color }}
                    />
                  ) : (
                    <span className="h-2 w-2 shrink-0 rounded-full bg-muted-foreground/40" />
                  )}
                  <span className="flex-1 truncate">{opt.label}</span>
                  {isSelected ? (
                    <Check className="h-4 w-4 shrink-0 text-primary" />
                  ) : null}
                </button>
              )
            })
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}
