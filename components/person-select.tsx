"use client"

import { useState, useRef, useMemo } from "react"
import { Check, ChevronDown, User } from "lucide-react"
import { cn } from "@/lib/utils"
import { useIsMobile } from "@/hooks/use-mobile"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { useMobileDropdownAlign } from "@/hooks/use-mobile-dropdown-align"
import type { Person } from "@/lib/types"

interface PersonSelectProps {
  persons: Person[]
  value: string | null
  onChange: (personId: string | null) => void
  disabled?: boolean
  placeholder?: string
  noneLabel?: string
  className?: string
  triggerClassName?: string
}

export function PersonSelect({
  persons,
  value,
  onChange,
  disabled = false,
  placeholder = "No one",
  noneLabel = "No one",
  className,
  triggerClassName,
}: PersonSelectProps) {
  const isMobile = useIsMobile()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState("")
  const [highlightedIdx, setHighlightedIdx] = useState(0)

  const triggerRef = useRef<HTMLButtonElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useMobileDropdownAlign({
    open,
    triggerRef,
    inputRef,
  })

  const selected = persons.find((p) => p.id === value) ?? null

  const filtered = useMemo(() => {
    const trimmed = query.trim().toLowerCase()
    if (!trimmed) return persons
    return persons.filter((p) => p.name.toLowerCase().includes(trimmed))
  }, [persons, query])

  type Item = {
    id: string | null
    name: string
    person: Person | null
  }

  const items: Item[] = useMemo(() => {
    const list: Item[] = []
    const trimmed = query.trim().toLowerCase()
    if (!trimmed || noneLabel.toLowerCase().includes(trimmed)) {
      list.push({ id: null, name: noneLabel, person: null })
    }
    for (const p of filtered) {
      list.push({ id: p.id, name: p.name, person: p })
    }
    return list
  }, [filtered, noneLabel, query])

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") {
      e.preventDefault()
      setHighlightedIdx((prev) => (prev + 1) % Math.max(1, items.length))
    } else if (e.key === "ArrowUp") {
      e.preventDefault()
      setHighlightedIdx((prev) => (prev - 1 + items.length) % Math.max(1, items.length))
    } else if (e.key === "Enter") {
      e.preventDefault()
      const item = items[highlightedIdx]
      if (item) {
        onChange(item.id)
        setOpen(false)
      }
    } else if (e.key === "Escape") {
      e.preventDefault()
      setOpen(false)
    }
  }

  return (
    <Popover open={open} onOpenChange={setOpen} modal={false}>
      <PopoverTrigger asChild>
        <button
          ref={triggerRef}
          type="button"
          disabled={disabled}
          className={cn(
            "flex h-11 w-full items-center justify-between gap-2 rounded-md border border-border bg-background px-3 text-base transition-colors focus:outline-none focus:ring-2 focus:ring-ring/40 md:h-9 md:text-sm",
            disabled && "opacity-80 cursor-not-allowed bg-muted/20",
            className,
            triggerClassName,
          )}
        >
          {selected ? (
            <span className="flex min-w-0 flex-1 items-center gap-2">
              <span
                className="flex h-5 w-5 items-center justify-center rounded-full text-[11px] font-semibold shrink-0"
                style={{
                  backgroundColor: `color-mix(in oklch, ${selected.color} 30%, transparent)`,
                }}
              >
                {selected.initials}
              </span>
              <span className="truncate">{selected.name}</span>
            </span>
          ) : (
            <span className="truncate text-muted-foreground">{placeholder}</span>
          )}
          <ChevronDown className="h-4 w-4 shrink-0 opacity-50" />
        </button>
      </PopoverTrigger>

      <PopoverContent
        align="start"
        side={isMobile ? "top" : "bottom"}
        sideOffset={6}
        collisionPadding={12}
        className="z-[100] w-[var(--radix-popover-trigger-width)] overflow-hidden p-0"
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value)
            setHighlightedIdx(0)
          }}
          onKeyDown={handleKeyDown}
          placeholder="Search persons…"
          className="w-full border-b border-border bg-background px-3 py-2 text-sm outline-none placeholder:text-muted-foreground focus:ring-0"
        />
        <div
          className="overflow-y-auto overscroll-contain touch-pan-y p-1"
          style={{
            maxHeight: "min(320px, calc(var(--radix-popover-content-available-height) - 50px))",
            WebkitOverflowScrolling: "touch",
          }}
          onTouchStart={(e) => e.stopPropagation()}
          onTouchMove={(e) => e.stopPropagation()}
          onWheel={(e) => e.stopPropagation()}
        >
          {items.length === 0 ? (
            <p className="px-3 py-2 text-sm text-muted-foreground">No persons found</p>
          ) : (
            items.map((item, idx) => {
              const isSelected = value === item.id || (!value && item.id === null)
              const isHighlighted = idx === highlightedIdx
              return (
                <button
                  key={item.id ?? "__none__"}
                  type="button"
                  onMouseEnter={() => setHighlightedIdx(idx)}
                  onClick={() => {
                    onChange(item.id)
                    setOpen(false)
                  }}
                  className={cn(
                    "flex w-full items-center gap-2.5 rounded-md px-2.5 py-3 text-left text-base md:py-2 md:text-sm transition-colors",
                    isHighlighted && "bg-muted ring-1 ring-inset ring-primary/40",
                    !isHighlighted && "hover:bg-muted",
                    item.id === null && "text-muted-foreground",
                  )}
                >
                  {item.person ? (
                    <span
                      className="flex h-5 w-5 items-center justify-center rounded-full text-[11px] font-semibold shrink-0"
                      style={{
                        backgroundColor: `color-mix(in oklch, ${item.person.color} 30%, transparent)`,
                      }}
                    >
                      {item.person.initials}
                    </span>
                  ) : (
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-dashed border-border" />
                  )}
                  <span className="flex-1 truncate">{item.name}</span>
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
