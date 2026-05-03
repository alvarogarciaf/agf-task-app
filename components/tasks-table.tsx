"use client"

import { useState, useRef, useCallback, useEffect } from "react"
import { Calendar, Circle, CircleCheck, Columns3, ExternalLink, GripVertical, RotateCcw, MoreVertical, Archive, Trash2 } from "lucide-react"
import { cn } from "@/lib/utils"
import {
  DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent,
  DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
  DropdownMenuPortal,
} from "@/components/ui/dropdown-menu"
import { useTableColumns } from "@/hooks/use-table-columns"
import { TaskDetailDialog } from "@/components/task-detail-dialog"
import { InlineTextEditor, InlineSelectEditor, InlineMultiSelectEditor } from "@/components/inline-cell-editors"
import type { Context, Person, Project, Task, UrgencyLevel } from "@/lib/types"

export type TaskColumnKey =
  | "status"
  | "urgency"
  | "description"
  | "details"
  | "project"
  | "person"
  | "contexts"
  | "show_on"
  | "action_date"
  | "date_created"

interface ColumnDef {
  key: TaskColumnKey
  label: string
  defaultVisible: boolean
}

const TASK_COLUMNS: ColumnDef[] = [
  { key: "status", label: "Status", defaultVisible: true },
  { key: "urgency", label: "Urgency", defaultVisible: true },
  { key: "description", label: "Description", defaultVisible: true },
  { key: "details", label: "Details", defaultVisible: false },
  { key: "project", label: "Project", defaultVisible: true },
  { key: "person", label: "Person", defaultVisible: true },
  { key: "contexts", label: "Contexts", defaultVisible: true },
  { key: "show_on", label: "Show on", defaultVisible: false },
  { key: "action_date", label: "Action date", defaultVisible: false },
  { key: "date_created", label: "Created", defaultVisible: true },
]

const COLUMN_MAP: Record<TaskColumnKey, ColumnDef> = TASK_COLUMNS.reduce(
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
  "description", "details", "project", "person", "contexts", "urgency",
])

interface TasksTableProps {
  tasks: Task[]
  projects: Project[]
  persons: Person[]
  contexts: Context[]
  urgencies: UrgencyLevel[]
  onToggleProcessed: (id: string) => void
  onUpdate: (task: Task) => void
  onArchiveTask?: (id: string) => void
  onDeleteTask?: (id: string) => void
  /** Columns that should never appear or be toggleable in this instance. */
  hideColumns?: TaskColumnKey[]
  /** Custom storage key when this instance should remember a separate column config. */
  storageKey?: string
  /** Optional custom empty state. */
  emptyTitle?: string
  emptyHint?: string
  /** Optional label for the row count in the toolbar (defaults to "tasks"). */
  itemNoun?: string
  inboxMode?: boolean
}

