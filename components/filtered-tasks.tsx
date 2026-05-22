"use client"

import { useMemo, useState, useEffect } from "react"
import { CalendarClock, Filter, X, Check, ChevronDown, LayoutList, Columns3, Plus, RotateCcw, Star } from "lucide-react"
import { cn } from "@/lib/utils"
import { toast } from "sonner"
import { TasksTable, TASK_COLUMNS, COLUMN_MAP } from "@/components/tasks-table"
import type { TaskColumnKey } from "@/components/tasks-table"
import { useTableColumns } from "@/hooks/use-table-columns"
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import type { Context, Person, Project, Task, UrgencyLevel, SavedView } from "@/lib/types"
import { useDatabase } from "./db-provider"
import { SaveViewDialog } from "./save-view-dialog"
import { v4 as uuidv4 } from "uuid"
import {
  isTaskHiddenOnlyByShowOn,
  isTaskVisibleByShowOnRule,
} from "@/lib/show-on-filter"

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
  initialContextId?: string | null
  initialContextIds?: string[]
  initialPersonId?: string | null
  initialProjectId?: string | null
  initialShowStatus?: "all" | "open" | "done"
  initialIsGroupedByProject?: boolean
  initialShowHiddenByShowOn?: boolean
  initialSortKey?: string
  initialSortDirection?: "asc" | "desc"
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
  }) => Promise<string | void>
  hideFilterBar?: boolean
  fullWidthOnMobile?: boolean
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
  initialContextIds,
  initialPersonId,
  initialProjectId,
  initialShowStatus,
  initialIsGroupedByProject,
  initialShowHiddenByShowOn,
  initialSortKey,
  initialSortDirection,
  hideFilters = [],
  storageKey,
  emptyTitle,
  emptyHint,
  itemNoun = "task",
  inboxMode = false,
  onCreate,
  hideFilterBar = false,
  fullWidthOnMobile = false,
}: FilteredTasksProps) {
  const [contextIds, setContextIds] = useState<string[]>(() => {
    if (initialContextIds) return initialContextIds
    if (initialContextId) return [initialContextId]
    return []
  })
  const [personId, setPersonId] = useState<string | null>(initialPersonId ?? null)
  const [projectId, setProjectId] = useState<string | null>(initialProjectId ?? null)
  const [showStatus, setShowStatus] = useState<"all" | "open" | "done">(initialShowStatus ?? "open")
  const [isCreating, setIsCreating] = useState(false)
  const [autoFocusTaskId, setAutoFocusTaskId] = useState<string | null>(null)
  const [prevTasksLength, setPrevTasksLength] = useState(tasks.length)
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: "asc" | "desc" }>({
    key: initialSortKey ?? "urgency",
    direction: initialSortDirection ?? "asc",
  })
  /** When true, list only tasks hidden from the normal view because Show on is after today. */
  const [showHiddenByShowOn, setShowHiddenByShowOn] = useState(initialShowHiddenByShowOn ?? false)
  const [isGroupedByProject, setIsGroupedByProject] = useState(initialIsGroupedByProject ?? false)
  const [isSaveDialogOpen, setIsSaveDialogOpen] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [lastSelectedId, setLastSelectedId] = useState<string | null>(null)
  const db = useDatabase()

  // Column state lifted from TasksTable
  const defaultOrder = TASK_COLUMNS.map((c) => c.key) as TaskColumnKey[]
  const defaultVisibility = TASK_COLUMNS.reduce((acc, c) => {
    acc[c.key] = c.defaultVisible
    return acc
  }, {} as Record<TaskColumnKey, boolean>)

  const columnState = useTableColumns<TaskColumnKey>(
    storageKey ?? "velocity:tasks-table:columns",
    defaultOrder,
    defaultVisibility,
  )
  
  // Sync state with initial props when they change (drill-down navigation)
  useEffect(() => {
    if (initialContextIds) {
      setContextIds(initialContextIds)
    } else {
      setContextIds(initialContextId ? [initialContextId] : [])
    }
    setPersonId(initialPersonId ?? null)
    setProjectId(initialProjectId ?? null)
    setShowStatus(initialShowStatus ?? "open")
    setIsGroupedByProject(initialIsGroupedByProject ?? false)
    setShowHiddenByShowOn(initialShowHiddenByShowOn ?? false)
    setSortConfig({
      key: initialSortKey ?? "urgency",
      direction: initialSortDirection ?? "asc",
    })
  }, [initialContextId, initialContextIds, initialPersonId, initialProjectId, initialShowStatus, initialIsGroupedByProject, initialShowHiddenByShowOn, initialSortKey, initialSortDirection])

  const filtered = useMemo(() => {
    return tasks
      .filter((t) => {
        if (contextIds.length === 0) return true
        return contextIds.some(id => (t.context_ids || []).includes(id))
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
      .filter((t) => true) // archived already excluded by RxDB query
      .filter((t) =>
        showHiddenByShowOn
          ? isTaskHiddenOnlyByShowOn(t)
          : isTaskVisibleByShowOnRule(t),
      )
      .sort((a, b) => {
        if (autoFocusTaskId) {
          if (a.id === autoFocusTaskId) return -1
          if (b.id === autoFocusTaskId) return 1
        }
        const { key, direction } = sortConfig
        let valA: any = ""
        let valB: any = ""

        if (key === "urgency") {
          valA = urgencies.find((u) => u.id === a.urgency_id)?.order ?? 999
          valB = urgencies.find((u) => u.id === b.urgency_id)?.order ?? 999
        } else if (key === "date_created") {
          valA = new Date(a.date_created).getTime()
          valB = new Date(b.date_created).getTime()
        } else if (key === "description") {
          valA = a.description.toLowerCase()
          valB = b.description.toLowerCase()
        } else if (key === "status") {
          valA = a.status
          valB = b.status
        } else if (key === "project") {
          valA = projects.find((p) => p.id === a.project_id)?.name.toLowerCase() ?? ""
          valB = projects.find((p) => p.id === b.project_id)?.name.toLowerCase() ?? ""
        } else if (key === "person") {
          valA = persons.find((p) => p.id === a.person_id)?.name.toLowerCase() ?? ""
          valB = persons.find((p) => p.id === b.person_id)?.name.toLowerCase() ?? ""
        } else if (key === "action_date") {
          valA = a.action_date ? new Date(a.action_date).getTime() : 0
          valB = b.action_date ? new Date(b.action_date).getTime() : 0
        } else if (key === "show_on") {
          valA = a.show_on ? new Date(a.show_on).getTime() : 0
          valB = b.show_on ? new Date(b.show_on).getTime() : 0
        } else if (key === "contexts") {
          valA = contexts.filter((c) => (a.context_ids || []).includes(c.id)).map((c) => c.name).sort().join(",").toLowerCase()
          valB = contexts.filter((c) => (b.context_ids || []).includes(c.id)).map((c) => c.name).sort().join(",").toLowerCase()
        }

        if (valA < valB) return direction === "asc" ? -1 : 1
        if (valA > valB) return direction === "asc" ? 1 : -1
        return 0
      })
  }, [
    tasks,
    contextIds,
    personId,
    projectId,
    showStatus,
    inboxMode,
    sortConfig,
    urgencies,
    projects,
    persons,
    contexts,
    showHiddenByShowOn,
  ])

  const groupedByProject = useMemo(() => {
    if (!isGroupedByProject) return null

    const groups: Record<string, Task[]> = {}
    filtered.forEach((t) => {
      const pid = t.project_id || "none"
      if (!groups[pid]) groups[pid] = []
      groups[pid].push(t)
    })

    // Sort projects alphabetically, with "none" at the end
    return Object.entries(groups)
      .map(([pid, tasks]) => ({
        id: pid,
        name: pid === "none" ? "No Project" : projects.find((p) => p.id === pid)?.name || "Unknown Project",
        tasks,
      }))
      .sort((a, b) => {
        if (a.id === "none") return 1
        if (b.id === "none") return -1
        return a.name.localeCompare(b.name)
      })
  }, [filtered, isGroupedByProject, contextIds, projects])

  useEffect(() => {
    setPrevTasksLength(tasks.length)
  }, [tasks])

  const handleAddNewTask = async (overriddenProjectId?: string | null) => {
    if (!onCreate) return
    const id = await onCreate({
      description: "New task",
      contextIds: contextIds,
      projectId: overriddenProjectId !== undefined ? overriddenProjectId : projectId,
      personId: personId,
      processed: !inboxMode,
    })
    if (id) {
      setAutoFocusTaskId(id)
    }
    setIsCreating(true)
  }

  const handleToggleSelection = (id: string, shiftKey?: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (shiftKey && lastSelectedId) {
        const order = filtered.map(t => t.id)
        const startIdx = order.indexOf(lastSelectedId)
        const endIdx = order.indexOf(id)
        if (startIdx !== -1 && endIdx !== -1) {
          const start = Math.min(startIdx, endIdx)
          const end = Math.max(startIdx, endIdx)
          for (let i = start; i <= end; i++) {
            next.add(order[i])
          }
        }
      } else {
        if (next.has(id)) next.delete(id)
        else next.add(id)
      }
      return next
    })
    setLastSelectedId(id)
  }

  const handleToggleAllSelection = (ids: string[]) => {
    if (ids.length === 0) {
      setSelectedIds(new Set())
      setLastSelectedId(null)
      return
    }
    setSelectedIds((prev) => {
      const next = new Set(prev)
      const anyIncluded = ids.some(id => next.has(id))
      if (anyIncluded) {
        ids.forEach(id => next.delete(id))
      } else {
        ids.forEach(id => next.add(id))
      }
      return next
    })
  }

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0 || !onDeleteTask) return

    if (selectedIds.size === 1) {
      if (window.confirm("Are you sure you want to delete this task?")) {
        const id = Array.from(selectedIds)[0]
        await onDeleteTask(id)
        setSelectedIds(new Set())
        toast.success("Task deleted")
      }
      return
    }

    // For multiple tasks, use a toast with an action to confirm
    toast.warning(`Delete ${selectedIds.size} tasks?`, {
      action: {
        label: "Confirm",
        onClick: async () => {
          const idsToDelete = Array.from(selectedIds)
          const count = idsToDelete.length
          for (const id of idsToDelete) {
            await onDeleteTask(id)
          }
          setSelectedIds(new Set())
          toast.success(`${count} tasks deleted`)
        }
      },
      duration: 5000,
    })
  }

  const handleSort = (key: string) => {
    setSortConfig((prev) => ({
      key,
      direction: prev.key === key && prev.direction === "asc" ? "desc" : "asc",
    }))
  }

  const handleSaveView = async (data: { name: string; icon: string; color: string }) => {
    if (!db) return
    const existing = await db.saved_views.find().exec()
    const maxOrder = existing.reduce((max, v) => Math.max(max, v.order || 0), -1)
    
    const id = crypto.randomUUID()
    const newView: SavedView = {
      id,
      name: data.name,
      icon: data.icon,
      color: data.color,
      context_ids: contextIds,
      project_id: projectId,
      person_id: personId,
      show_status: showStatus,
      is_grouped_by_project: isGroupedByProject,
      show_hidden_by_show_on: showHiddenByShowOn,
      sort_key: sortConfig.key,
      sort_direction: sortConfig.direction,
      date_created: new Date().toISOString(),
      order: maxOrder + 1,
    }
    await db.saved_views.insert(newView)
  }

  const isViewModified = 
    contextIds.length > 0 || 
    personId || 
    projectId || 
    showStatus !== "open" || 
    isGroupedByProject || 
    showHiddenByShowOn ||
    sortConfig.key !== "date_created" ||
    sortConfig.direction !== "desc"

  // Keyboard shortcut: Ctrl+N for new task
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "n") {
        // Only trigger if we're not already in an input/textarea/contenteditable
        if (
          e.target instanceof HTMLInputElement ||
          e.target instanceof HTMLTextAreaElement ||
          (e.target instanceof HTMLElement && (e.target.isContentEditable || e.target.closest("[contenteditable]")))
        ) {
          return
        }
        
        e.preventDefault()
        handleAddNewTask()
      }

      if ((e.key === "Delete" || e.key === "Backspace") && selectedIds.size > 0) {
        // Only trigger if we're not already in an input/textarea/contenteditable
        if (
          e.target instanceof HTMLInputElement ||
          e.target instanceof HTMLTextAreaElement ||
          (e.target instanceof HTMLElement && (e.target.isContentEditable || e.target.closest("[contenteditable]")))
        ) {
          return
        }
        e.preventDefault()
        handleBulkDelete()
      }
    }
    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [handleAddNewTask, selectedIds, handleBulkDelete])

  const hasFilter = contextIds.length > 0 || personId || projectId

  const tableEmptyTitle = showHiddenByShowOn
    ? "No tasks hidden by Show on"
    : (emptyTitle ?? "No tasks match these filters")
  const tableEmptyHint = showHiddenByShowOn
    ? "Tasks with a Show on date after today appear here so you can change or clear the date."
    : (emptyHint ?? "Try clearing one or capturing a new task.")

  const hiddenCols: ("status" | "urgency" | "description" | "details" | "project" | "person" | "contexts" | "show_on" | "action_date" | "date_created")[] = []
  if (inboxMode) {
    // If we have an inboxMode, maybe we hide certain columns or handle the column label differently
  }

  return (
    <div key={`${initialContextId}-${initialContextIds?.join(",")}-${initialProjectId}-${initialPersonId}-${initialShowStatus}-${initialIsGroupedByProject}-${initialShowHiddenByShowOn}-${initialSortKey}-${initialSortDirection}`} className={cn(
      "flex flex-col min-w-0 w-full bg-card overflow-hidden",
      fullWidthOnMobile 
        ? "border-b border-border md:rounded-lg md:border" 
        : "rounded-lg border border-border"
    )}>
      {/* Filter bar */}
      {!hideFilterBar && (
        <div className="flex flex-wrap items-center gap-2 border-b border-border bg-muted/20 p-3 md:p-2">
          <div className="flex items-center gap-1.5 px-1 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
            <Filter className="h-3 w-3" />
          </div>

          {!hideFilters.includes("status") && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-2.5 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted md:py-1"
                >
                  {showStatus === "all" ? "All" : showStatus === "open" ? "Open" : "Done"}
                  <ChevronDown className="h-3 w-3" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-32">
                <DropdownMenuItem onClick={() => setShowStatus("all")}>All</DropdownMenuItem>
                <DropdownMenuItem onClick={() => setShowStatus("open")}>Open</DropdownMenuItem>
                <DropdownMenuItem onClick={() => setShowStatus("done")}>Done</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}

          {!hideFilters.includes("context") && (
            <FilterPill
              label="Context"
              value={
                contextIds.length > 1 
                  ? `${contextIds.length} selected` 
                  : (contextIds.length === 1 ? contexts.find((c) => c.id === contextIds[0])?.name : undefined)
              }
              options={contexts.map((c) => ({ id: c.id, label: c.name, color: c.color }))}
              selectedIds={contextIds}
              onSelect={(id) => setContextIds((prev) => 
                prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
              )}
              onClear={() => setContextIds([])}
              multiSelect={true}
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

          <div className="ml-auto flex items-center gap-2">
            <span className="hidden lg:inline font-mono text-[10px] uppercase tracking-wider text-muted-foreground mr-2">
              {filtered.length} {filtered.length === 1 ? itemNoun : `${itemNoun}s`}
            </span>

            {!projectId && !hideFilters.includes("project") && (
              <button
                type="button"
                onClick={() => setIsGroupedByProject(!isGroupedByProject)}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-medium transition-colors",
                  isGroupedByProject
                    ? "border-primary bg-primary/15 text-primary"
                    : "border-border bg-background text-muted-foreground hover:bg-muted"
                )}
                title="Group tasks by project"
              >
                <LayoutList className="h-3.5 w-3.5" />
                <span className="hidden md:inline">Group by project</span>
              </button>
            )}

            <ShowOnVisibilityToggle
              active={showHiddenByShowOn}
              onToggle={() => setShowHiddenByShowOn((v) => !v)}
            />

            <div className="h-4 w-px bg-border mx-1 hidden md:block" />

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="hidden md:inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-2.5 py-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
                >
                  <Columns3 className="h-3.5 w-3.5" />
                  <span className="hidden lg:inline">Columns</span>
                  <span className="ml-1 rounded bg-muted px-1.5 font-mono text-[10px] text-muted-foreground">
                    {columnState.order.filter(k => !hiddenCols.includes(k) && columnState.visibility[k]).length}/{columnState.order.filter(k => !hiddenCols.includes(k)).length}
                  </span>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-60">
                <DropdownMenuLabel className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                  Toggle columns
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                {columnState.order.filter(k => !hiddenCols.includes(k)).map((key) => {
                  const label = inboxMode && key === "status" ? "Processed" : COLUMN_MAP[key].label
                  return (
                    <DropdownMenuCheckboxItem
                      key={key}
                      checked={columnState.visibility[key]}
                      onCheckedChange={() => columnState.toggle(key)}
                      onSelect={(e) => e.preventDefault()}
                    >
                      {label}
                    </DropdownMenuCheckboxItem>
                  )
                })}
                <DropdownMenuSeparator />
                <div className="px-2 py-1.5 text-[11px] leading-relaxed text-muted-foreground">
                  Drag column headers in the table to reorder.
                </div>
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={() => columnState.reset()} className="text-xs">
                  <RotateCcw className="mr-2 h-3 w-3" />
                  Reset to defaults
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            {isViewModified && (
              <button
                type="button"
                onClick={() => setIsSaveDialogOpen(true)}
                className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-border bg-background text-muted-foreground transition-colors hover:text-primary md:h-7 md:w-7"
                title="Save current view"
              >
                <Star className="h-3.5 w-3.5" />
              </button>
            )}

            {onCreate && (
              <button
                type="button"
                onClick={() => handleAddNewTask()}
                className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/90"
              >
                <Plus className="h-3.5 w-3.5" />
                <span className="hidden md:inline">Add task</span>
              </button>
            )}

            {hasFilter && (
              <button
                type="button"
                onClick={() => {
                  setContextIds([])
                  setPersonId(null)
                  setProjectId(null)
                  setShowHiddenByShowOn(false)
                  setIsGroupedByProject(false)
                }}
                className="inline-flex items-center gap-1 rounded px-3 py-2 text-sm text-muted-foreground hover:text-foreground md:px-2 md:py-1 md:text-xs"
              >
                <X className="h-3.5 w-3.5" />
                <span className="hidden md:inline">Clear all</span>
              </button>
            )}
          </div>
        </div>
      )}

      {hideFilterBar && (
        <div className="flex items-center justify-end p-2 border-b border-border bg-muted/20">
          <ShowOnVisibilityToggle
            active={showHiddenByShowOn}
            onToggle={() => setShowHiddenByShowOn((v) => !v)}
          />
        </div>
      )}

      <div className="min-h-0 min-w-0 w-full overflow-y-visible md:overflow-y-auto max-h-none md:max-h-[calc(100vh-180px)]">
        {groupedByProject ? (
          <div className="flex flex-col gap-8 p-4">
            {groupedByProject.map((group) => (
              <div key={group.id} className="flex flex-col gap-2">
                <div className="sticky top-0 z-20 flex items-center justify-between bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/75 py-2 px-1">
                  <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                    <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                    {group.name}
                    <span className="ml-2 font-mono text-[10px] uppercase tracking-wider text-muted-foreground font-normal">
                      {group.tasks.length} {group.tasks.length === 1 ? itemNoun : `${itemNoun}s`}
                    </span>
                  </h3>
                  {onCreate && (
                    <button
                      type="button"
                      onClick={() => handleAddNewTask(group.id === "none" ? null : group.id)}
                      className="inline-flex items-center gap-1 rounded bg-primary/10 px-2 py-1 text-[10px] font-medium text-primary transition-colors hover:bg-primary/20"
                    >
                      <Plus className="mr-1 h-3 w-3" />
                      Add to {group.name}
                    </button>
                  )}
                </div>
                <TasksTable
                  tasks={group.tasks}
                  projects={projects}
                  persons={persons}
                  contexts={contexts}
                  urgencies={urgencies}
                  onToggleProcessed={onToggleProcessed}
                  onUpdate={onUpdate}
                  onArchiveTask={onArchiveTask}
                  onDeleteTask={onDeleteTask}
                  hideColumns={hiddenCols}
                  columnState={columnState}
                  emptyTitle={tableEmptyTitle}
                  emptyHint={tableEmptyHint}
                  itemNoun={itemNoun}
                  inboxMode={inboxMode}
                  onCreate={onCreate ? () => handleAddNewTask(group.id === "none" ? null : group.id) : undefined}
                  onToggleStatus={onToggleStatus}
                  autoFocusTaskId={autoFocusTaskId}
                  onAutoFocusComplete={() => setAutoFocusTaskId(null)}
                  sortConfig={sortConfig}
                  onSort={handleSort}
                  selectedIds={selectedIds}
                  onToggleSelection={handleToggleSelection}
                  onToggleAll={handleToggleAllSelection}
                  onBulkDelete={handleBulkDelete}
                  hideToolbar
                />
              </div>
            ))}
          </div>
        ) : (
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
            columnState={columnState}
            emptyTitle={tableEmptyTitle}
            emptyHint={tableEmptyHint}
            itemNoun={itemNoun}
            inboxMode={inboxMode}
            onCreate={onCreate ? () => handleAddNewTask() : undefined}
            onToggleStatus={onToggleStatus}
            autoFocusTaskId={autoFocusTaskId}
            onAutoFocusComplete={() => setAutoFocusTaskId(null)}
            sortConfig={sortConfig}
            onSort={handleSort}
            selectedIds={selectedIds}
            onToggleSelection={handleToggleSelection}
            onToggleAll={handleToggleAllSelection}
            onBulkDelete={handleBulkDelete}
            hideToolbar
          />
        )}
      </div>

      {onCreate && (
        <button
          type="button"
          onClick={() => handleAddNewTask()}
          className="fixed bottom-[88px] right-6 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg active:scale-95 transition-transform md:hidden"
          aria-label="Add task"
        >
          <Plus className="h-6 w-6" />
        </button>
      )}

      <SaveViewDialog
        open={isSaveDialogOpen}
        onOpenChange={setIsSaveDialogOpen}
        onSave={handleSaveView}
      />
    </div>
  )
}

