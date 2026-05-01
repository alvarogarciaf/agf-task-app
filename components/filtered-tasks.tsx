"use client"

import { useMemo, useState } from "react"
import { Filter, X, Check } from "lucide-react"
import { cn } from "@/lib/utils"
import { TasksTable } from "@/components/tasks-table"
import type { Context, Person, Project, Task, UrgencyLevel } from "@/lib/types"

interface FilteredTasksProps {
  tasks: Task[]
  projects: Project[]
  persons: Person[]
  contexts: Context[]
  urgencies: UrgencyLevel[]
  onToggleProcessed: (id: string) => void
  onUpdate: (task: Task) => void
  onArchiveTask?: (id: string) => void
  onDeleteTask?: (id: string) => void
  initialContextId?: string
  initialPersonId?: string
  initialProjectId?: string
  hideFilters?: ("status" | "context" | "project" | "person")[]
  storageKey?: string
  emptyTitle?: string
  emptyHint?: string
  itemNoun?: string
  inboxMode?: boolean
}

export function FilteredTasks({
  tasks,
  projects,
  persons,
  contexts,
  urgencies,
  onToggleProcessed,
  onUpdate,
  onArchiveTask,
  onDeleteTask,
  initialContextId,
  initialPersonId,
  initialProjectId,
  hideFilters = [],
  storageKey,
  emptyTitle,
  emptyHint,
  itemNoun,
  inboxMode = false,
}: FilteredTasksProps) {
  const [contextId, setContextId] = useState<string | null>(initialContextId ?? null)
  const [personId, setPersonId] = useState<string | null>(initialPersonId ?? null)
  const [projectId, setProjectId] = useState<string | null>(initialProjectId ?? null)
  const [showProcessed, setShowProcessed] = useState<"all" | "open" | "done">("open")

  const filtered = useMemo(() => {
    return tasks
      .filter((t) => (contextId ? (t.context_ids || []).includes(contextId) : true))
      .filter((t) => (personId ? t.person_id === personId : true))
      .filter((t) => (projectId ? t.project_id === projectId : true))
      .filter((t) => {
        // If the status filter is hidden, don't filter by showProcessed (or default to open depending on mode)
        if (hideFilters.includes("status") && !inboxMode) return true
        if (showProcessed === "all") return true
        if (showProcessed === "open") return !t.processed
        return t.processed
      })
      .filter((t) => !t.archived)
      .sort((a, b) => +new Date(b.date_created) - +new Date(a.date_created))
  }, [tasks, contextId, personId, projectId, showProcessed, hideFilters, inboxMode])

  const hasFilter = contextId || personId || projectId

  const hiddenCols: ("status" | "urgency" | "description" | "details" | "project" | "person" | "contexts" | "show_on" | "action_date" | "date_created")[] = []
  if (inboxMode) {
    // If we have an inboxMode, maybe we hide certain columns or handle the column label differently
  }

  return (
    <div className="flex h-full flex-col px-6 py-6 overflow-hidden">
      {/* Filter bar */}
      <div className="mb-4 flex flex-wrap items-center gap-2 rounded-lg border border-border bg-card p-2 shrink-0">
        <div className="flex items-center gap-1.5 px-2 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
          <Filter className="h-3 w-3" />
          Filter
        </div>

        {!hideFilters.includes("status") && (
          <Segmented
            value={showProcessed}
            onChange={setShowProcessed}
            options={[
              { value: "all", label: "All" },
              { value: "open", label: "Open" },
              { value: "done", label: "Done" },
            ]}
          />
        )}

        {!hideFilters.includes("context") && (
          <FilterPill
            label="Context"
            value={contextId ? contexts.find((c) => c.id === contextId)?.name : undefined}
            options={contexts.map((c) => ({ id: c.id, label: c.name, color: c.color }))}
            onSelect={(id) => setContextId((p) => (p === id ? null : id))}
            onClear={() => setContextId(null)}
          />
        )}
        
        {!hideFilters.includes("project") && (
          <FilterPill
            label="Project"
            value={projectId ? projects.find((p) => p.id === projectId)?.name : undefined}
            options={projects.map((p) => ({ id: p.id, label: p.name }))}
            onSelect={(id) => setProjectId((p) => (p === id ? null : id))}
            onClear={() => setProjectId(null)}
          />
        )}
        
        {!hideFilters.includes("person") && (
          <FilterPill
            label="Person"
            value={personId ? persons.find((p) => p.id === personId)?.name : undefined}
            options={persons.map((p) => ({ id: p.id, label: p.name, color: p.color }))}
            onSelect={(id) => setPersonId((p) => (p === id ? null : id))}
            onClear={() => setPersonId(null)}
          />
        )}

        {hasFilter ? (
          <button
            type="button"
            onClick={() => {
              setContextId(null)
              setPersonId(null)
              setProjectId(null)
            }}
            className="ml-auto inline-flex items-center gap-1 rounded px-2 py-1 text-xs text-muted-foreground hover:text-foreground"
          >
            <X className="h-3 w-3" />
            Clear all
          </button>
        ) : (
          <span className="ml-auto px-2 font-mono text-[10px] text-muted-foreground">
            {filtered.length} of {tasks.length}
          </span>
        )}
      </div>

      {/* Table Container - flex-1 for scrolling */}
      <div className="flex-1 overflow-auto">
        <TasksTable
          tasks={filtered}
          projects={projects}
          persons={persons}
          contexts={contexts}
          urgencies={urgencies}
          onToggleProcessed={onToggleProcessed}
          onUpdate={onUpdate}
          onArchiveTask={onArchiveTask}
          onDeleteTask={onDeleteTask}
          hideColumns={hiddenCols}
          storageKey={storageKey}
          emptyTitle={emptyTitle}
          emptyHint={emptyHint}
          itemNoun={itemNoun}
          inboxMode={inboxMode}
        />
      </div>
    </div>
  )
}

function Segmented<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T
  onChange: (v: T) => void
  options: { value: T; label: string }[]
}) {
  return (
    <div className="flex items-center gap-0.5 rounded-md border border-border bg-background p-0.5">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className={cn(
            "rounded px-2.5 py-1 text-xs transition-colors",
            value === o.value
              ? "bg-primary/15 text-primary"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

function FilterPill({
  label,
  value,
  options,
  onSelect,
  onClear,
}: {
  label: string
  value?: string
  options: { id: string; label: string; color?: string }[]
  onSelect: (id: string) => void
  onClear: () => void
}) {
  const [open, setOpen] = useState(false)
  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={cn(
          "inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs transition-colors",
          value
            ? "border-primary/40 bg-primary/10 text-primary"
            : "border-border bg-background text-muted-foreground hover:text-foreground",
        )}
      >
        <span className="font-mono text-[10px] uppercase tracking-wider">{label}</span>
        {value ? (
          <>
            <span className="h-3 w-px bg-primary/30" />
            <span className="text-foreground">{value}</span>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                onClear()
              }}
              className="ml-0.5 rounded p-0.5 hover:bg-primary/20"
              aria-label="Clear"
            >
              <X className="h-2.5 w-2.5" />
            </button>
          </>
        ) : null}
      </button>
      {open ? (
        <div className="absolute left-0 top-full z-20 mt-1 max-h-64 w-56 overflow-auto rounded-md border border-border bg-popover p-1 shadow-lg">
          {options.map((opt) => (
            <button
              key={opt.id}
              type="button"
              onClick={() => {
                onSelect(opt.id)
                setOpen(false)
              }}
              className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm hover:bg-muted"
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
              {value === opt.label ? <Check className="h-3 w-3 text-primary" /> : null}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  )
}