export function TasksTable({
  tasks,
  projects,
  persons,
  contexts,
  urgencies,
  onToggleProcessed,
  onUpdate,
  onArchiveTask,
  onDeleteTask,
  hideColumns,
  storageKey = "velocity:tasks-table:columns",
  emptyTitle = "No tasks match these filters",
  emptyHint = "Try clearing one or capturing a new task.",
  itemNoun = "task",
  inboxMode = false,
}: TasksTableProps) {
  const { order, visibility, toggle, reorder, reset } = useTableColumns<TaskColumnKey>(
    storageKey, DEFAULT_ORDER, DEFAULT_VISIBILITY,
  )
  const [dragKey, setDragKey] = useState<TaskColumnKey | null>(null)
  const [dropTarget, setDropTarget] = useState<TaskColumnKey | null>(null)
  const [activeTaskId, setActiveTaskId] = useState<string | null>(null)
  const [selectedCell, setSelectedCell] = useState<{ taskId: string; column: TaskColumnKey } | null>(null)
  const [isEditing, setIsEditing] = useState(false)
  const cellRefs = useRef<Record<string, HTMLTableCellElement | null>>({})

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

  const activeTask = activeTaskId ? tasks.find((t) => t.id === activeTaskId) ?? null : null

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
    if (Object.keys(patch).length) onUpdate({ id: task.id, ...patch } as Task)
    if (close) {
      setIsEditing(false)
    }
  }

  return (
    <div className="overflow-hidden rounded-lg border border-border bg-card">
      {/* Toolbar */}
      <div className="hidden md:flex items-center justify-between border-b border-border px-3 py-2">
        <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
          {tasks.length} {tasks.length === 1 ? itemNoun : `${itemNoun}s`}
        </span>

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
      </div>

      {/* Table */}
      {tasks.length === 0 ? (
        <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
          <p className="text-sm font-medium">{emptyTitle}</p>
          <p className="mt-1 text-xs text-muted-foreground">{emptyHint}</p>
        </div>
      ) : (
        <>
          <div className="md:hidden flex flex-col divide-y divide-border">
            {tasks.map((task) => {
              const urgency = urgencies?.find((u) => u.id === task.urgency_id)
              return (
                <MobileSwipeTask
                  key={task.id}
                  task={task}
                  urgency={urgency}
                  onToggleProcessed={onToggleProcessed}
                  onClick={(t) => setActiveTaskId(t.id)}
                />
              )
            })}
          </div>
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full border-collapse text-sm">
            <thead className="sticky top-0 z-10 bg-card">
              <tr className="border-b border-border">
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
                      className={cn(
                        "relative px-3 py-2 text-left font-mono text-[10px] font-medium uppercase tracking-wider text-muted-foreground transition-colors",
                        COLUMN_HEADER_CLASSES[key],
                        isDragging && "opacity-40",
                        isDropTarget && "bg-primary/10",
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
                          "group/handle inline-flex cursor-grab select-none items-center gap-1 active:cursor-grabbing",
                          isDragging && "cursor-grabbing",
                        )}
                        title="Drag to reorder"
                      >
                        <GripVertical
                          className="h-3 w-3 opacity-0 transition-opacity group-hover/handle:opacity-100"
                          aria-hidden
                        />
                        <span>{label}</span>
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
                const urgency = urgencies.find((u) => u.id === task.urgency_id)
                return (
                  <tr
                    key={task.id}
                    className="group border-b border-border/60 last:border-b-0 transition-colors hover:bg-muted/30"
                  >
                    {visibleColumns.map((key) => {
                      const isSelected = selectedCell?.taskId === task.id && selectedCell?.column === key
                      const isEditingThis = isSelected && isEditing
                      const isEditable = EDITABLE_COLUMNS.has(key)
                      return (
                        <td
                          key={key}
                          ref={(el) => {
                            cellRefs.current[`${task.id}-${key}`] = el
                          }}
                          tabIndex={isEditable ? 0 : -1}
                          onFocus={() => {
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
                            if (!isEditable) return
                            e.stopPropagation()
                            if (!isSelected) {
                              setSelectedCell({ taskId: task.id, column: key })
                              setIsEditing(false)
                            }
                          }}
                          onDoubleClick={(e) => {
                            if (!isEditable) return
                            e.stopPropagation()
                            setSelectedCell({ taskId: task.id, column: key })
                            setIsEditing(true)
                          }}
                        >
                          {isEditingThis ? (
                            <InlineCellEditor
                              task={task}
                              column={key}
                              projects={projects}
                              persons={persons}
                              contexts={contexts}
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
                            renderCell(key, { task, project, person, contexts: tCtx, urgency, onToggleProcessed })
                          )}
                        </td>
                      )
                    })}
                    {/* Open detail & More menu */}
                    <td className="w-16 pr-2 align-middle">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          type="button"
                          onClick={() => setActiveTaskId(task.id)}
                          className="hidden rounded p-0.5 text-muted-foreground/40 transition-colors hover:text-foreground group-hover:inline-flex"
                          title="Open detail"
                        >
                          <ExternalLink className="h-3.5 w-3.5" />
                        </button>
                        
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <button
                              type="button"
                              onClick={(e) => e.stopPropagation()}
                              className="hidden rounded p-0.5 text-muted-foreground/40 transition-colors hover:text-foreground group-hover:inline-flex"
                              title="More actions"
                            >
                              <MoreVertical className="h-3.5 w-3.5" />
                            </button>
                          </DropdownMenuTrigger>
                          <DropdownMenuPortal>
                            <DropdownMenuContent align="end" className="w-32">
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
                          </DropdownMenuPortal>
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
          if (!o) setActiveTaskId(null)
        }}
        projects={projects}
        persons={persons}
        contexts={contexts}
        urgencies={urgencies}
        onUpdate={onUpdate}
      />
    </div>
  )
}

