"use client"

import { useMemo, useState, useEffect } from "react"
import { Filter, X, Check } from "lucide-react"
import { cn } from "@/lib/utils"
import { TasksTable } from "@/components/tasks-table"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import type { Context, Person, Project, Task, UrgencyLevel } from "@/lib/types"

interface FilteredTasksProps {
  tasks: Task[]
  projects: Project[]
  persons: Person[]
  contexts: Context[]
  urgencies: UrgencyLevel[]
  onToggleProcessed: (id: string) => void
  onToggleStatus: (id: string) => void
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
  onCreate?: (input: {
    description: string
    contextIds: string[]
    projectId: string | null
    personId: string | null
    processed: boolean
  }) => void
  hideFilterBar?: boolean
}

export function FilteredTasks({
  tasks,
  projects,
  persons,
  contexts,
  urgencies,
  onToggleProcessed,
  onToggleStatus,
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
  onCreate,
  hideFilterBar = false,
}: FilteredTasksProps) {
  const [contextId, setContextId] = useState<string | null>(initialContextId ?? null)
  const [personId, setPersonId] = useState<string | null>(initialPersonId ?? null)
  const [projectId, setProjectId] = useState<string | null>(initialProjectId ?? null)
  const [showStatus, setShowStatus] = useState<"all" | "open" | "done">("open")
  const [isCreating, setIsCreating] = useState(false)
  const [autoFocusTaskId, setAutoFocusTaskId] = useState<string | null>(null)
  const [prevTasksLength, setPrevTasksLength] = useState(tasks.length)
  
  // Sync state with initial props when they change (drill-down navigation)
  useEffect(() => {
    setContextId(initialContextId ?? null)
    setPersonId(initialPersonId ?? null)
    setProjectId(initialProjectId ?? null)
  }, [initialContextId, initialPersonId, initialProjectId])

  const filtered = useMemo(() => {
    return tasks
      .filter((t) => {
        if (!contextId) return true
        return (t.context_ids || []).includes(contextId)
      })
      .filter((t) => {
        if (!personId) return true
        return t.person_id === personId
      })
      .filter((t) => {
        if (!projectId) return true
        return t.project_id === projectId
      })
      .filter((t) => {
        // 1. Visibility Rule: Inbox vs Everywhere Else
        if (inboxMode) {
          // Inbox only shows UNPROCESSED and OPEN tasks
          if (t.processed || t.status !== "Open") return false
        } else {
          // Everywhere else only shows PROCESSED tasks
          if (!t.processed) return false
          
          // 2. Status Filter: Open vs Done (only applies to non-inbox views)
          if (showStatus === "all") return true
          if (showStatus === "open") return t.status === "Open"
          return t.status === "Done"
        }

        return true
      })
      .filter((t) => !t.archived)
      .sort((a, b) => +new Date(b.date_created) - +new Date(a.date_created))
  }, [tasks, contextId, personId, projectId, showStatus, inboxMode])

  useEffect(() => {
    if (isCreating && tasks.length > prevTasksLength) {
      // The newest task should be at index 0 of filtered because of the date_created sort
      const newTask = filtered[0]
      if (newTask) {
        setAutoFocusTaskId(newTask.id)
      }
      setIsCreating(false)
    }
    setPrevTasksLength(tasks.length)
  }, [tasks, isCreating, prevTasksLength, filtered])

  const handleAddNewTask = () => {
    if (!onCreate) return
    onCreate({
      description: "New task",
      contextIds: contextId ? [contextId] : [],
      projectId: projectId,
      personId: personId,
      processed: !inboxMode,
    })
    setIsCreating(true)
  }

  // Keyboard shortcut: Ctrl+N for new task
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "n") {
        // Only trigger if we're not already in an input/textarea
        if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
        
        e.preventDefault()
        handleAddNewTask()
      }
    }
    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [handleAddNewTask])

  const hasFilter = contextId || personId || projectId

  const hiddenCols: ("status" | "urgency" | "description" | "details" | "project" | "person" | "contexts" | "show_on" | "action_date" | "date_created")[] = []
  if (inboxMode) {
    // If we have an inboxMode, maybe we hide certain columns or handle the column label differently
  }

  return (
    <div className="flex flex-col min-w-0 w-full rounded-lg border border-border bg-card overflow-hidden">
      {/* Filter bar - Card Header */}
      {!hideFilterBar && (
        <div className="flex flex-wrap items-center gap-2 border-b border-border bg-muted/20 p-3 shrink-0 md:p-2">
        <div className="flex items-center gap-1.5 px-2 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
          <Filter className="h-3 w-3" />
          Filter
        </div>

        {!hideFilters.includes("status") && (
          <Segmented
            value={showStatus}
            onChange={setShowStatus}
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
            className="ml-auto inline-flex items-center gap-1 rounded px-3 py-2 text-sm text-muted-foreground hover:text-foreground md:px-2 md:py-1 md:text-xs"
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
    )}

      <div className="min-h-0 min-w-0 w-full">
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
          onCreate={onCreate ? handleAddNewTask : undefined}
          onToggleProcessed={onToggleProcessed}
          onToggleStatus={onToggleStatus}
          autoFocusTaskId={autoFocusTaskId}
          onAutoFocusComplete={() => setAutoFocusTaskId(null)}
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
            "rounded px-3 py-2 text-sm transition-colors md:px-2.5 md:py-1 md:text-xs",
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
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <div
          role="button"
          tabIndex={0}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-md border px-3 py-2 text-sm transition-colors md:px-2.5 md:py-1 md:text-xs cursor-pointer select-none outline-none focus-visible:ring-2 focus-visible:ring-ring",
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
                className="ml-0.5 rounded p-0.5 hover:bg-primary/20 transition-colors"
                aria-label="Clear"
              >
                <X className="h-2.5 w-2.5" />
              </button>
            </>
          ) : null}
        </div>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-56 p-1">
        <div className="max-h-64 overflow-auto">
          {options.map((opt) => (
            <button
              key={opt.id}
              type="button"
              onClick={() => {
                onSelect(opt.id)
                setOpen(false)
              }}
              className="flex w-full items-center gap-2 rounded px-3 py-2.5 text-left text-base hover:bg-muted md:px-2 md:py-1.5 md:text-sm"
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
      </PopoverContent>
    </Popover>
  )
}
