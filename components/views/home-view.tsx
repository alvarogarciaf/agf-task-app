"use client"

import { useEffect, useRef, useState, forwardRef } from "react"
import { ArrowRight, Sparkles, Tag, FolderKanban, User, Inbox as InboxIcon, Zap } from "lucide-react"
import { cn } from "@/lib/utils"
import { FilteredTasks } from "@/components/filtered-tasks"
import type { Context, Person, Project, Task, UrgencyLevel } from "@/lib/types"
import { isTaskVisibleByShowOnRule } from "@/lib/show-on-filter"

interface HomeViewProps {
  projects: Project[]
  persons: Person[]
  contexts: Context[]
  urgencies: UrgencyLevel[]
  tasks: Task[]
  onCreate: (input: {
    description: string
    contextIds: string[]
    projectId: string | null
    personId: string | null
    urgencyId?: string
  }) => void
  onUpdate: (task: Task) => void
  onToggleProcessed: (id: string) => void
  onToggleStatus: (id: string) => void
  onArchiveTask?: (id: string) => void
  onDeleteTask?: (id: string) => void
}

export function HomeView({
  projects,
  persons,
  contexts,
  urgencies,
  tasks,
  onCreate,
  onUpdate,
  onToggleProcessed,
  onToggleStatus,
  onArchiveTask,
  onDeleteTask,
}: HomeViewProps) {
  const [text, setText] = useState("")
  const [contextIds, setContextIds] = useState<string[]>([])
  const [projectId, setProjectId] = useState<string | null>(null)
  const [personId, setPersonId] = useState<string | null>(null)
  const [urgencyId, setUrgencyId] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const chipRefs = useRef<(HTMLButtonElement | null)[]>([])

  const inbox = tasks.filter((t) => !t.processed)
  const inboxHasShowOnVisible = inbox.some(isTaskVisibleByShowOnRule)

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  function toggleContext(id: string) {
    setContextIds((prev) => (prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]))
  }

  function submit(e?: React.FormEvent | React.KeyboardEvent) {
    if (e) e.preventDefault()
    if (!text.trim()) return
    onCreate({ 
      description: text.trim(), 
      contextIds, 
      projectId, 
      personId, 
      urgencyId: urgencyId || undefined 
    })
    setText("")
    setContextIds([])
    setProjectId(null)
    setPersonId(null)
    setUrgencyId(null)
    // Small delay to ensure focus works after state updates
    setTimeout(() => inputRef.current?.focus(), 0)
  }

  return (
    <div className="space-y-6">
      {/* Capture form */}
      <form 
        onSubmit={submit} 
        onKeyDown={(e) => {
          if (e.ctrlKey && e.key === "Enter") {
            submit(e)
          }
        }}
        className="rounded-lg border border-border bg-card shadow-sm"
      >
        <div className="flex items-center gap-2 border-b border-border bg-background/40 px-4 py-2.5">
          <Sparkles className="h-3.5 w-3.5 text-primary" />
          <span className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
            Quick capture
          </span>
          <span className="ml-auto font-mono text-[10px] text-muted-foreground hidden sm:block">
            ↵ to save
          </span>
        </div>

        <div className="px-4 pt-5 pb-4">
          <input
            ref={inputRef}
            type="text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => { 
              if (e.key === "Enter" && !e.ctrlKey) {
                 submit(e)
              }
              if (e.key === "ArrowDown") {
                e.preventDefault()
                chipRefs.current[0]?.focus()
              }
            }}
            placeholder="What needs to happen?"
            className="w-full bg-transparent text-2xl font-medium placeholder:text-muted-foreground/60 focus:outline-none md:text-3xl"
            aria-label="New task description"
          />

          {/* Attribute pickers — inline below input */}
          <div className="mt-4 flex flex-wrap gap-2">
            <AttributePicker
              ref={(el) => { chipRefs.current[0] = el }}
              icon={<Tag className="h-3.5 w-3.5" />}
              label="Context"
              placeholder="Context"
              multi
              options={contexts.map((c) => ({ id: c.id, label: c.name, color: c.color }))}
              selectedIds={contextIds}
              onToggle={toggleContext}
              onSubmit={submit}
              onNavigate={(dir) => {
                if (dir === "left" || dir === "up") inputRef.current?.focus()
                else chipRefs.current[1]?.focus()
              }}
            />
            <AttributePicker
              ref={(el) => { chipRefs.current[1] = el }}
              icon={<FolderKanban className="h-3.5 w-3.5" />}
              label="Project"
              placeholder="Project"
              options={projects.map((p) => ({ id: p.id, label: p.name }))}
              selectedIds={projectId ? [projectId] : []}
              onToggle={(id) => setProjectId((prev) => (prev === id ? null : id))}
              onSubmit={submit}
              onNavigate={(dir) => {
                if (dir === "up") inputRef.current?.focus()
                else if (dir === "left") chipRefs.current[0]?.focus()
                else chipRefs.current[2]?.focus()
              }}
            />
            <AttributePicker
              ref={(el) => { chipRefs.current[2] = el }}
              icon={<User className="h-3.5 w-3.5" />}
              label="Person"
              placeholder="Person"
              options={persons.map((p) => ({ id: p.id, label: p.name, color: p.color }))}
              selectedIds={personId ? [personId] : []}
              onToggle={(id) => setPersonId((prev) => (prev === id ? null : id))}
              onSubmit={submit}
              onNavigate={(dir) => {
                if (dir === "up") inputRef.current?.focus()
                else if (dir === "left") chipRefs.current[1]?.focus()
                else chipRefs.current[3]?.focus()
              }}
            />
            <AttributePicker
              ref={(el) => { chipRefs.current[3] = el }}
              icon={<Zap className="h-3.5 w-3.5" />}
              label="Urgency"
              placeholder="Urgency"
              options={urgencies.map((u) => ({ id: u.id, label: u.name, color: u.color }))}
              selectedIds={urgencyId ? [urgencyId] : []}
              onToggle={(id) => setUrgencyId((prev) => (prev === id ? null : id))}
              onSubmit={submit}
              onNavigate={(dir) => {
                if (dir === "up") inputRef.current?.focus()
                else if (dir === "left") chipRefs.current[2]?.focus()
              }}
            />
          </div>
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-border bg-background/40 px-4 py-3">
          <span className="font-mono text-[10px] text-muted-foreground">
            <span className="mr-2 inline-block h-1.5 w-1.5 rounded-full bg-primary align-middle" />
            Goes to <span className="text-foreground">Inbox</span>
          </span>
          <button
            type="submit"
            disabled={!text.trim()}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-md bg-primary px-4 py-2.5 text-base font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-40 md:px-3.5 md:py-1.5 md:text-sm",
            )}
          >
            Capture
            <ArrowRight className="h-4 w-4 md:h-3.5 md:w-3.5" />
          </button>
        </div>
      </form>

      {/* Inbox list */}
      <section>
        <div className="mb-3 flex items-center gap-2">
          <div className="flex h-6 w-6 items-center justify-center rounded-md bg-primary/15 text-primary">
            <InboxIcon className="h-3.5 w-3.5" />
          </div>
          <h2 className="text-sm font-semibold">Inbox</h2>
          {inbox.length > 0 && (
            <span className="rounded bg-primary/15 px-1.5 py-0.5 font-mono text-[10px] text-primary">
              {inbox.length}
            </span>
          )}
        </div>

        {inbox.length === 0 ? (
          <div className="flex flex-col items-center rounded-lg border border-dashed border-border bg-card px-8 py-12 text-center">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
              <Sparkles className="h-5 w-5" />
            </div>
            <h3 className="mt-4 text-base font-semibold">Inbox zero</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Nothing to triage. Everything has been processed.
            </p>
          </div>
        ) : (
          <div>
            <FilteredTasks
              tasks={inbox}
              projects={projects}
              persons={persons}
              contexts={contexts}
              urgencies={urgencies}
              onToggleProcessed={onToggleProcessed}
              onToggleStatus={onToggleStatus}
              onUpdate={onUpdate}
              onArchiveTask={onArchiveTask}
              onDeleteTask={onDeleteTask}
              itemNoun="item"
              emptyTitle={
                inboxHasShowOnVisible
                  ? "Inbox zero"
                  : "Inbox is clear for today"
              }
              emptyHint={
                inboxHasShowOnVisible
                  ? "Nothing to triage right now."
                  : "Every inbox item has a Show on date after today. Use “Hidden by date” to review or change those dates."
              }
              hideFilters={["status"]}
              inboxMode={true}
              onCreate={onCreate}
              hideFilterBar={true}
            />
          </div>
        )}
      </section>
    </div>
  )
}