interface CellContext {
  task: Task
  project?: Project
  person?: Person
  contexts: Context[]
  urgency?: UrgencyLevel
  onToggleProcessed: (id: string) => void
}

function renderCell(key: TaskColumnKey, ctx: CellContext) {
  const { task, project, person, contexts, urgency, onToggleProcessed } = ctx

  switch (key) {
    case "status":
      return (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            onToggleProcessed(task.id)
          }}
          className="text-muted-foreground transition-colors hover:text-primary"
          aria-label={task.processed ? "Mark as inbox" : "Mark as processed"}
        >
          {task.processed ? (
            <CircleCheck className="h-4 w-4 text-primary" />
          ) : (
            <Circle className="h-4 w-4" />
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
        <span
          className={cn(
            "block truncate text-sm",
            task.processed ? "text-muted-foreground" : "text-foreground",
          )}
        >
          {task.description}
        </span>
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

    case "person":
      return person ? (
        <div className="flex items-center gap-2">
          <div
            className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold text-foreground"
            style={{ backgroundColor: `color-mix(in oklch, ${person.color} 30%, transparent)` }}
          >
            {person.initials}
          </div>
          <span className="truncate text-xs text-foreground">{person.name}</span>
        </div>
      ) : (
        <Empty />
      )

    case "contexts":
      return contexts.length > 0 ? (
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
      ) : (
        <Empty />
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
  const d = new Date(value)
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
  urgencies: UrgencyLevel[]
  onCommit: (value: string | string[] | null, close?: boolean) => void
  onCancel: () => void
  onTab: (reverse: boolean) => void
  onCtrlEnter?: () => void
}

function InlineCellEditor({ task, column, projects, persons, contexts, urgencies, onCommit, onCancel, onTab, onCtrlEnter }: InlineCellEditorProps) {
  const shared = { onCommit, onCancel, onTab, onCtrlEnter }
  switch (column) {
    case "description":
      return <InlineTextEditor value={task.description} {...shared} />
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
    default:
      return null
  }
}

function Empty() {
  return <span className="font-mono text-[11px] text-muted-foreground/40">—</span>
}

function MobileSwipeTask({
  task,
  urgency,
  onToggleProcessed,
  onClick,
}: {
  task: Task
  urgency?: UrgencyLevel
  onToggleProcessed: (id: string) => void
  onClick: (task: Task) => void
}) {
  const [offset, setOffset] = useState(0)
  const [isDragging, setIsDragging] = useState(false)
  const startX = useRef(0)
  const currentX = useRef(0)

  function handleTouchStart(e: React.TouchEvent) {
    startX.current = e.touches[0].clientX
    currentX.current = e.touches[0].clientX
    setIsDragging(true)
  }

  function handleTouchMove(e: React.TouchEvent) {
    if (!isDragging) return
    const x = e.touches[0].clientX
    currentX.current = x
    const diff = x - startX.current
    // Only allow swiping right (to complete)
    if (diff > 0) {
      setOffset(diff)
      // Note: touch-pan-y in className handles preventing vertical scroll interference
    }
  }

  function handleTouchEnd() {
    setIsDragging(false)
    const diff = currentX.current - startX.current
    if (diff > 80) {
      // Trigger action
      onToggleProcessed(task.id)
      setOffset(0)
    } else {
      setOffset(0)
      if (Math.abs(diff) < 5) {
        onClick(task)
      }
    }
  }

  return (
    <div className="relative overflow-hidden bg-primary/20">
      {/* Background action */}
      <div
        className={cn(
          "absolute inset-y-0 left-0 flex items-center px-6 transition-colors duration-200",
          offset > 80 ? "text-primary" : "text-primary/50"
        )}
      >
        <CircleCheck className="h-6 w-6" />
      </div>

      {/* Foreground Task Card */}
      <div
        className={cn(
          "relative flex items-center gap-3 bg-card px-5 py-4 touch-pan-y",
          !isDragging && "transition-transform duration-200"
        )}
        style={{ transform: `translateX(${offset}px)` }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {urgency ? (
          <span
            className="h-2.5 w-2.5 shrink-0 rounded-full"
            style={{ backgroundColor: urgency.color }}
          />
        ) : (
          <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-muted-foreground/40" />
        )}
        <span
          className={cn(
            "flex-1 truncate text-base",
            task.processed ? "text-muted-foreground line-through" : "text-foreground"
          )}
        >
          {task.description}
        </span>
      </div>
    </div>
  )
}
