"use client"

import { useEffect, useRef, useState, useCallback } from "react"
import { createPortal } from "react-dom"
import { Check, X } from "lucide-react"
import { cn } from "@/lib/utils"

interface EditorProps {
  onCommit: (value: string | string[] | null, close?: boolean) => void
  onCancel: () => void
  onTab: (reverse: boolean) => void
  onCtrlEnter?: () => void
}

/** Single-line text editor — overlays the cell, doesn't affect column width */
export function InlineTextEditor({
  value,
  onCommit,
  onCancel,
  onTab,
  onCtrlEnter,
}: EditorProps & { value: string }) {
  const [text, setText] = useState(value)
  const ref = useRef<HTMLInputElement>(null)

  useEffect(() => {
    ref.current?.focus()
    ref.current?.select()
  }, [])

  function commit() { onCommit(text.trim() || value) }

  return (
    <div className="absolute inset-0 flex items-center px-2 z-40">
      <input
        ref={ref}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault()
            if (e.ctrlKey) onCtrlEnter?.()
            else commit()
          }
          if (e.key === "Escape") { e.preventDefault(); onCancel() }
          if (e.key === "Tab") { e.preventDefault(); commit(); onTab(e.shiftKey) }
        }}
        className="w-full rounded border border-primary bg-card px-2 py-0.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
      />
    </div>
  )
}

interface Option { id: string; label: string; color?: string }

/** Dropdown list rendered via a portal (fixed position) to escape overflow clipping */
function DropdownPortal({
  anchorRef,
  children,
}: {
  anchorRef: React.RefObject<HTMLElement | null>
  children: React.ReactNode
}) {
  const [coords, setCoords] = useState({ top: 0, left: 0, width: 0 })

  useEffect(() => {
    function update() {
      if (anchorRef.current) {
        const r = anchorRef.current.getBoundingClientRect()
        setCoords({ top: r.bottom + window.scrollY, left: r.left + window.scrollX, width: Math.max(r.width, 180) })
      }
    }
    update()
    window.addEventListener("scroll", update, true)
    window.addEventListener("resize", update)
    return () => {
      window.removeEventListener("scroll", update, true)
      window.removeEventListener("resize", update)
    }
  }, [anchorRef])

  if (typeof document === "undefined") return null
  return createPortal(
    <div
      data-portal-id="inline-editor-portal"
      style={{ position: "absolute", top: coords.top, left: coords.left, width: coords.width, zIndex: 9999 }}
      className="max-h-52 overflow-y-auto rounded-b border border-t-0 border-primary bg-popover shadow-lg"
    >
      {children}
    </div>,
    document.body
  )
}

/** Searchable single-select */
export function InlineSelectEditor({
  options,
  currentId,
  allowClear,
  onCommit,
  onCancel,
  onTab,
  onCtrlEnter,
}: EditorProps & { options: Option[]; currentId: string | null; allowClear?: boolean }) {
  const [query, setQuery] = useState("")
  const [highlightedIdx, setHighlightedIdx] = useState(0)
  const wrapperRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => { inputRef.current?.focus() }, [])

  // Close on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      const target = e.target as Node
      // Don't cancel if clicking inside the editor wrapper OR the portal
      const isInsideWrapper = wrapperRef.current?.contains(target)
      const isInsidePortal = document.querySelector('[data-portal-id="inline-editor-portal"]')?.contains(target)
      
      if (!isInsideWrapper && !isInsidePortal) {
        onCancel()
      }
    }
    document.addEventListener("mousedown", handler)
    return () => document.removeEventListener("mousedown", handler)
  }, [onCancel])

  const filtered = options.filter((o) => o.label.toLowerCase().includes(query.toLowerCase()))

  // Reset highlight when filter changes
  useEffect(() => { setHighlightedIdx(0) }, [query])

  return (
    <div ref={wrapperRef} className="absolute inset-0 z-40 flex items-center px-2">
      <div className="w-full">
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search…"
          onKeyDown={(e) => {
            if (e.key === "Escape") { e.preventDefault(); onCancel() }
            if (e.key === "Tab") { e.preventDefault(); onCommit(null, true); onTab(e.shiftKey) }
            if (e.key === "ArrowDown") { e.preventDefault(); setHighlightedIdx((i) => Math.min(i + 1, filtered.length - 1)) }
            if (e.key === "ArrowUp") { e.preventDefault(); setHighlightedIdx((i) => Math.max(i - 1, 0)) }
            if (e.key === "Enter") {
              e.preventDefault()
              if (e.ctrlKey) {
                onCtrlEnter?.()
              } else if (filtered[highlightedIdx]) {
                onCommit(filtered[highlightedIdx].id, true)
              }
            }
          }}
          className="w-full rounded-t border border-primary bg-card px-2 py-1 text-xs focus:outline-none"
        />
        <DropdownPortal anchorRef={inputRef}>
          {allowClear && (
            <button
              type="button"
              onMouseDown={(e) => { e.preventDefault(); onCommit(null) }}
              className="flex w-full items-center gap-2 px-2 py-1.5 text-xs text-muted-foreground hover:bg-muted"
            >
              <X className="h-3 w-3" /> Clear
            </button>
          )}
          {filtered.length === 0 ? (
            <p className="px-2 py-1.5 text-xs text-muted-foreground">No results</p>
          ) : filtered.map((o, idx) => (
            <button
              key={o.id}
              type="button"
              onMouseDown={(e) => { e.preventDefault(); onCommit(o.id) }}
              onMouseEnter={() => setHighlightedIdx(idx)}
              className={cn(
                "flex w-full items-center gap-2 px-2 py-1.5 text-xs hover:bg-muted",
                o.id === currentId && "text-primary",
                idx === highlightedIdx && "bg-muted ring-1 ring-inset ring-primary/40",
              )}
            >
              {o.color && <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: o.color }} />}
              {o.label}
              {o.id === currentId && <Check className="ml-auto h-3 w-3 text-primary" />}
            </button>
          ))}
        </DropdownPortal>
      </div>
    </div>
  )
}