interface AttributePickerProps {
  icon: React.ReactNode
  label: string
  placeholder: string
  options: { id: string; label: string; color?: string }[]
  selectedIds: string[]
  onToggle: (id: string) => void
  onSubmit?: (e: React.FormEvent) => void
  onNavigate?: (dir: "left" | "right" | "up" | "down") => void
  multi?: boolean
  ref?: React.Ref<HTMLButtonElement>
}


const AttributePicker = forwardRef<HTMLButtonElement, AttributePickerProps>(({
  icon,
  placeholder,
  options,
  selectedIds,
  onToggle,
  onSubmit,
  onNavigate,
  multi,
}, ref) => {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState("")
  const [highlightedIdx, setHighlightedIdx] = useState(0)
  const containerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const filtered = options.filter((o) =>
    (o.label || "").toLowerCase().includes(query.toLowerCase())
  )

  useEffect(() => {
    if (open) {
      inputRef.current?.focus()
      setHighlightedIdx(0)
    } else {
      setQuery("")
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false)
    }
    document.addEventListener("mousedown", handleClickOutside)
    document.addEventListener("keydown", handleKeyDown)
    return () => {
      document.removeEventListener("mousedown", handleClickOutside)
      document.removeEventListener("keydown", handleKeyDown)
    }
  }, [open])

  const selected = options.filter((o) => selectedIds.includes(o.id))

  return (
    <div className="relative" ref={containerRef}>
      <button
        ref={ref}
        type="button"
        onClick={() => setOpen((o) => !o)}
        onKeyDown={(e) => {
          if (!open) {
            if (e.key === "ArrowRight") { e.preventDefault(); onNavigate?.("right") }
            if (e.key === "ArrowLeft") { e.preventDefault(); onNavigate?.("left") }
            if (e.key === "ArrowUp") { e.preventDefault(); onNavigate?.("up") }
            if (e.key === "ArrowDown") { e.preventDefault(); setOpen(true) }
            if (e.key === "Enter" && !e.ctrlKey) { e.preventDefault(); setOpen(true) }
          }
        }}
        className={cn(
          "inline-flex items-center gap-1.5 rounded-full border px-3.5 py-2 text-sm transition-colors md:px-3 md:py-1.5 md:text-xs",
          selected.length > 0
            ? "border-primary/40 bg-primary/10 text-primary"
            : "border-border bg-background text-muted-foreground hover:border-border/80 hover:bg-muted hover:text-foreground"
        )}
      >
        <span className="shrink-0">{icon}</span>
        {selected.length === 0 ? (
          <span>{placeholder}</span>
        ) : (
          <span className="flex items-center gap-1">
            {selected.map((s, i) => (
              <span key={s.id} className="flex items-center gap-1">
                {i > 0 && <span className="opacity-40">·</span>}
                {s.color ? (
                  <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: s.color }} />
                ) : null}
                {s.label}
              </span>
            ))}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute left-0 top-full z-50 mt-1 min-w-[200px] overflow-hidden rounded-md border border-border bg-popover shadow-lg animate-in fade-in zoom-in-95 duration-100">
          <div className="border-b border-border p-1.5">
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search..."
              className="w-full bg-muted/50 rounded border-none px-2 py-1 text-xs focus:ring-1 focus:ring-primary outline-none"
              onKeyDown={(e) => {
                if (e.key === "Escape") {
                  e.preventDefault()
                  setOpen(false)
                } else if (e.key === "ArrowDown") {
                  e.preventDefault()
                  setHighlightedIdx((i) => Math.min(i + 1, filtered.length - 1))
                } else if (e.key === "ArrowUp") {
                  e.preventDefault()
                  setHighlightedIdx((i) => Math.max(i - 1, 0))
                } else if (e.key === "ArrowRight") {
                  e.preventDefault()
                  setOpen(false)
                  onNavigate?.("right")
                } else if (e.key === "ArrowLeft") {
                  e.preventDefault()
                  setOpen(false)
                  onNavigate?.("left")
                } else if (e.key === "Enter") {
                  if (filtered[highlightedIdx]) {
                    e.preventDefault()
                    onToggle(filtered[highlightedIdx].id)
                    if (!multi) setOpen(false)
                  }
                }
              }}
            />
          </div>
          <div className="max-h-60 overflow-y-auto p-1">
            {filtered.length === 0 ? (
              <p className="px-2 py-1.5 text-xs text-muted-foreground italic text-center">No results</p>
            ) : (
              filtered.map((opt, idx) => {
                const isSel = selectedIds.includes(opt.id)
                const isHighlighted = idx === highlightedIdx
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => {
                      onToggle(opt.id)
                      if (!multi) setOpen(false)
                    }}
                    onMouseEnter={() => setHighlightedIdx(idx)}
                    className={cn(
                      "flex w-full items-center gap-2 rounded px-3 py-2.5 text-left text-base transition-colors md:px-2 md:py-1.5 md:text-sm",
                      isSel && "text-primary font-medium",
                      isHighlighted ? "bg-muted" : "hover:bg-muted/50"
                    )}
                  >
                    {opt.color ? (
                      <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: opt.color }} />
                    ) : (
                      <span className="h-2 w-2 shrink-0 rounded-full bg-muted-foreground/20" />
                    )}
                    <span className="flex-1 truncate">{opt.label}</span>
                    {isSel && <span className="font-mono text-[10px]">✓</span>}
                  </button>
                )
              })
            )}
          </div>
        </div>
      )}
    </div>
  )
})

AttributePicker.displayName = "AttributePicker"
