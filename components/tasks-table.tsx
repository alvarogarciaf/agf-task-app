"use client"

import { useState, useRef, useCallback, useEffect } from "react"
import { Plus, Calendar, Circle, CircleCheck, Check, Columns3, ExternalLink, RotateCcw, MoreVertical, Archive, Trash2, Minus, Lock, Eye, Pencil, FileText, ArrowLeftRight } from "lucide-react"
import { toast } from "sonner"
import { Checkbox } from "@/components/ui/checkbox"
import { cn } from "@/lib/utils"
import {
  DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent,
  DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
  DropdownMenuPortal,
} from "@/components/ui/dropdown-menu"
import { useTableColumns } from "@/hooks/use-table-columns"
import { useIsMobile } from "@/hooks/use-mobile"
import { TaskDetailDialog } from "@/components/task-detail-dialog"
import { InlineTextEditor, InlineSelectEditor, InlineMultiSelectEditor, InlineDateEditor } from "@/components/inline-cell-editors"
import type { Context, Person, Project, Tag, Task, UrgencyLevel } from "@/lib/types"

export type TaskColumnKey =
  | "status"
  | "urgency"
  | "description"
  | "details"
  | "project"
  | "person"
  | "contexts"
  | "tags"
  | "show_on"
  | "action_date"
  | "date_created"

interface ColumnDef {
  key: TaskColumnKey
  label: string
  defaultVisible: boolean
}

export const TASK_COLUMNS: ColumnDef[] = [
  { key: "status", label: "Status", defaultVisible: true },
  { key: "urgency", label: "Urgency", defaultVisible: true },
  { key: "description", label: "Description", defaultVisible: true },
  { key: "details", label: "Details", defaultVisible: false },
  { key: "project", label: "Project", defaultVisible: true },
  { key: "person", label: "Person", defaultVisible: true },
  { key: "contexts", label: "Contexts", defaultVisible: true },
  { key: "tags", label: "Tags", defaultVisible: false },
  { key: "show_on", label: "Show on", defaultVisible: false },
  { key: "action_date", label: "Action date", defaultVisible: false },
  { key: "date_created", label: "Created", defaultVisible: true },
]

export const COLUMN_MAP: Record<TaskColumnKey, ColumnDef> = TASK_COLUMNS.reduce(
  (acc, c) => {
    acc[c.key] = c
    return acc
  },
  {} as Record<TaskColumnKey, ColumnDef>,
)

const DEFAULT_ORDER: TaskColumnKey[] = TASK_COLUMNS.map((c) => c.key)

const DEFAULT_VISIBILITY: Record<TaskColumnKey, boolean> = TASK_COLUMNS.reduce(
  (acc, c) => {
    acc[c.key] = c.defaultVisible
    return acc
  },
  {} as Record<TaskColumnKey, boolean>,
)



const COLUMN_HEADER_CLASSES: Partial<Record<TaskColumnKey, string>> = {
  status: "w-10",
  urgency: "w-16",
  description: "min-w-[280px]",
  details: "min-w-[260px]",
  show_on: "w-28",
  action_date: "w-28",
  date_created: "w-24",
}

const COLUMN_CELL_CLASSES: Partial<Record<TaskColumnKey, string>> = {
  description: "max-w-[420px]",
  details: "max-w-[360px]",
}

const EDITABLE_COLUMNS = new Set<TaskColumnKey>([
  "description", "details", "project", "person", "contexts", "tags", "urgency", "show_on", "action_date",
])

interface TasksTableProps {
  tasks: Task[]
  projects: Project[]
  persons: Person[]
  contexts: Context[]
  tags?: Tag[]
  urgencies: UrgencyLevel[]
  onToggleProcessed: (id: string) => void
  onToggleStatus: (id: string) => void
  onUpdate: (task: Task) => void
  onArchiveTask?: (id: string) => void
  onDeleteTask?: (id: string) => void
  /** When true, render note-appropriate UI (no status/urgency semantics). */
  notesMode?: boolean
  /** Columns that should never appear or be toggleable in this instance. */
  hideColumns?: TaskColumnKey[]
  /** Custom storage key when this instance should remember a separate column config. */
  storageKey?: string
  /** Whether to hide the top toolbar (row count, columns, add task). */
  hideToolbar?: boolean
  /** Optional custom empty state. */
  emptyTitle?: string
  emptyHint?: string
  /** Optional label for the row count in the toolbar (defaults to "tasks"). */
  itemNoun?: string
  inboxMode?: boolean
  onCreate?: () => void
  autoFocusTaskId?: string | null
  onAutoFocusComplete?: () => void
  sortConfig?: { key: string; direction: "asc" | "desc" }
  onSort?: (key: string) => void
  /** Controlled column state from a parent component. */
  columnState?: {
    order: TaskColumnKey[]
    visibility: Record<TaskColumnKey, boolean>
    toggle: (key: TaskColumnKey) => void
    reorder: (source: TaskColumnKey, target: TaskColumnKey) => void
    reset: () => void
  }
  selectedIds?: Set<string>
  onToggleSelection?: (id: string, shiftKey?: boolean) => void
  onToggleAll?: (ids: string[]) => void
  onBulkDelete?: () => void
  isNested?: boolean
}

