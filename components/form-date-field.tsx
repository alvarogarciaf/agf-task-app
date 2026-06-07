"use client"

import { useRef } from "react"
import { Calendar, X } from "lucide-react"
import {
  isoToDateInputValue,
  dateInputToIso,
  formatDateLabel,
} from "@/lib/date-field"

interface FormDateFieldProps {
  value?: string | null
  onChange: (iso: string | null) => void
  placeholder?: string
}

export function FormDateField({
  value,
  onChange,
  placeholder = "No date",
}: FormDateFieldProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const inputValue = isoToDateInputValue(value)

  function openPicker() {
    const el = inputRef.current
    if (!el) return
    el.focus()
    if ("showPicker" in HTMLInputElement.prototype) {
      try {
        el.showPicker()
      } catch {}
    }
  }

  return (
    <div className="relative mt-1.5">
      {/* Visible styled trigger — same height conventions as other form fields */}
      <button
        type="button"
        onClick={openPicker}
        className="flex h-11 w-full items-center gap-2 rounded-md border border-border bg-background px-3 text-base transition-colors focus:outline-none focus:ring-2 focus:ring-ring/40 md:h-9 md:text-sm"
      >
        <Calendar className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        <span
          className={
            value
              ? "flex-1 truncate text-left"
              : "flex-1 truncate text-left text-muted-foreground"
          }
        >
          {value ? formatDateLabel(value) : placeholder}
        </span>
      </button>

      {/* Clear button — only visible when a date is set */}
      {value ? (
        <button
          type="button"
          aria-label="Clear date"
          onClick={() => onChange(null)}
          className="absolute right-2 top-1/2 z-10 -translate-y-1/2 rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      ) : null}

      {/*
        Invisible native date input. pointer-events-none so all clicks reach
        the button above, which calls showPicker() from within the user-gesture
        handler — this works reliably on both desktop and mobile browsers.
      */}
      <input
        ref={inputRef}
        type="date"
        value={inputValue}
        onChange={(e) => onChange(dateInputToIso(e.target.value))}
        className="pointer-events-none absolute inset-0 h-full w-full opacity-0"
        tabIndex={-1}
        aria-hidden="true"
      />
    </div>
  )
}