/** Searchable multi-select */
export function InlineMultiSelectEditor({
  options,
  currentIds,
  onCommit,
  onCancel,
  onTab,
  onCtrlEnter,
}: EditorProps & { options: Option[]; currentIds: string[] }) {
  const [query, setQuery] = useState("")
  const [selected, setSelected] = useState<string[]>(currentIds)
  const [highlightedIdx, setHighlightedIdx] = useState(0)
  const wrapperRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => { inputRef.current?.focus() }, [])

  useEffect(() => {
    function handler(e: MouseEvent) {
      const target = e.target as Node
      const isInsideWrapper = wrapperRef.current?.contains(target)
      const isInsidePortal = document.querySelector('[data-portal-id="inline-editor-portal"]')?.contains(target)
      
      if (!isInsideWrapper && !isInsidePortal) {
        onCommit(selected)
      }
    }
    document.addEventListener("mousedown", handler)
    return () => document.removeEventListener("mousedown", handler)
  }, [onCommit, selected])

  const filtered = options.filter((o) => o.label.toLowerCase().includes(query.toLowerCase()))
  useEffect(() => { setHighlightedIdx(0) }, [query])

  function toggle(id: string) {
    const next = selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id]
    setSelected(next)
    onCommit(next, false) // Save immediately but keep editor open
  }

  return (
    <div ref={wrapperRef} className="absolute inset-0 z-40 flex items-center px-2">
      <div className="w-full">
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search…"
          onKeyDown={(e) => {
            if (e.key === "Escape") { e.preventDefault(); onCancel() }
            if (e.key === "Tab") { e.preventDefault(); onCommit(selected, true); onTab(e.shiftKey) }
            if (e.key === "ArrowDown") { e.preventDefault(); setHighlightedIdx((i) => Math.min(i + 1, filtered.length - 1)) }
            if (e.key === "ArrowUp") { e.preventDefault(); setHighlightedIdx((i) => Math.max(i - 1, 0)) }
            if (e.key === "Enter") {
              e.preventDefault()
              if (e.ctrlKey) {
                onCtrlEnter?.()
              } else if (filtered[highlightedIdx]) {
                toggle(filtered[highlightedIdx].id)
                setQuery("") // Clear query after toggle
              }
            }
          }}
          className="w-full rounded-t border border-primary bg-card px-2 py-1 text-xs focus:outline-none"
        />
        <DropdownPortal anchorRef={inputRef}>
          {filtered.length === 0 ? (
            <p className="px-2 py-1.5 text-xs text-muted-foreground">No results</p>
          ) : filtered.map((o, idx) => {
            const isSel = selected.includes(o.id)
            return (
              <button
                key={o.id}
                type="button"
                onMouseDown={(e) => { e.preventDefault(); toggle(o.id) }}
                onMouseEnter={() => setHighlightedIdx(idx)}
                className={cn(
                  "flex w-full items-center gap-2 px-2 py-1.5 text-xs hover:bg-muted",
                  isSel && "text-primary",
                  idx === highlightedIdx && "bg-muted ring-1 ring-inset ring-primary/40",
                )}
              >
                {o.color && <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: o.color }} />}
                {o.label}
                {isSel && <Check className="ml-auto h-3 w-3 text-primary" />}
              </button>
            )
          })}
          <div className="border-t border-border px-2 py-1.5">
            <button
              type="button"
              onMouseDown={(e) => { e.preventDefault(); onCommit(selected) }}
              className="text-xs text-primary hover:underline"
            >
              Done ({selected.length} selected)
            </button>
          </div>
        </DropdownPortal>
      </div>
    </div>
  )
}

/** Date picker editor */
export function InlineDateEditor({
  value,
  onCommit,
  onCancel,
  onTab,
  onCtrlEnter,
}: EditorProps & { value: string | null }) {
  const [date, setDate] = useState(value || "")
  const ref = useRef<HTMLInputElement>(null)

  useEffect(() => {
    ref.current?.focus()
    // Native date pickers are often better triggered explicitly or by clicking
    // but some browsers support showPicker()
    if (ref.current && 'showPicker' in HTMLInputElement.prototype) {
      try {
        ref.current.showPicker();
      } catch (e) {
        // Fallback or ignore
      }
    }
  }, [])

  function commit() { onCommit(date || null) }

  return (
    <div className="absolute inset-0 flex items-center px-2 z-40">
      <input
        ref={ref}
        type="date"
        value={date}
        onChange={(e) => setDate(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault()
            commit()
          }
          if (e.key === "Escape") { e.preventDefault(); onCancel() }
          if (e.key === "Tab") { e.preventDefault(); commit(); onTab(e.shiftKey) }
        }}
        className="w-full rounded border border-primary bg-card px-2 py-0.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary h-[28px]"
      />
    </div>
  )
}