export function TasksTable({
  tasks,
  projects,
  persons,
  contexts,
  tags = [],
  urgencies,
  onToggleProcessed,
  onToggleStatus,
  onUpdate,
  onArchiveTask,
  onDeleteTask,
  notesMode = false,
  hideColumns,
  storageKey = "velocity:tasks-table:columns",
  emptyTitle = "No tasks match these filters",
  emptyHint = "Try clearing one or capturing a new task.",
  itemNoun = "task",
  inboxMode = false,
  onCreate,
  autoFocusTaskId,
  onAutoFocusComplete,
  sortConfig,
  onSort,
  hideToolbar = false,
  columnState,
  selectedIds = new Set(),
  onToggleSelection,
  onToggleAll,
  onBulkDelete,
  isNested = false,
}: TasksTableProps) {
  const internalColumnState = useTableColumns<TaskColumnKey>(
    storageKey, DEFAULT_ORDER, DEFAULT_VISIBILITY,
  )
  const { order, visibility, toggle, reorder, reset } = columnState || internalColumnState
  const [dragKey, setDragKey] = useState<TaskColumnKey | null>(null)
  const [dropTarget, setDropTarget] = useState<TaskColumnKey | null>(null)
  const [activeTaskId, setActiveTaskId] = useState<string | null>(null)
  // In the inbox, tapping a task should jump straight into editing (triage flow);
  // everywhere else the default open action shows the read-only view first.
  const defaultOpenMode: "view" | "edit" = inboxMode ? "edit" : "view"
  const [detailMode, setDetailMode] = useState<"view" | "edit">(defaultOpenMode)
  const [selectedCell, setSelectedCell] = useState<{ taskId: string; column: TaskColumnKey } | null>(null)
  const [isEditing, setIsEditing] = useState(false)
  const cellRefs = useRef<Record<string, HTMLTableCellElement | null>>({})
  const isMobile = useIsMobile()

  // Auto-focus logic for new tasks - opens the detail dialog in edit mode
  useEffect(() => {
    if (autoFocusTaskId && tasks.some(t => t.id === autoFocusTaskId)) {
      setDetailMode("edit")
      setActiveTaskId(autoFocusTaskId)
      onAutoFocusComplete?.()
    }
  }, [autoFocusTaskId, tasks, onAutoFocusComplete])

  // Refocus cell when exiting edit mode
  useEffect(() => {
    if (selectedCell && !isEditing) {
      cellRefs.current[`${selectedCell.taskId}-${selectedCell.column}`]?.focus()
    }
  }, [selectedCell, isEditing])

  const hidden = new Set(hideColumns ?? [])
  const orderableKeys = order.filter((k) => !hidden.has(k))
  const visibleColumns = orderableKeys.filter((k) => visibility[k])
  const visibleCount = visibleColumns.length
  const totalCount = orderableKeys.length

  const allVisibleIds = tasks.map(t => t.id)
  const isAllSelected = allVisibleIds.length > 0 && allVisibleIds.every(id => selectedIds.has(id))
  const isSomeSelected = allVisibleIds.some(id => selectedIds.has(id)) && !isAllSelected

  const activeTask = activeTaskId ? tasks.find((t) => t.id === activeTaskId) ?? null : null

  // History management for back button on mobile
  useEffect(() => {
    if (!isMobile) return

    const handlePopState = () => {
      setActiveTaskId(null)
    }

    if (activeTaskId) {
      window.history.pushState({ type: "task-detail" }, "")
      window.addEventListener("popstate", handlePopState)
    }

    return () => {
      window.removeEventListener("popstate", handlePopState)
    }
  }, [activeTaskId, isMobile])

  const handleCloseTask = useCallback(() => {
    if (isMobile && activeTaskId) {
      // On mobile, let popstate handle the state update
      window.history.back()
    } else {
      setActiveTaskId(null)
      setDetailMode("view")
    }
  }, [isMobile, activeTaskId])

  useEffect(() => {
    if (!activeTaskId) {
      setDetailMode("view")
    }
  }, [activeTaskId])

  function handleDragStart(e: React.DragEvent<HTMLDivElement>, key: TaskColumnKey) {
    setDragKey(key)
    e.dataTransfer.effectAllowed = "move"
    e.dataTransfer.setData("text/plain", key)
  }

  function handleDragOver(e: React.DragEvent<HTMLTableCellElement>, key: TaskColumnKey) {
    if (!dragKey || dragKey === key) return
    e.preventDefault()
    e.dataTransfer.dropEffect = "move"
    if (dropTarget !== key) setDropTarget(key)
  }

  function handleDragLeave(key: TaskColumnKey) {
    if (dropTarget === key) setDropTarget(null)
  }

  function handleDrop(e: React.DragEvent<HTMLTableCellElement>, key: TaskColumnKey) {
    e.preventDefault()
    if (dragKey && dragKey !== key) {
      reorder(dragKey, key)
    }
    setDragKey(null)
    setDropTarget(null)
  }

  function handleDragEnd() { setDragKey(null); setDropTarget(null) }

  function navigateCell(taskId: string, column: TaskColumnKey, rowOffset: number, colOffset: number, startEditing = false) {
    const editableCols = visibleColumns.filter((k) => EDITABLE_COLUMNS.has(k))
    const taskIdx = tasks.findIndex((t) => t.id === taskId)
    const colIdx = editableCols.indexOf(column)

    let nextTaskIdx = taskIdx + rowOffset
    let nextColIdx = colIdx + colOffset

    // Wrap columns if needed when tabbing
    if (colOffset !== 0 && rowOffset === 0) {
       if (nextColIdx >= editableCols.length) {
         nextColIdx = 0
         nextTaskIdx++
       } else if (nextColIdx < 0) {
         nextColIdx = editableCols.length - 1
         nextTaskIdx--
       }
    }

    if (nextTaskIdx >= 0 && nextTaskIdx < tasks.length && nextColIdx >= 0 && nextColIdx < editableCols.length) {
      const nextTaskId = tasks[nextTaskIdx].id
      const nextCol = editableCols[nextColIdx]
      setSelectedCell({ taskId: nextTaskId, column: nextCol })
      setIsEditing(startEditing)

      // Focus the cell DOM element
      setTimeout(() => {
        cellRefs.current[`${nextTaskId}-${nextCol}`]?.focus()
      }, 0)
    } else {
      setSelectedCell(null)
      setIsEditing(false)
    }
  }

  function commitCell(task: Task, column: TaskColumnKey, value: string | string[] | null, close = true) {
    let patch: Partial<Task> = {}
    if (column === "description") patch = { description: value as string }
    else if (column === "details") patch = { details: value as string }
    else if (column === "project") patch = { project_id: value as string | null }
    else if (column === "person") patch = { person_id: value as string | null }
    else if (column === "urgency") patch = { urgency_id: value as string }
    else if (column === "contexts") patch = { context_ids: value as string[] }
    else if (column === "tags") patch = { tag_ids: value as string[] }
    else if (column === "show_on") patch = { show_on: value as string | null }
    else if (column === "action_date") patch = { action_date: value as string | null }
    if (Object.keys(patch).length) onUpdate({ id: task.id, ...patch } as Task)
    if (close) {
      setIsEditing(false)
    }
  }

  function convertTaskType(task: Task) {
    const nextType = task.type === "note" ? "task" : "note"
    const patch: Partial<Task> = { id: task.id, type: nextType }
    if (nextType === "task") {
      if (!task.urgency_id) {
        patch.urgency_id = [...urgencies].sort((a, b) => a.order - b.order)[0]?.id
      }
      if (task.status !== "Open" && task.status !== "Done") {
        patch.status = "Open"
      }
    }
    onUpdate(patch as Task)
    toast.success(nextType === "note" ? "Converted to Note" : "Converted to Task")
  }

  function getCellValue(task: Task, column: TaskColumnKey): any {
    if (column === "description") return task.description
    if (column === "details") return task.details
    if (column === "project") return task.project_id
    if (column === "person") return task.person_id
    if (column === "urgency") return task.urgency_id
    if (column === "contexts") return task.context_ids
    if (column === "tags") return task.tag_ids
    return null
  }

  return (
    <div className={cn(
      "overflow-hidden",
      isNested ? "" : "md:rounded-lg md:border md:border-border md:bg-card"
    )}>
      {/* Toolbar */}
      {!hideToolbar && (
        <div className="hidden md:flex items-center justify-between border-b border-border px-3 py-2">
        <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
          {tasks.length} {tasks.length === 1 ? itemNoun : `${itemNoun}s`}
        </span>

        <div className="flex items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-2.5 py-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
              >
                <Columns3 className="h-3.5 w-3.5" />
                Columns
                <span className="ml-1 rounded bg-muted px-1.5 font-mono text-[10px] text-muted-foreground">
                  {visibleCount}/{totalCount}
                </span>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-60">
              <DropdownMenuLabel className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                Toggle columns
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              {orderableKeys.map((key) => {
                const label = inboxMode && key === "status" ? "Processed" : COLUMN_MAP[key].label
                return (
                  <DropdownMenuCheckboxItem
                    key={key}
                    checked={visibility[key]}
                    onCheckedChange={() => toggle(key)}
                    onSelect={(e) => e.preventDefault()}
                  >
                    {label}
                  </DropdownMenuCheckboxItem>
                )
              })}
              <DropdownMenuSeparator />
              <div className="px-2 py-1.5 text-[11px] leading-relaxed text-muted-foreground">
                Drag column headers to reorder. Order &amp; visibility are saved per device.
              </div>
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={() => reset()} className="text-xs">
                <RotateCcw className="mr-2 h-3 w-3" />
                Reset to defaults
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {onCreate && (
            <button
              type="button"
              onClick={onCreate}
              className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/90"
            >
              <Plus className="h-3.5 w-3.5" />
              Add task
            </button>
          )}
        </div>
      </div>
    )}

      {/* Table */}
      {tasks.length === 0 ? (
        <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
          <p className="text-sm font-medium">{emptyTitle}</p>
          <p className="mt-1 text-xs text-muted-foreground">{emptyHint}</p>
        </div>
      ) : (
        <>
          <div className={cn(
            "md:hidden flex w-full min-w-0 flex-col space-y-2",
            isNested ? "p-0 bg-transparent" : "px-3.5 py-3 bg-muted/10"
          )}>
            {selectedIds.size > 0 && (
              <div className="flex items-center justify-between px-4 py-2.5 bg-primary/10 border border-primary/20 rounded-xl animate-in slide-in-from-top duration-200">
                <span className="text-sm font-semibold text-primary">
                  {selectedIds.size} selected
                </span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => onBulkDelete?.()}
                    className="rounded-lg bg-destructive/10 px-3 py-1.5 text-xs font-semibold text-destructive active:bg-destructive/20 transition-colors cursor-pointer"
                  >
                    Delete
                  </button>
                  <button
                    onClick={() => onToggleAll?.([])}
                    className="rounded-lg bg-primary/10 px-3 py-1.5 text-xs font-semibold text-primary active:bg-primary/20 transition-colors cursor-pointer"
                  >
                    Deselect
                  </button>
                </div>
              </div>
            )}
            {tasks.map((task) => {
              const urgency = urgencies?.find((u) => u.id === task.urgency_id)
              return (
                <MobileTaskRow
                  key={task.id}
                  task={task}
                  urgency={urgency}
                  onToggleProcessed={onToggleProcessed}
                  onToggleStatus={onToggleStatus}
                  onArchiveTask={onArchiveTask}
                  onDeleteTask={onDeleteTask}
                  onConvert={convertTaskType}
                  inboxMode={inboxMode}
                  notesMode={notesMode}
                  onClick={(t) => {
                    if (selectedIds.size > 0) {
                      onToggleSelection?.(t.id)
                    } else {
                      setDetailMode(defaultOpenMode)
                      setActiveTaskId(t.id)
                    }
                  }}
                  onEditClick={(t) => {
                    setDetailMode("edit")
                    setActiveTaskId(t.id)
                  }}
                  isSelected={selectedIds.has(task.id)}
                  onToggleSelection={() => onToggleSelection?.(task.id)}
                />
              )
            })}
          </div>
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full border-collapse text-sm">
            <thead className="sticky top-0 z-10 bg-card">
              <tr className="border-b border-border">
                <th className="w-10 px-3 py-2 text-left align-middle select-none">
                  <Checkbox 
                    checked={isAllSelected ? true : (isSomeSelected ? "indeterminate" : false)}
                    onCheckedChange={() => onToggleAll?.(allVisibleIds)}
                    aria-label="Select all"
                  />
                </th>
                {visibleColumns.map((key) => {
                  const col = COLUMN_MAP[key]
                  const label = inboxMode && key === "status" ? "Processed" : col.label
                  const isDragging = dragKey === key
                  const isDropTarget = dropTarget === key && dragKey !== key
                  return (
                    <th
                      key={key}
                      scope="col"
                      onDragOver={(e) => handleDragOver(e, key)}
                      onDragLeave={() => handleDragLeave(key)}
                      onDrop={(e) => handleDrop(e, key)}
                      onClick={() => onSort?.(key)}
                      className={cn(
                        "relative px-3 py-2 text-left font-mono text-[10px] font-medium uppercase tracking-wider text-muted-foreground transition-colors cursor-pointer select-none hover:bg-muted/50",
                        COLUMN_HEADER_CLASSES[key],
                        isDragging && "opacity-40",
                        isDropTarget && "bg-primary/10",
                        sortConfig?.key === key && "text-foreground",
                      )}
                    >
                      {isDropTarget ? (
                        <span
                          aria-hidden
                          className="pointer-events-none absolute inset-y-0 left-0 w-0.5 bg-primary"
                        />
                      ) : null}

                      <div
                        draggable
                        onDragStart={(e) => handleDragStart(e, key)}
                        onDragEnd={handleDragEnd}
                        className={cn(
                          "flex w-full items-center justify-start gap-1",
                          isDragging && "cursor-grabbing",
                        )}
                        title="Click to sort, drag to reorder"
                      >
                        <span className="truncate">{label}</span>
                        {sortConfig?.key === key && (
                          <span className="ml-1 shrink-0 text-[10px] text-primary">
                            {sortConfig.direction === "asc" ? "↑" : "↓"}
                          </span>
                        )}
                      </div>
                    </th>
                  )
                })}
              </tr>
            </thead>
            <tbody>
              {tasks.map((task) => {
                const project = projects.find((p) => p.id === task.project_id)
                const person = persons.find((p) => p.id === task.person_id)
                const tCtx = contexts.filter((c) => (task.context_ids || []).includes(c.id))
                const tTags = tags.filter((tg) => (task.tag_ids || []).includes(tg.id))
                const urgency = urgencies.find((u) => u.id === task.urgency_id)
                return (
                  <tr
                    key={task.id}
                    className={cn(
                      "group border-b border-border/60 last:border-b-0 transition-colors hover:bg-muted/30 select-none",
                      selectedIds.has(task.id) && "bg-primary/5 hover:bg-primary/10"
                    )}
                  >
                    <td 
                      className="w-10 px-3 py-2 text-left align-middle"
                      onClick={(e) => {
                        e.stopPropagation()
                        onToggleSelection?.(task.id, e.shiftKey)
                      }}
                    >
                      <Checkbox 
                        checked={selectedIds.has(task.id)}
                        onCheckedChange={() => {}} // Click handled by td for Shift support
                        className="pointer-events-none" // Pass clicks to td
                        aria-label={`Select ${task.description}`}
                      />
                    </td>
                    {visibleColumns.map((key) => {
                      const isSelected = selectedCell?.taskId === task.id && selectedCell?.column === key
                      const isEditingThis = isSelected && isEditing
                      const isProjectShared = !!(project && project.linked_person_id)
                      const isEditable = EDITABLE_COLUMNS.has(key) && !(key === "person" && isProjectShared)
                      return (
                        <td
                          key={key}
                          ref={(el) => {
                            cellRefs.current[`${task.id}-${key}`] = el
                          }}
                          tabIndex={isEditable ? 0 : -1}
                          onFocus={() => {
                            if (selectedIds.size > 0) return // Don't focus cells if in selection mode
                            if (isEditable && !isSelected) {
                              setSelectedCell({ taskId: task.id, column: key })
                              setIsEditing(false)
                            }
                          }}
                          onKeyDown={(e) => {
                            if (!isSelected) return

                            // Start editing on alphanumeric key or Enter
                            if (!isEditing && e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
                              setIsEditing(true)
                              return
                            }

                            if (!isEditing) {
                              if (e.key === "Enter" && e.ctrlKey) {
                                e.preventDefault()
                                onToggleProcessed(task.id)
                                setSelectedCell(null)
                                return
                              }

                              if ((e.key === "Delete" || e.key === "Backspace") && selectedIds.size > 0) {
                                e.preventDefault()
                                onBulkDelete?.()
                                return
                              }
                              
                              if (e.key === "ArrowRight") { e.preventDefault(); navigateCell(task.id, key, 0, 1) }
                              else if (e.key === "ArrowLeft") { e.preventDefault(); navigateCell(task.id, key, 0, -1) }
                              else if (e.key === "ArrowDown") { e.preventDefault(); navigateCell(task.id, key, 1, 0) }
                              else if (e.key === "ArrowUp") { e.preventDefault(); navigateCell(task.id, key, -1, 0) }
                              else if (e.key === "Tab") { e.preventDefault(); navigateCell(task.id, key, 0, e.shiftKey ? -1 : 1) }
                              else if (e.key === "Enter") { e.preventDefault(); setIsEditing(true) }
                              else if (e.key === "Backspace" || e.key === "Delete") {
                                e.preventDefault()
                                commitCell(task, key, (key === "contexts" ? [] : null))
                              }
                            }
                          }}
                          className={cn(
                            "relative px-3 py-2 align-middle outline-none transition-shadow",
                            COLUMN_CELL_CLASSES[key],
                            dropTarget === key && dragKey !== key && "bg-primary/5",
                            isEditable && "cursor-cell",
                            isSelected && "ring-2 ring-inset ring-primary z-20",
                            isEditingThis && "ring-primary bg-background shadow-lg",
                          )}
                          onClick={(e) => {
                            if (selectedIds.size > 0 || e.shiftKey) {
                              e.stopPropagation()
                              onToggleSelection?.(task.id, e.shiftKey)
                              return
                            }
                            if (!isEditable) return
                            e.stopPropagation()
                            if (!isSelected) {
                              setSelectedCell({ taskId: task.id, column: key })
                              setIsEditing(false)
                            }
                          }}
                          onDoubleClick={(e) => {
                            if (selectedIds.size > 0) return
                            if (!isEditable) return
                            e.stopPropagation()
                            setSelectedCell({ taskId: task.id, column: key })
                            setIsEditing(true)
                          }}
                          onCopy={(e) => {
                            if (isEditing) return // Let the default behavior handle it when editing text
                            e.preventDefault()
                            const val = getCellValue(task, key)
                            if (val !== undefined && val !== null) {
                              const text = typeof val === "string" ? val : JSON.stringify(val)
                              e.clipboardData.setData("text/plain", text)
                            }
                          }}
                          onPaste={(e) => {
                            if (isEditing) return // Let the default behavior handle it when editing text
                            e.preventDefault()
                            const text = e.clipboardData.getData("text/plain")
                            if (!text) return
                            
                            let val: any = text
                            try {
                              // Try to parse as JSON for arrays (contexts)
                              const parsed = JSON.parse(text)
                              if (Array.isArray(parsed) || typeof parsed === "string" || parsed === null) {
                                val = parsed
                              }
                            } catch {
                              // Not JSON, use as is
                            }
                            commitCell(task, key, val)
                          }}
                        >
                          {isEditingThis ? (
                            <InlineCellEditor
                              task={task}
                              column={key}
                              projects={projects}
                              persons={persons}
                              contexts={contexts}
                              tags={tags}
                              urgencies={urgencies}
                              onCommit={(val, close) => {
                                commitCell(task, key, val, close)
                                if (close) {
                                  // Excel behavior: move down on Enter
                                  // navigateCell(task.id, key, 1, 0)
                                }
                              }}
                              onCancel={() => setIsEditing(false)}
                              onTab={(rev) => { navigateCell(task.id, key, 0, rev ? -1 : 1, false) }}
                              onCtrlEnter={() => {
                                onToggleProcessed(task.id)
                                setSelectedCell(null)
                                setIsEditing(false)
                              }}
                            />
                          ) : (
                            renderCell(key, {
                              task,
                              project,
                              person,
                              contexts: tCtx,
                              tags: tTags,
                              urgency,
                              onToggleProcessed,
                              onToggleStatus,
                              inboxMode,
                              onOpenView: (id) => {
                                setDetailMode("view")
                                setActiveTaskId(id)
                              },
                              onOpenEdit: (id) => {
                                setDetailMode("edit")
                                setActiveTaskId(id)
                              },
                            })
                          )}
                        </td>
                      )
                    })}
                    {/* Open detail & More menu */}
                    <td className="w-16 pr-2 align-middle">
                      <div className="flex items-center justify-end gap-1">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <button
                              type="button"
                              className="hidden rounded p-0.5 text-muted-foreground/40 transition-colors hover:text-foreground group-hover:inline-flex data-[state=open]:inline-flex data-[state=open]:bg-muted"
                              title="More actions"
                            >
                              <MoreVertical className="h-3.5 w-3.5" />
                            </button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-32">
                            {!task.processed && (
                              <DropdownMenuItem 
                                onClick={(e) => {
                                  e.stopPropagation()
                                  onToggleProcessed(task.id)
                                }}
                                className="text-xs"
                              >
                                <Check className="mr-2 h-3 w-3" />
                                Mark as processed
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuItem 
                              onClick={(e) => {
                                e.stopPropagation()
                                onToggleStatus(task.id)
                              }}
                              className="text-xs"
                            >
                              <Check className="mr-2 h-3 w-3" />
                              {task.status === "Done" ? "Mark as open" : "Mark as done"}
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={(e) => {
                                e.stopPropagation()
                                convertTaskType(task)
                              }}
                              className="text-xs"
                            >
                              <ArrowLeftRight className="mr-2 h-3 w-3" />
                              {task.type === "note" ? "Convert to task" : "Convert to note"}
                            </DropdownMenuItem>
                            <DropdownMenuItem 
                              onClick={(e) => {
                                e.stopPropagation()
                                onArchiveTask?.(task.id)
                              }}
                              className="text-xs"
                            >
                              <Archive className="mr-2 h-3 w-3" />
                              Archive
                            </DropdownMenuItem>
                            <DropdownMenuItem 
                              onClick={(e) => {
                                e.stopPropagation()
                                onDeleteTask?.(task.id)
                              }}
                              className="text-xs text-destructive focus:text-destructive"
                            >
                              <Trash2 className="mr-2 h-3 w-3" />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          </div>
        </>
      )}


      <TaskDetailDialog
        task={activeTask}
        open={activeTask !== null}
        onOpenChange={(o) => {
          if (!o) handleCloseTask()
        }}
        projects={projects}
        persons={persons}
        contexts={contexts}
        tags={tags}
        urgencies={urgencies}
        onUpdate={onUpdate}
        mode={detailMode}
        onModeChange={setDetailMode}
      />
    </div>
  )
}

interface CellContext {
  task: Task
  project?: Project
  person?: Person
  contexts: Context[]
  tags: Tag[]
  urgency?: UrgencyLevel
  onToggleProcessed: (id: string) => void
  onToggleStatus: (id: string) => void
  inboxMode: boolean
  onOpenView?: (id: string) => void
  onOpenEdit?: (id: string) => void
}

function renderCell(key: TaskColumnKey, ctx: CellContext) {
  const { task, project, person, contexts, tags, urgency, onToggleProcessed, onToggleStatus, inboxMode } = ctx

  switch (key) {
    case "status":
      return (
        <button
          type="button"
          className={cn(
            "mt-1 flex h-4.5 w-4.5 shrink-0 items-center justify-center rounded-full border transition-all md:h-4 md:w-4",
            inboxMode
              ? (task.processed
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-muted-foreground/40 hover:border-primary/60")
              : (task.status === "Done"
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-muted-foreground/40 hover:border-primary/60")
          )}
          onClick={(e) => {
            e.stopPropagation()
            if (inboxMode) {
              onToggleProcessed(task.id)
            } else {
              onToggleStatus(task.id)
            }
          }}
          aria-label={inboxMode ? "Mark as processed" : "Mark as done"}
        >
          {inboxMode ? (
            task.processed && <Check className="h-3 w-3 md:h-2.5 md:w-2.5" />
          ) : (
            task.status === "Done" && <Check className="h-3 w-3 md:h-2.5 md:w-2.5" />
          )}
        </button>
      )

    case "urgency":
      return urgency ? (
        <span
          className="inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-wider text-muted-foreground"
        >
          <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: urgency.color }} />
          {urgency.name}
        </span>
      ) : <Empty />

    case "description":
      return (
        <div className="group/desc relative flex items-center gap-2 w-full min-w-0 h-full min-h-[1.5rem]">
          <span
            className={cn(
              "truncate text-sm min-w-0",
              task.processed ? "text-muted-foreground" : "text-foreground",
            )}
          >
            {task.description === "New task" ? "" : task.description}
          </span>
          <div className="hidden group-hover/desc:flex items-center gap-1.5 shrink-0 bg-background/80 backdrop-blur-[2px] px-1 py-0.5 rounded border border-border/20 shadow-sm animate-fade-in">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                ctx.onOpenView?.(task.id)
              }}
              className="inline-flex items-center gap-1 rounded border border-primary/40 bg-primary/5 hover:bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary transition-colors cursor-pointer"
              title="View details"
            >
              <Eye className="h-3 w-3" />
              <span>View</span>
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                ctx.onOpenEdit?.(task.id)
              }}
              className="inline-flex items-center gap-1 rounded border border-primary/40 bg-primary/5 hover:bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary transition-colors cursor-pointer"
              title="Edit task"
            >
              <Pencil className="h-3 w-3" />
              <span>Edit</span>
            </button>
          </div>
        </div>
      )

    case "details":
      return task.details ? (
        <span className="block truncate text-xs text-muted-foreground">{task.details}</span>
      ) : (
        <Empty />
      )

    case "project":
      return project ? (
        <span className="inline-flex max-w-full items-center gap-1 rounded border border-border bg-background px-1.5 py-0.5 text-[11px] text-muted-foreground">
          <span className="truncate">{project.name}</span>
        </span>
      ) : (
        <Empty />
      )

    case "person": {
      const isProjectShared = !!(project && project.linked_person_id)
      return person ? (
        <div className="flex items-center gap-2">
          <div
            className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold text-foreground"
            style={{ backgroundColor: `color-mix(in oklch, ${person.color} 30%, transparent)` }}
          >
            {person.initials}
          </div>
          <span className="truncate text-xs text-foreground inline-flex items-center gap-1">
            {person.name}
            {isProjectShared && (
              <span title="Locked to shared project" className="inline-flex shrink-0">
                <Lock className="h-2.5 w-2.5 text-blue-500" />
              </span>
            )}
          </span>
        </div>
      ) : (
        <Empty />
      )
    }

    case "contexts":
      if (contexts.length === 0) return <Empty />
      if (contexts.length > 1) {
        return (
          <span className="inline-flex items-center gap-1 rounded border border-border bg-background px-1.5 py-0.5 text-[11px] text-muted-foreground">
            {contexts.length} selected
          </span>
        )
      }
      return (
        <div className="flex flex-wrap items-center gap-1">
          {contexts.map((c) => (
            <span
              key={c.id}
              className="inline-flex items-center gap-1 rounded border border-border bg-background px-1.5 py-0.5 text-[11px] text-muted-foreground"
            >
              <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: c.color }} />
              {c.name}
            </span>
          ))}
        </div>
      )

    case "tags":
      if (tags.length === 0) return <Empty />
      if (tags.length > 1) {
        return (
          <span className="inline-flex items-center gap-1 rounded border border-border bg-background px-1.5 py-0.5 text-[11px] text-muted-foreground">
            {tags.length} selected
          </span>
        )
      }
      return (
        <div className="flex flex-wrap items-center gap-1">
          {tags.map((tg) => (
            <span
              key={tg.id}
              className="inline-flex items-center gap-1 rounded border border-border bg-background px-1.5 py-0.5 text-[11px] text-muted-foreground"
            >
              <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: tg.color }} />
              {tg.name}
            </span>
          ))}
        </div>
      )

    case "show_on":
      return task.show_on ? <DateCell value={task.show_on} /> : <Empty />

    case "action_date":
      return task.action_date ? <DateCell value={task.action_date} /> : <Empty />

    case "date_created":
      return <DateCell value={task.date_created} />
  }
}