function ShowOnVisibilityToggle({
  active,
  onToggle,
}: {
  active: boolean
  onToggle: () => void
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-medium transition-colors",
        active
          ? "border-primary bg-primary/15 text-primary"
          : "border-border bg-background text-muted-foreground hover:bg-muted",
      )}
      aria-pressed={active}
      title={
        active
          ? "Return to the normal list (Show on today or earlier, or unset)"
          : "List only tasks hidden because Show on is after today"
      }
    >
      <CalendarClock className="h-3.5 w-3.5 shrink-0" />
      <span className="hidden md:inline">{active ? "Due tasks" : "Hidden by date"}</span>
    </button>
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
  selectedIds = [],
  onSelect,
  onClear,
  multiSelect = false,
}: {
  label: string
  value?: string
  options: { id: string; label: string; color?: string }[]
  selectedIds?: string[]
  onSelect: (id: string) => void
  onClear: () => void
  multiSelect?: boolean
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
              : "border-border bg-background text-muted-foreground hover:bg-muted",
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
      <PopoverContent align="start" className="w-56 p-2">
        <div className="max-h-64 overflow-auto">
          {options.map((opt) => {
            const isSelected = selectedIds.includes(opt.id) || value === opt.label
            return (
              <button
                key={opt.id}
                type="button"
                onClick={() => {
                  onSelect(opt.id)
                  if (!multiSelect) setOpen(false)
                }}
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
                {isSelected ? <Check className="h-3 w-3 text-primary" /> : null}
              </button>
            )
          })}
        </div>
      </PopoverContent>
    </Popover>
  )
}
