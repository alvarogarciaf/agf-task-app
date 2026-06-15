"use client"

import { useState, useRef, useLayoutEffect, useEffect, useCallback } from "react"
import { Check, ChevronDown } from "lucide-react"
import { cn } from "@/lib/utils"
import { useIsMobile } from "@/hooks/use-mobile"
import { ICONS } from "@/lib/constants"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"

interface FormMultiSelectOption {
  id: string
  label: string
  color?: string
  icon?: string | null
}

interface FormMultiSelectProps {
  options: FormMultiSelectOption[]
  selectedIds: string[]
  onChange: (ids: string[]) => void
  placeholder?: string
}

/** A single context/tag chip rendered inside the trigger button on mobile. */
function ContextChip({
  opt,
  className,
}: {
  opt: FormMultiSelectOption
  className?: string
}) {
  const Icon = opt.icon ? ICONS[opt.icon] : null
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium leading-none",
        className,
      )}
      style={
        opt.color
          ? {
              backgroundColor: `color-mix(in oklch, ${opt.color} 12%, transparent)`,
              color: opt.color,
              borderColor: `color-mix(in oklch, ${opt.color} 30%, transparent)`,
            }
          : undefined
      }
    >
      {Icon ? (
        <Icon className="h-2.5 w-2.5 shrink-0" />
      ) : opt.color ? (
        <span
          className="h-1.5 w-1.5 shrink-0 rounded-full"
          style={{ backgroundColor: opt.color }}
        />
      ) : null}
      <span className="truncate max-w-[80px]">{opt.label}</span>
    </span>
  )
}