function DateCell({ value }: { value: string }) {
  // Use a safer way to parse YYYY-MM-DD to avoid timezone shifts
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})/)
  let d: Date
  if (match) {
    const [_, y, m, d_num] = match
    d = new Date(Number(y), Number(m) - 1, Number(d_num))
  } else {
    d = new Date(value)
  }

  return (
    <span className="inline-flex items-center gap-1 font-mono text-[11px] text-muted-foreground">
      <Calendar className="h-3 w-3" />
      {d.toLocaleDateString(undefined, { month: "short", day: "numeric" })}
    </span>
  )
}

interface InlineCellEditorProps {
  task: Task
  column: TaskColumnKey
  projects: Project[]
  persons: Person[]
  contexts: Context[]
  tags: Tag[]
  urgencies: UrgencyLevel[]
  onCommit: (value: string | string[] | null, close?: boolean) => void
  onCancel: () => void
  onTab: (reverse: boolean) => void
  onCtrlEnter?: () => void
}

function InlineCellEditor({ task, column, projects, persons, contexts, tags, urgencies, onCommit, onCancel, onTab, onCtrlEnter }: InlineCellEditorProps) {
  const shared = { onCommit, onCancel, onTab, onCtrlEnter }
  switch (column) {
    case "description":
      return <InlineTextEditor value={task.description === "New task" ? "" : task.description} {...shared} />
    case "details":
      return <InlineTextEditor value={task.details ?? ""} {...shared} />
    case "project":
      return <InlineSelectEditor
        options={projects.map((p) => ({ id: p.id, label: p.name }))}
        currentId={task.project_id ?? null}
        allowClear
        {...shared}
      />
    case "person":
      return <InlineSelectEditor
        options={persons.map((p) => ({ id: p.id, label: p.name, color: p.color }))}
        currentId={task.person_id ?? null}
        allowClear
        {...shared}
      />
    case "urgency":
      return <InlineSelectEditor
        options={urgencies.map((u) => ({ id: u.id, label: u.name, color: u.color }))}
        currentId={task.urgency_id ?? null}
        {...shared}
      />
    case "contexts":
      return <InlineMultiSelectEditor
        options={contexts.map((c) => ({ id: c.id, label: c.name, color: c.color }))}
        currentIds={task.context_ids ?? []}
        {...shared}
      />
    case "tags":
      return <InlineMultiSelectEditor
        options={tags.map((tg) => ({ id: tg.id, label: tg.name, color: tg.color }))}
        currentIds={task.tag_ids ?? []}
        {...shared}
      />
    case "show_on":
      return <InlineDateEditor value={task.show_on ?? null} {...shared} />
    case "action_date":
      return <InlineDateEditor value={task.action_date ?? null} {...shared} />
    default:
      return null
  }
}

function Empty() {
  return <div className="w-full text-center font-mono text-[11px] text-muted-foreground/40">—</div>
}

function MobileTaskRow({
  task,
  urgency,
  onToggleProcessed,
  onToggleStatus,
  onArchiveTask,
  onDeleteTask,
  onConvert,
  onClick,
  onEditClick,
  isSelected,
  onToggleSelection,
  inboxMode = false,
  notesMode = false,
}: {
  task: Task
  urgency?: UrgencyLevel
  onToggleProcessed: (id: string) => void
  onToggleStatus: (id: string) => void
  onArchiveTask?: (id: string) => void
  onDeleteTask?: (id: string) => void
  onConvert?: (task: Task) => void
  onClick: (task: Task) => void
  onEditClick?: (task: Task) => void
  isSelected: boolean
  onToggleSelection: () => void
  inboxMode?: boolean
  notesMode?: boolean
}) {
  const [longPressTriggered, setLongPressTriggered] = useState(false)
  const timerRef = useRef<NodeJS.Timeout | null>(null)

  const startPress = useCallback(() => {
    setLongPressTriggered(false)
    timerRef.current = setTimeout(() => {
      setLongPressTriggered(true)
      onToggleSelection()
      // Provide haptic feedback if available
      if (window.navigator && window.navigator.vibrate) {
        window.navigator.vibrate(50)
      }
    }, 500)
  }, [onToggleSelection])

  const endPress = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
  }, [])

  const [menuOpen, setMenuOpen] = useState(false)
  const touchStartY = useRef<number | null>(null)
  const isDragging = useRef(false)

  return (
    <div 
      className={cn(
        "relative flex min-h-[48px] items-center gap-3 rounded-xl border pl-4 pr-2.5 py-2 transition-all active:scale-[0.98] select-none shadow-sm",
        isSelected 
          ? "border-primary bg-primary/5 ring-1 ring-primary/20" 
          : "border-border/80 bg-card hover:border-border",
        task.status === "Done" ? "opacity-65 bg-muted/20" : ""
      )}
      onClick={(e) => {
        if (!longPressTriggered) {
          onClick(task)
        }
      }}
      onTouchStart={startPress}
      onTouchMove={endPress}
      onTouchEnd={endPress}
      onMouseDown={startPress}
      onMouseUp={endPress}
      onMouseLeave={endPress}
    >
      {/* Absolute Left Urgency Line Indicator */}
      {!notesMode && urgency && (
        <div 
          className="absolute left-0 top-0 bottom-0 w-[3.5px] rounded-l-xl"
          style={{ backgroundColor: urgency.color }}
        />
      )}

      {/* Note icon or checkbox status toggle (Left) */}
      {notesMode ? (
        <span className="shrink-0 text-muted-foreground">
          <FileText className="h-4.5 w-4.5" />
        </span>
      ) : (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            if (inboxMode) {
              onToggleProcessed(task.id)
            } else {
              onToggleStatus(task.id)
            }
          }}
          className="shrink-0 text-muted-foreground hover:text-primary transition-colors cursor-pointer"
          aria-label={inboxMode ? (task.processed ? "Mark as inbox" : "Mark as processed") : (task.status === "Done" ? "Mark as open" : "Mark as done")}
        >
          {inboxMode ? (
            task.processed ? (
              <CircleCheck className="h-4.5 w-4.5 text-primary" />
            ) : (
              <Circle className="h-4.5 w-4.5" />
            )
          ) : (
            task.status === "Done" ? (
              <CircleCheck className="h-4.5 w-4.5 text-primary" />
            ) : (
              <Circle className="h-4.5 w-4.5" />
            )
          )}
        </button>
      )}

      {/* Description - Condensation & Text Balance */}
      <span
        className={cn(
          "flex-1 min-w-0 truncate text-sm font-medium leading-tight",
          !notesMode && task.status === "Done" ? "text-muted-foreground line-through" : "text-foreground"
        )}
      >
        {task.description}
      </span>

      {/* Right side: Urgency label text + Option Trigger Menu */}
      <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
        {!notesMode && urgency && task.status !== "Done" && (
          <span 
            className="hidden sm:inline-block font-mono text-[9px] font-bold uppercase tracking-tight px-1.5 py-0.5 rounded-md"
            style={{ 
              backgroundColor: `color-mix(in oklch, ${urgency.color} 12%, transparent)`, 
              color: urgency.color 
            }}
          >
            {urgency.name}
          </span>
        )}

        <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
          <div
            onPointerDown={(e) => {
              touchStartY.current = e.clientY
              isDragging.current = false
            }}
            onPointerMove={(e) => {
              if (touchStartY.current !== null && Math.abs(e.clientY - touchStartY.current) > 8) {
                isDragging.current = true
              }
            }}
            onPointerUp={() => {
              if (!isDragging.current) {
                setMenuOpen((prev) => !prev)
              }
              touchStartY.current = null
            }}
          >
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted active:bg-muted data-[state=open]:bg-muted cursor-pointer"
                style={{ pointerEvents: 'none' }}
              >
                <MoreVertical className="h-4 w-4" />
              </button>
            </DropdownMenuTrigger>
          </div>
          <DropdownMenuContent align="end" className="w-64 p-1.5">
            <DropdownMenuLabel className="px-3 py-2 text-sm font-semibold">{notesMode ? "Note Actions" : "Task Actions"}</DropdownMenuLabel>
            <DropdownMenuSeparator />
            
            <DropdownMenuItem 
              className="py-3 px-3 text-[15px] font-medium cursor-pointer"
              onClick={() => onEditClick?.(task)}
            >
              <Pencil className="mr-3 h-5 w-5 shrink-0 text-muted-foreground" />
              <span>{notesMode ? "Edit Note" : "Edit Task"}</span>
            </DropdownMenuItem>

            {!notesMode && (
              <DropdownMenuItem 
                className="py-3 px-3 text-[15px] font-medium cursor-pointer"
                onClick={() => onToggleStatus(task.id)}
              >
                {task.status === "Done" ? (
                  <>
                    <RotateCcw className="mr-3 h-5 w-5 shrink-0 text-muted-foreground" />
                    <span>Mark as Open</span>
                  </>
                ) : (
                  <>
                    <CircleCheck className="mr-3 h-5 w-5 shrink-0 text-muted-foreground" />
                    <span>Mark as Done</span>
                  </>
                )}
              </DropdownMenuItem>
            )}

            {!notesMode && (
              task.processed ? (
                <DropdownMenuItem 
                  className="py-3 px-3 text-[15px] font-medium cursor-pointer"
                  onClick={() => onToggleProcessed(task.id)}
                >
                  <RotateCcw className="mr-3 h-5 w-5 shrink-0 text-muted-foreground" />
                  <span>Mark as Unprocessed</span>
                </DropdownMenuItem>
              ) : (
                <DropdownMenuItem 
                  className="py-3 px-3 text-[15px] font-medium cursor-pointer"
                  onClick={() => onToggleProcessed(task.id)}
                >
                  <CircleCheck className="mr-3 h-5 w-5 shrink-0 text-muted-foreground" />
                  <span>Mark as Processed</span>
                </DropdownMenuItem>
              )
            )}

            {onConvert && (
              <DropdownMenuItem
                className="py-3 px-3 text-[15px] font-medium cursor-pointer"
                onClick={() => onConvert(task)}
              >
                <ArrowLeftRight className="mr-3 h-5 w-5 shrink-0 text-muted-foreground" />
                <span>{notesMode ? "Convert to Task" : "Convert to Note"}</span>
              </DropdownMenuItem>
            )}

            {onArchiveTask && (
              <DropdownMenuItem 
                className="py-3 px-3 text-[15px] font-medium cursor-pointer"
                onClick={() => onArchiveTask(task.id)}
              >
                <Archive className="mr-3 h-5 w-5 shrink-0 text-muted-foreground" />
                <span>Archive</span>
              </DropdownMenuItem>
            )}

            <DropdownMenuSeparator />
            
            <DropdownMenuItem 
              className="py-3 px-3 text-[15px] font-medium cursor-pointer text-destructive focus:text-destructive"
              onClick={() => onDeleteTask?.(task.id)}
            >
              <Trash2 className="mr-3 h-5 w-5 shrink-0" />
              <span>Delete</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  )
}