export function FormMultiSelect({
  options,
  selectedIds,
  onChange,
  placeholder = "Select…",
}: FormMultiSelectProps) {
  const isMobile = useIsMobile()
  const [open, setOpen] = useState(false)

  // Ref for the visible chip row (to read available width)
  const containerRef = useRef<HTMLSpanElement>(null)
  // Ref for the hidden off-screen div that renders ALL chips at natural width
  const measureRef = useRef<HTMLDivElement>(null)

  // Start with showing everything; recalc will reduce if needed
  const [visibleCount, setVisibleCount] = useState(99)

  const selected = options.filter((o) => selectedIds.includes(o.id))

  function toggle(id: string) {
    const next = selectedIds.includes(id)
      ? selectedIds.filter((x) => x !== id)
      : [...selectedIds, id]
    onChange(next)
  }

  /**
   * Reads the natural chip widths from the hidden measurement div and computes
   * how many chips fit in the available container width.
   */
  const recalc = useCallback(() => {
    if (!isMobile || !containerRef.current || !measureRef.current) {
      setVisibleCount(99)
      return
    }

    const containerWidth = containerRef.current.clientWidth - 28 // subtract chevron (16px) + gap (12px)
    if (containerWidth <= 0) return // not painted yet — wait for ResizeObserver

    const chips = Array.from(measureRef.current.children) as HTMLElement[]
    if (chips.length === 0) {
      setVisibleCount(99)
      return
    }

    const GAP = 6 // gap-1.5 = 6px
    const OVERFLOW_PILL_WIDTH = 40 // approximate width of "+X" pill

    let usedWidth = 0
    let count = 0

    for (let i = 0; i < chips.length; i++) {
      const chipW = chips[i].offsetWidth
      const isLast = i === chips.length - 1
      // If this is not the last chip, we must reserve room for the overflow pill
      // in case the next chip doesn't fit.
      const reserve = isLast ? 0 : OVERFLOW_PILL_WIDTH + GAP

      const needed = (count === 0 ? 0 : GAP) + chipW + reserve

      if (usedWidth + needed <= containerWidth) {
        usedWidth += (count === 0 ? 0 : GAP) + chipW
        count++
      } else {
        break
      }
    }

    setVisibleCount(Math.max(1, count))
  }, [isMobile]) // containerRef and measureRef are stable refs

  // Re-measure after every render (catches selected list changes)
  useLayoutEffect(() => {
    recalc()
  })

  // Re-measure when the container is resized (e.g. dialog animation finishes)
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const ro = new ResizeObserver(recalc)
    ro.observe(el)
    return () => ro.disconnect()
  }, [recalc])

  const actualVisible = Math.min(visibleCount, selected.length)
  const overflow = selected.length - actualVisible

  // Desktop: simple text summary
  const desktopLabel =
    selected.length === 0
      ? placeholder
      : selected.length === 1
        ? selected[0].label
        : `${selected.length} selected`

  return (
    <>
      {/*
        Hidden off-screen measurement layer.
        Always renders ALL selected chips at their natural width so we can
        measure them regardless of how many are actually shown in the trigger.
      */}
      {isMobile && selected.length > 0 && (
        <div
          ref={measureRef}
          aria-hidden="true"
          className="pointer-events-none invisible fixed left-[-9999px] top-0 flex gap-1.5"
          style={{ whiteSpace: "nowrap" }}
        >
          {selected.map((opt) => (
            <ContextChip key={opt.id} opt={opt} />
          ))}
        </div>
      )}

      {/* modal={false} keeps touch scrolling working when inside a dialog. */}
      <Popover open={open} onOpenChange={setOpen} modal={false}>
        <PopoverTrigger asChild>
          <button
            type="button"
            className={cn(
              "mt-1.5 flex h-11 w-full items-center justify-between gap-2 rounded-md border border-border bg-background px-3 text-base transition-colors focus:outline-none focus:ring-2 focus:ring-ring/40 md:h-9 md:text-sm",
              selected.length === 0 && "text-muted-foreground",
            )}
          >
            {isMobile ? (
              /* ── Mobile: chip row ── */
              <span
                ref={containerRef}
                className="flex min-w-0 flex-1 items-center gap-1.5 overflow-hidden"
              >
                {selected.length === 0 ? (
                  <span className="truncate">{placeholder}</span>
                ) : (
                  <>
                    {selected.slice(0, actualVisible).map((opt) => (
                      <ContextChip key={opt.id} opt={opt} />
                    ))}
                    {overflow > 0 && (
                      <span className="inline-flex shrink-0 items-center rounded-full border border-border bg-muted px-2 py-0.5 text-xs font-medium leading-none text-muted-foreground">
                        +{overflow}
                      </span>
                    )}
                  </>
                )}
              </span>
            ) : (
              /* ── Desktop: text summary ── */
              <span className="flex min-w-0 flex-1 items-center gap-1.5">
                {selected.length === 1 &&
                  (() => {
                    const opt = selected[0]
                    if (opt.icon && ICONS[opt.icon]) {
                      const Icon = ICONS[opt.icon]
                      return (
                        <span
                          className="flex h-4 w-4 shrink-0 items-center justify-center rounded text-[10px]"
                          style={opt.color ? { color: opt.color } : undefined}
                        >
                          <Icon className="h-3 w-3" />
                        </span>
                      )
                    }
                    if (opt.color)
                      return (
                        <span
                          className="h-1.5 w-1.5 shrink-0 rounded-full"
                          style={{ backgroundColor: opt.color }}
                        />
                      )
                    return null
                  })()}
                <span className="truncate">{desktopLabel}</span>
              </span>
            )}
            <ChevronDown className="h-4 w-4 shrink-0 opacity-50" />
          </button>
        </PopoverTrigger>

        <PopoverContent
          align="start"
          side="bottom"
          collisionPadding={16}
          className={cn(
            "z-[100] w-[var(--radix-popover-trigger-width)] p-1",
            isMobile && "max-h-[70vh] overflow-y-auto overscroll-contain touch-pan-y",
          )}
          style={isMobile ? { WebkitOverflowScrolling: "touch" } : undefined}
          onTouchMove={isMobile ? (e) => e.stopPropagation() : undefined}
        >
          <div className={cn(!isMobile && "max-h-64 overflow-y-auto")}>
            {options.length === 0 ? (
              <p className="px-3 py-2 text-sm text-muted-foreground">No options</p>
            ) : (
              options.map((opt) => {
                const isSelected = selectedIds.includes(opt.id)
                const Icon = opt.icon ? ICONS[opt.icon] : null
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => toggle(opt.id)}
                    className="flex w-full items-center gap-3 rounded px-4 py-3.5 text-left text-base hover:bg-muted md:px-2 md:py-1.5 md:text-sm"
                  >
                    {Icon ? (
                      <span
                        className="flex h-5 w-5 shrink-0 items-center justify-center rounded"
                        style={
                          opt.color
                            ? {
                                backgroundColor: `color-mix(in oklch, ${opt.color} 15%, transparent)`,
                                color: opt.color,
                                boxShadow: `inset 0 0 0 1px color-mix(in oklch, ${opt.color} 30%, transparent)`,
                              }
                            : undefined
                        }
                      >
                        <Icon className="h-3 w-3" />
                      </span>
                    ) : opt.color ? (
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
    </>
  )
}
