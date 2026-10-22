"use client"

import React, { useState, useEffect, useRef, useMemo, useCallback } from "react"

import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  TouchSensor,
} from "@dnd-kit/core"
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  rectSortingStrategy,
  verticalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import {
  GripVertical,
  ArrowLeft,
  FolderKanban,
  FileText,
  ListChecks,
  Circle,
  Dot,
  Plus,
  Trash2,
  StickyNote,
  Pencil,
  LayoutGrid,
  List,
  Image as ImageIcon,
  Loader2,
  Star,
  Search,
  Archive,
  CheckCircle2,
  MoreVertical,
  Edit2,
  ArrowUpRight,
  X,
  Columns3,
  RotateCcw,
  ListOrdered,
} from "lucide-react"
import { MobileOverrideProvider, useIsMobile } from "@/hooks/use-mobile"
import { useTableColumns } from "@/hooks/use-table-columns"
import { cn } from "@/lib/utils"
import { useDatabase } from "@/components/db-provider"
import { FilteredTasks } from "@/components/filtered-tasks"
import { FormMultiSelect } from "@/components/form-multi-select"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Switch } from "@/components/ui/switch"
import { Button } from "@/components/ui/button"
import { ICONS, COLOR_PALETTE } from "@/lib/constants"
import { IconPicker } from "@/components/icon-picker"
import type { Context, Person, Project, Tag, Task, UrgencyLevel, ProjectStatus } from "@/lib/types"
import { uploadImage } from "@/lib/image-upload"
import { usePreloadProjectImages, preloadImage } from "@/lib/image-cache"
import { toast } from "sonner"

const DEFAULT_PROJECT_ICON = "Layers"

export type ProjectColumnKey =
  | "name"
  | "status"
  | "tasks"
  | "notes"
  | "person"
  | "contexts"
  | "order_dependent"
  | "details"

interface ProjectColumnDef {
  key: ProjectColumnKey
  label: string
  defaultVisible: boolean
}

export const PROJECT_COLUMNS: ProjectColumnDef[] = [
  { key: "name", label: "Project", defaultVisible: true },
  { key: "status", label: "Status", defaultVisible: true },
  { key: "tasks", label: "Tasks", defaultVisible: true },
  { key: "notes", label: "Notes", defaultVisible: true },
  { key: "person", label: "Person", defaultVisible: true },
  { key: "contexts", label: "Contexts", defaultVisible: true },
  { key: "order_dependent", label: "Order", defaultVisible: false },
  { key: "details", label: "Details", defaultVisible: true },
]

const PROJECT_COLUMN_MAP: Record<ProjectColumnKey, ProjectColumnDef> = PROJECT_COLUMNS.reduce(
  (acc, col) => {
    acc[col.key] = col
    return acc
  },
  {} as Record<ProjectColumnKey, ProjectColumnDef>,
)

const DEFAULT_PROJECT_COL_ORDER: ProjectColumnKey[] = PROJECT_COLUMNS.map((c) => c.key)
const DEFAULT_PROJECT_COL_VISIBILITY: Record<ProjectColumnKey, boolean> = PROJECT_COLUMNS.reduce(
  (acc, c) => {
    acc[c.key] = c.defaultVisible
    return acc
  },
  {} as Record<ProjectColumnKey, boolean>,
)

const PROJECT_COL_HEADER_CLASSES: Record<ProjectColumnKey, string> = {
  name: "min-w-[220px] max-w-[340px]",
  status: "w-28 whitespace-nowrap",
  tasks: "w-44 whitespace-nowrap",
  notes: "w-24 whitespace-nowrap text-center",
  person: "w-36 whitespace-nowrap",
  contexts: "min-w-[140px] max-w-[220px]",
  order_dependent: "w-28 whitespace-nowrap",
  details: "min-w-[180px] max-w-[320px]",
}

interface ProjectsViewProps {
  projects: Project[]
  tasks: Task[]
  notes?: Task[]
  persons: Person[]
  contexts: Context[]
  tags?: Tag[]
  urgencies: UrgencyLevel[]
  onToggleProcessed: (id: string) => void
  onToggleStatus: (id: string) => void
  onUpdate: (task: Task) => void
  onArchiveTask?: (id: string) => void
  onDeleteTask?: (id: string) => void
  onDeleteTasks?: (ids: string[]) => void
  onCreate?: (input: {
    description: string
    contextIds: string[]
    projectId: string | null
    personId: string | null
    processed: boolean
  }) => Promise<string | void>
  onCreateNote?: (input: {
    description: string
    contextIds: string[]
    projectId: string | null
    personId: string | null
    processed: boolean
  }) => Promise<string | void>
  onAddProject: (project: Omit<Project, "id">) => void
  onUpdateProject: (project: Project) => void
  onDeleteProject: (id: string) => void
  onReorderProjects?: (activeId: string, overId: string) => void
  initialSelectedId?: string
  onSelect?: (id: string | null) => void
  initialTab?: "tasks" | "notes" | "description"
}

function SortableProjectItem(props: any) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: props.id })
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : undefined,
    position: "relative" as const,
    zIndex: isDragging ? 1 : 0,
  }

  const { viewMode } = props
  let children = props.children

  if (viewMode === "list") {
    let insertedHandle = false
    children = React.Children.map(props.children, (child) => {
      if (!insertedHandle && React.isValidElement(child)) {
        const cls = String((child.props as any)?.className || "")
        if (!cls.includes("absolute")) {
          insertedHandle = true
          return React.cloneElement(child as any, {
            children: (
              <div className="flex items-center gap-1 w-full">
                <div
                  {...attributes}
                  {...listeners}
                  onClick={(e) => e.stopPropagation()}
                  className="cursor-grab active:cursor-grabbing text-muted-foreground/30 hover:text-muted-foreground p-1 shrink-0 touch-none"
                >
                  <GripVertical className="h-4 w-4" />
                </div>
                {(child as any).props.children}
              </div>
            ),
          })
        }
      }
      return child
    })
  }

  const bindProps = viewMode === "grid" ? { ...attributes, ...listeners } : {}

  return (
    <div ref={setNodeRef} style={style} className={props.className} onClick={props.onClick} {...bindProps}>
      {children}
    </div>
  )
}

function SortableProjectTableRow({
  id,
  className,
  onClick,
  showDragHandle = true,
  children,
}: {
  id: string
  className?: string
  onClick?: () => void
  showDragHandle?: boolean
  children: (dragHandleProps: { attributes: any; listeners: any }) => React.ReactNode
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id,
    disabled: !showDragHandle,
  })
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.45 : undefined,
    position: "relative" as const,
    zIndex: isDragging ? 10 : 0,
  }

  return (
    <tr ref={setNodeRef} style={style} className={className} onClick={onClick}>
      {children({ attributes, listeners })}
    </tr>
  )
}

export function ProjectsView({
  projects,
  tasks,
  notes = [],
  persons,
  contexts,
  tags = [],
  urgencies,
  onToggleProcessed,
  onToggleStatus,
  onUpdate,
  onArchiveTask,
  onDeleteTask,
  onDeleteTasks,
  onCreate,
  onCreateNote,
  onAddProject,
  onUpdateProject,
  onDeleteProject,
  onReorderProjects,
  initialSelectedId,
  onSelect,
  initialTab,
}: ProjectsViewProps) {
  const db = useDatabase()
  const [selected, setSelected] = useState<string | null>(initialSelectedId || null)
  const [previewProjectId, setPreviewProjectId] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState<"Ongoing" | "Closed" | "All">("Ongoing")
  const [viewMode, setViewMode] = useState<"list" | "grid">("list")
  const [editorOpen, setEditorOpen] = useState(false)
  const [editingProject, setEditingProject] = useState<Project | null>(null)
  const isMobile = useIsMobile()

  // Column state for the desktop Projects Table
  const columnState = useTableColumns<ProjectColumnKey>(
    "velocity:projects-table:columns",
    DEFAULT_PROJECT_COL_ORDER,
    DEFAULT_PROJECT_COL_VISIBILITY,
  )
  const visibleColumns = useMemo(
    () => columnState.order.filter((k) => columnState.visibility[k]),
    [columnState.order, columnState.visibility],
  )

  // Optional table sort (null = manual drag-and-drop order)
  const [sortConfig, setSortConfig] = useState<{ key: ProjectColumnKey; direction: "asc" | "desc" } | null>(null)
  const [dragColKey, setDragColKey] = useState<ProjectColumnKey | null>(null)
  const [dropColTarget, setDropColTarget] = useState<ProjectColumnKey | null>(null)

  const handleSortColumn = (key: ProjectColumnKey) => {
    setSortConfig((prev) => {
      if (!prev || prev.key !== key) return { key, direction: "asc" }
      if (prev.direction === "asc") return { key, direction: "desc" }
      return null // third click returns to manual drag order
    })
  }

  // Resizable sidepanel width (persisted)
  const [previewWidth, setPreviewWidth] = useState<number>(480)
  const [isResizingPreview, setIsResizingPreview] = useState(false)
  const splitContainerRef = useRef<HTMLDivElement>(null)
  const leftPaneRef = useRef<HTMLDivElement>(null)
  const [leftPaneMeasuredWidth, setLeftPaneMeasuredWidth] = useState<number>(1024)
  const previewPanelRef = useRef<HTMLDivElement>(null)
  const [previewPanelMeasuredWidth, setPreviewPanelMeasuredWidth] = useState<number>(480)

  const isLeftPaneMobile = isMobile || leftPaneMeasuredWidth < 768

  useEffect(() => {
    const saved = localStorage.getItem("projects_view_mode")
    if (saved === "grid" || saved === "list") {
      setViewMode(saved)
    }
    const savedWidth = localStorage.getItem("velocity:project-preview:width")
    if (savedWidth) {
      const parsed = parseInt(savedWidth, 10)
      if (!isNaN(parsed) && parsed >= 320 && parsed <= 1400) {
        setPreviewWidth(parsed)
        setPreviewPanelMeasuredWidth(parsed)
      }
    }
  }, [])

  // Observe the rendered width of the left pane so the Projects Table switches
  // responsively to the mobile projects list when narrowed (by resizing the
  // preview sidepanel or the browser window).
  useEffect(() => {
    const el = leftPaneRef.current
    if (!el) return
    setLeftPaneMeasuredWidth(el.clientWidth || 1024)
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setLeftPaneMeasuredWidth(entry.contentRect.width)
      }
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [selected])

  // Observe the actual rendered width of the preview sidepanel so it switches
  // between mobile (<768px) and desktop (>=768px) layouts responsively!
  useEffect(() => {
    const el = previewPanelRef.current
    if (!el) return
    setPreviewPanelMeasuredWidth(el.clientWidth || previewWidth)
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setPreviewPanelMeasuredWidth(entry.contentRect.width)
      }
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [previewProjectId, previewWidth])

  // Close preview panel on Escape when no modal/dialog is open
  useEffect(() => {
    if (!previewProjectId || selected) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        // Don't close if a radix dialog, popover, or dropdown menu is open
        if (document.querySelector('[role="dialog"], [data-radix-popper-content-wrapper]')) {
          return
        }
        setPreviewProjectId(null)
      }
    }
    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [previewProjectId, selected])

  const startResizingPreview = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    setIsResizingPreview(true)

    const onMouseMove = (moveEvent: MouseEvent) => {
      const container = splitContainerRef.current
      if (!container) return
      const rect = container.getBoundingClientRect()
      const newWidth = Math.round(rect.right - moveEvent.clientX)
      const minW = 340
      const maxW = Math.max(minW, Math.round(rect.width * 0.82))
      const clamped = Math.min(maxW, Math.max(minW, newWidth))
      setPreviewWidth(clamped)
    }

    const onMouseUp = () => {
      setIsResizingPreview(false)
      window.removeEventListener("mousemove", onMouseMove)
      window.removeEventListener("mouseup", onMouseUp)
      document.body.style.cursor = ""
      document.body.style.userSelect = ""
    }

    document.body.style.cursor = "col-resize"
    document.body.style.userSelect = "none"
    window.addEventListener("mousemove", onMouseMove)
    window.addEventListener("mouseup", onMouseUp)
  }, [])

  useEffect(() => {
    if (!isResizingPreview) {
      try {
        localStorage.setItem("velocity:project-preview:width", String(previewWidth))
      } catch {}
    }
  }, [isResizingPreview, previewWidth])

  const handleViewModeChange = (mode: "list" | "grid") => {
    setViewMode(mode)
    localStorage.setItem("projects_view_mode", mode)
  }

  useEffect(() => {
    setSelected(initialSelectedId || null)
  }, [initialSelectedId])

  const handleSelect = (id: string | null) => {
    setSelected(id)
    if (id) setPreviewProjectId(null)
    onSelect?.(id)
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search)
      if (id) {
        params.set("project", id)
      } else {
        params.delete("project")
      }
      const qs = params.toString()
      const newUrl = qs ? `${window.location.pathname}?${qs}` : window.location.pathname
      const currentIdx = typeof window.history.state?.idx === "number" ? window.history.state.idx : 0
      const nextIdx = currentIdx + 1
      window.history.pushState({ idx: nextIdx }, "", newUrl)
      window.dispatchEvent(new CustomEvent("app-history-change", { detail: { idx: nextIdx } }))
    }
  }

  const handleSaveProject = (p: Project | Omit<Project, "id">) => {
    if ("id" in p) {
      onUpdateProject(p as Project)
    } else {
      onAddProject(p as Omit<Project, "id">)
    }
    setEditorOpen(false)
    setEditingProject(null)
  }

  const [optimisticProjects, setOptimisticProjects] = useState(projects)
  usePreloadProjectImages(optimisticProjects)

  useEffect(() => {
    setOptimisticProjects(projects)
  }, [projects])

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    if (over && active.id !== over.id) {
      setOptimisticProjects((prev) => {
        const sorted = [...prev].sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
        const oldIndex = sorted.findIndex((p) => p.id === active.id)
        const newIndex = sorted.findIndex((p) => p.id === over.id)
        return arrayMove(sorted, oldIndex, newIndex).map((p, i) => ({ ...p, order: i }))
      })
      onReorderProjects?.(active.id as string, over.id as string)
    }
  }

  const filtered = useMemo(() => {
    const base = optimisticProjects
      .filter((p) => statusFilter === "All" || p.status === statusFilter)
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))

    if (!sortConfig) return base

    const { key, direction } = sortConfig
    const dir = direction === "asc" ? 1 : -1

    return [...base].sort((a, b) => {
      switch (key) {
        case "name":
          return a.name.localeCompare(b.name) * dir
        case "status":
          return a.status.localeCompare(b.status) * dir
        case "tasks": {
          const openA = tasks.filter((t) => t.project_id === a.id && t.processed && t.status === "Open").length
          const openB = tasks.filter((t) => t.project_id === b.id && t.processed && t.status === "Open").length
          return (openA - openB) * dir
        }
        case "notes": {
          const notesA = notes.filter((n) => n.project_id === a.id).length
          const notesB = notes.filter((n) => n.project_id === b.id).length
          return (notesA - notesB) * dir
        }
        case "person": {
          const pA = persons.find((per) => per.id === a.linked_person_id)?.name ?? ""
          const pB = persons.find((per) => per.id === b.linked_person_id)?.name ?? ""
          return pA.localeCompare(pB) * dir
        }
        case "contexts": {
          const cA = (a.default_context_ids || []).length
          const cB = (b.default_context_ids || []).length
          return (cA - cB) * dir
        }
        case "order_dependent":
          return ((a.order_dependent ? 1 : 0) - (b.order_dependent ? 1 : 0)) * dir
        case "details":
          return (a.details ?? "").localeCompare(b.details ?? "") * dir
        default:
          return 0
      }
    })
  }, [optimisticProjects, statusFilter, sortConfig, tasks, notes, persons])

  const previewProject = useMemo(
    () => (previewProjectId ? projects.find((p) => p.id === previewProjectId) ?? null : null),
    [projects, previewProjectId],
  )

  const handleAddToViews = async (p: Project) => {
    if (!db) return
    const existing = await db.saved_views.find().exec()
    const maxOrder = existing.reduce((max, v) => Math.max(max, v.order || 0), -1)
    await db.saved_views.insert({
      id: crypto.randomUUID(),
      name: p.name,
      icon: p.icon || "FolderKanban",
      color: p.color || "",
      context_ids: [],
      project_id: p.id,
      show_status: "open",
      is_grouped_by_project: false,
      show_hidden_by_show_on: false,
      sort_key: "date_created",
      sort_direction: "desc",
      filter_mode: "and",
      date_created: new Date().toISOString(),
      order: maxOrder + 1,
    })
    toast.success("Added to Views")
  }

  const renderProjectActionsMenu = (p: Project, triggerClassName: string) => {
    const hasItems =
      tasks.some((t) => t.project_id === p.id) || notes.some((n) => n.project_id === p.id)
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            onClick={(e) => e.stopPropagation()}
            className={triggerClassName}
            aria-label={`Options for ${p.name}`}
          >
            <MoreVertical className="h-3.5 w-3.5" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-44" onClick={(e) => e.stopPropagation()}>
          <DropdownMenuItem
            onClick={() => {
              handleSelect(p.id)
            }}
          >
            <ArrowUpRight className="h-3.5 w-3.5 mr-2" />
            Open Project
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => {
              setEditingProject(p)
              setEditorOpen(true)
            }}
          >
            <Edit2 className="h-3.5 w-3.5 mr-2" />
            Edit
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => handleAddToViews(p)}>
            <Star className="h-3.5 w-3.5 mr-2" />
            Add to Views
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => {
              onUpdateProject({
                ...p,
                status: p.status === "Ongoing" ? "Closed" : "Ongoing",
              })
            }}
          >
            {p.status === "Ongoing" ? (
              <Archive className="h-3.5 w-3.5 mr-2" />
            ) : (
              <CheckCircle2 className="h-3.5 w-3.5 mr-2" />
            )}
            {p.status === "Ongoing" ? "Close Project" : "Reopen Project"}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            className={cn(
              "text-destructive focus:text-destructive",
              hasItems && "opacity-40 pointer-events-none",
            )}
            disabled={hasItems}
            onClick={() => {
              if (confirm(`Are you sure you want to delete "${p.name}"?`)) {
                if (previewProjectId === p.id) setPreviewProjectId(null)
                onDeleteProject(p.id)
              }
            }}
          >
            <Trash2 className="h-3.5 w-3.5 mr-2" />
            Delete
            {hasItems && (
              <span className="ml-auto text-xs text-muted-foreground font-normal">Has items</span>
            )}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    )
  }

  const renderProjectTableCell = (p: Project, colKey: ProjectColumnKey) => {
    const projTasks = tasks.filter((t) => t.project_id === p.id && t.processed)
    const openCount = projTasks.filter((t) => t.status === "Open").length
    const doneCount = projTasks.filter((t) => t.status === "Done").length
    const totalCount = projTasks.length
    const pct = totalCount === 0 ? 0 : Math.round((doneCount / totalCount) * 100)
    const projNotesCount = notes.filter((n) => n.project_id === p.id).length
    const ProjIcon = p.icon ? ICONS[p.icon] ?? FolderKanban : FolderKanban
    const linkedPerson = p.linked_person_id
      ? persons.find((per) => per.id === p.linked_person_id)
      : null
    const projContexts = contexts.filter((c) => (p.default_context_ids || []).includes(c.id))

    switch (colKey) {
      case "name":
        return (
          <div className="group/desc relative flex items-center gap-2.5 w-full min-w-0 h-full min-h-[1.75rem]">
            <div
              className={cn(
                "flex h-6 w-6 shrink-0 items-center justify-center rounded-md",
                !p.color && "bg-primary/15 text-primary",
              )}
              style={
                p.color
                  ? {
                      backgroundColor: `color-mix(in oklch, ${p.color} 15%, transparent)`,
                      color: p.color,
                      boxShadow: `inset 0 0 0 1px color-mix(in oklch, ${p.color} 30%, transparent)`,
                    }
                  : undefined
              }
            >
              <ProjIcon className="h-3.5 w-3.5" />
            </div>
            <span className="truncate text-sm font-medium text-foreground min-w-0">
              {p.name}
            </span>
            {/* Hover "Open" button identical to TasksTable */}
            <div
              className="hidden group-hover/row:flex absolute right-0 top-1/2 -translate-y-1/2 items-center gap-1.5 shrink-0 bg-background/90 backdrop-blur-sm pl-4 pr-1 py-1 rounded-l-md animate-fade-in z-10"
              style={{
                backgroundImage: "linear-gradient(to right, transparent, var(--background) 20%)",
              }}
            >
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  handleSelect(p.id)
                }}
                className="inline-flex items-center gap-1 rounded border border-primary/40 bg-primary/5 hover:bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary transition-colors cursor-pointer"
                title="Open project"
              >
                <ArrowUpRight className="h-3.5 w-3.5" />
                <span>Open</span>
              </button>
            </div>
          </div>
        )

      case "status":
        return (
          <span
            className={cn(
              "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-mono uppercase tracking-wider",
              p.status === "Ongoing"
                ? "border-primary/30 bg-primary/10 text-primary"
                : "border-border bg-muted/40 text-muted-foreground",
            )}
          >
            <span
              className={cn(
                "h-1.5 w-1.5 rounded-full",
                p.status === "Ongoing" ? "bg-primary" : "bg-muted-foreground",
              )}
            />
            {p.status}
          </span>
        )

      case "tasks":
        return (
          <div className="flex items-center gap-2.5 min-w-[140px]">
            <div className="flex items-center gap-1.5 text-xs font-mono tabular-nums text-muted-foreground">
              <span className={cn(openCount > 0 && "text-foreground font-medium")}>
                {openCount} open
              </span>
              <span className="text-muted-foreground/40">·</span>
              <span>{doneCount} done</span>
            </div>
            {totalCount > 0 && (
              <div className="flex items-center gap-1.5 ml-auto">
                <div className="h-1.5 w-12 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-primary transition-all"
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <span className="font-mono text-[11px] tabular-nums text-muted-foreground w-7 text-right">
                  {pct}%
                </span>
              </div>
            )}
          </div>
        )

      case "notes":
        return projNotesCount > 0 ? (
          <div className="flex items-center justify-center">
            <span className="inline-flex items-center gap-1 rounded-md bg-muted/60 px-2 py-0.5 font-mono text-xs tabular-nums text-foreground">
              <StickyNote className="h-3 w-3 text-muted-foreground" />
              {projNotesCount}
            </span>
          </div>
        ) : (
          <div className="w-full text-center font-mono text-xs text-muted-foreground/40">—</div>
        )

      case "person":
        return linkedPerson ? (
          <span className="inline-flex items-center gap-1.5 text-xs">
            <span
              className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full font-mono text-[10px] font-semibold"
              style={{
                backgroundColor: `color-mix(in oklch, ${linkedPerson.color} 22%, transparent)`,
                color: linkedPerson.color,
                boxShadow: `inset 0 0 0 1px color-mix(in oklch, ${linkedPerson.color} 40%, transparent)`,
              }}
            >
              {linkedPerson.initials}
            </span>
            <span className="truncate text-foreground">{linkedPerson.name}</span>
          </span>
        ) : (
          <div className="w-full text-left font-mono text-xs text-muted-foreground/40">—</div>
        )

      case "contexts":
        return projContexts.length > 0 ? (
          <div className="flex flex-wrap items-center gap-1">
            {projContexts.map((c) => {
              const CIcon = ICONS[c.icon]
              return (
                <span
                  key={c.id}
                  className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium leading-none"
                  style={{
                    backgroundColor: `color-mix(in oklch, ${c.color} 12%, transparent)`,
                    color: c.color,
                    borderColor: `color-mix(in oklch, ${c.color} 30%, transparent)`,
                  }}
                >
                  {CIcon && <CIcon className="h-2.5 w-2.5 shrink-0" />}
                  <span className="truncate max-w-[90px]">{c.name}</span>
                </span>
              )
            })}
          </div>
        ) : (
          <div className="w-full text-left font-mono text-xs text-muted-foreground/40">—</div>
        )

      case "order_dependent":
        return p.order_dependent ? (
          <span className="inline-flex items-center gap-1 rounded-md border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 font-mono text-[11px] text-amber-500">
            <ListOrdered className="h-3 w-3" />
            Sequential
          </span>
        ) : (
          <span className="font-mono text-xs text-muted-foreground/50">Parallel</span>
        )

      case "details":
        return p.details ? (
          <span className="block truncate text-xs text-muted-foreground max-w-[300px]">
            {p.details}
          </span>
        ) : (
          <div className="w-full text-left font-mono text-xs text-muted-foreground/40">—</div>
        )
    }
  }

  return (
    <>
      <ProjectEditor
        open={editorOpen}
        onOpenChange={setEditorOpen}
        project={editingProject}
        onSave={handleSaveProject}
        persons={persons}
        contexts={contexts}
      />

      {selected ? (
        (() => {
          const project = projects.find((p) => p.id === selected)
          if (!project) return null
          return (
            <ProjectDetail
              project={project}
              projects={projects}
              tasks={tasks}
              notes={notes}
              persons={persons}
              contexts={contexts}
              tags={tags}
              onBack={() => {
                handleSelect(null)
              }}
              onToggleProcessed={onToggleProcessed}
              onToggleStatus={onToggleStatus}
              onUpdate={onUpdate}
              onArchiveTask={onArchiveTask}
              onDeleteTask={onDeleteTask}
              onDeleteTasks={onDeleteTasks}
              urgencies={urgencies}
              onCreate={onCreate}
              onCreateNote={onCreateNote}
              onUpdateProject={onUpdateProject}
              onDeleteProject={(id) => {
                handleSelect(null)
                onDeleteProject(id)
              }}
              onEdit={() => {
                setEditingProject(project)
                setEditorOpen(true)
              }}
              initialTab={initialTab}
            />
          )
        })()
      ) : (
        <div
          ref={splitContainerRef}
          className="flex h-full min-h-0 w-full items-start gap-0 px-2 pt-2 pb-24 md:px-0 md:pt-0 md:pb-0"
        >
          {/* Left / Main Pane: Toolbar + Projects Table or Grid */}
          <div ref={leftPaneRef} className="flex-1 min-w-0">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-1 rounded-md border border-border bg-card p-1 w-fit">
                {(["Ongoing", "Closed", "All"] as const).map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setStatusFilter(s)}
                    className={cn(
                      "rounded px-3 py-1 text-xs transition-colors",
                      statusFilter === s
                        ? "bg-primary/15 text-primary"
                        : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {s}
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-2 ml-auto">
                {/* Columns toggle for desktop table view */}
                {!isLeftPaneMobile && viewMode === "list" && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button
                        type="button"
                        className="inline-flex h-8 items-center gap-1.5 rounded-md border border-border bg-card px-2.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground"
                      >
                        <Columns3 className="h-3.5 w-3.5" />
                        <span className="hidden sm:inline">Columns</span>
                        <span className="ml-0.5 rounded bg-muted px-1.5 font-mono text-xs text-muted-foreground">
                          {visibleColumns.length}/{PROJECT_COLUMNS.length}
                        </span>
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-56">
                      <DropdownMenuLabel className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
                        Toggle columns
                      </DropdownMenuLabel>
                      <DropdownMenuSeparator />
                      {columnState.order.map((key) => (
                        <DropdownMenuCheckboxItem
                          key={key}
                          checked={columnState.visibility[key]}
                          onCheckedChange={() => columnState.toggle(key)}
                          onSelect={(e) => e.preventDefault()}
                        >
                          {PROJECT_COLUMN_MAP[key].label}
                        </DropdownMenuCheckboxItem>
                      ))}
                      <DropdownMenuSeparator />
                      <div className="px-2 py-1.5 text-xs leading-relaxed text-muted-foreground">
                        Click column headers to sort, or drag them to reorder.
                      </div>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onSelect={() => columnState.reset()} className="text-xs">
                        <RotateCcw className="mr-2 h-3 w-3" />
                        Reset to defaults
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}

                <div className="flex items-center rounded-md border border-border bg-card p-0.5">
                  <button
                    type="button"
                    onClick={() => handleViewModeChange("list")}
                    className={cn(
                      "flex h-7 w-7 items-center justify-center rounded-sm transition-colors",
                      viewMode === "list"
                        ? "bg-primary/15 text-primary"
                        : "text-muted-foreground hover:text-foreground",
                    )}
                    aria-label="Table list view"
                    title="Table view"
                  >
                    <List className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleViewModeChange("grid")}
                    className={cn(
                      "flex h-7 w-7 items-center justify-center rounded-sm transition-colors",
                      viewMode === "grid"
                        ? "bg-primary/15 text-primary"
                        : "text-muted-foreground hover:text-foreground",
                    )}
                    aria-label="Grid view"
                    title="Grid view"
                  >
                    <LayoutGrid className="h-4 w-4" />
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setEditingProject(null)
                    setEditorOpen(true)
                  }}
                  className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90"
                >
                  <Plus className="h-3.5 w-3.5" />
                  New Project
                </button>
              </div>
            </div>

            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
              {/* Desktop List Mode -> Single-Column Projects Table */}
              {!isLeftPaneMobile && viewMode === "list" ? (
                <div className="rounded-lg border border-border bg-card overflow-hidden">
                  {filtered.length === 0 ? (
                    <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
                      <p className="text-sm font-medium">No projects found</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Create a new project or switch the status filter above.
                      </p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full border-collapse text-sm">
                        <thead className="sticky top-0 z-10 bg-card">
                          <tr className="border-b border-border">
                            <th className="w-9 px-2 py-2 text-left align-middle select-none" />
                            {visibleColumns.map((key) => {
                              const col = PROJECT_COLUMN_MAP[key]
                              const isDraggingCol = dragColKey === key
                              const isDropTargetCol = dropColTarget === key && dragColKey !== key
                              return (
                                <th
                                  key={key}
                                  scope="col"
                                  onDragOver={(e) => {
                                    if (!dragColKey || dragColKey === key) return
                                    e.preventDefault()
                                    if (dropColTarget !== key) setDropColTarget(key)
                                  }}
                                  onDragLeave={() => {
                                    if (dropColTarget === key) setDropColTarget(null)
                                  }}
                                  onDrop={(e) => {
                                    e.preventDefault()
                                    const source =
                                      (e.dataTransfer.getData("text/plain") as ProjectColumnKey) ||
                                      dragColKey
                                    if (source && source !== key) {
                                      columnState.reorder(source, key)
                                    }
                                    setDragColKey(null)
                                    setDropColTarget(null)
                                  }}
                                  onClick={() => handleSortColumn(key)}
                                  className={cn(
                                    "relative px-3 py-2 text-left font-mono text-xs font-medium uppercase tracking-wider text-muted-foreground transition-colors cursor-pointer select-none hover:bg-muted/50",
                                    PROJECT_COL_HEADER_CLASSES[key],
                                    isDraggingCol && "opacity-40",
                                    isDropTargetCol && "bg-primary/10",
                                    sortConfig?.key === key && "text-foreground",
                                  )}
                                >
                                  {isDropTargetCol && (
                                    <span
                                      aria-hidden
                                      className="pointer-events-none absolute inset-y-0 left-0 w-0.5 bg-primary"
                                    />
                                  )}
                                  <div
                                    draggable
                                    onDragStart={(e) => {
                                      setDragColKey(key)
                                      e.dataTransfer.effectAllowed = "move"
                                      e.dataTransfer.setData("text/plain", key)
                                    }}
                                    onDragEnd={() => {
                                      setDragColKey(null)
                                      setDropColTarget(null)
                                    }}
                                    className={cn(
                                      "flex w-full items-center gap-1",
                                      key === "notes" ? "justify-center" : "justify-start",
                                      isDraggingCol && "cursor-grabbing",
                                    )}
                                    title="Click to sort, drag to reorder"
                                  >
                                    <span className="truncate">{col.label}</span>
                                    {sortConfig?.key === key && (
                                      <span className="ml-1 shrink-0 text-xs text-primary">
                                        {sortConfig.direction === "asc" ? "↑" : "↓"}
                                      </span>
                                    )}
                                  </div>
                                </th>
                              )
                            })}
                            <th className="w-10 px-2 py-2 text-right align-middle select-none" />
                          </tr>
                        </thead>
                        <SortableContext
                          items={filtered.map((p) => p.id)}
                          strategy={verticalListSortingStrategy}
                        >
                          <tbody className="bg-card">
                            {filtered.map((p) => {
                              const isPreviewed = previewProjectId === p.id
                              return (
                                <SortableProjectTableRow
                                  key={p.id}
                                  id={p.id}
                                  showDragHandle={!sortConfig}
                                  onClick={() => {
                                    setPreviewProjectId((prev) => (prev === p.id ? null : p.id))
                                  }}
                                  className={cn(
                                    "group/row border-b border-border/60 last:border-b-0 transition-colors hover:bg-muted/30 cursor-pointer select-none",
                                    isPreviewed && "bg-primary/8 hover:bg-primary/12",
                                  )}
                                >
                                  {({ attributes, listeners }) => (
                                    <>
                                      <td
                                        className={cn(
                                          "w-9 px-2 py-2.5 text-center align-middle",
                                          isPreviewed && "border-l-2 border-l-primary",
                                        )}
                                        onClick={(e) => e.stopPropagation()}
                                      >
                                        {!sortConfig && (
                                          <div
                                            {...attributes}
                                            {...listeners}
                                            className="inline-flex cursor-grab active:cursor-grabbing text-muted-foreground/30 hover:text-muted-foreground p-1 rounded touch-none"
                                            title="Drag to reorder"
                                          >
                                            <GripVertical className="h-4 w-4" />
                                          </div>
                                        )}
                                      </td>
                                      {visibleColumns.map((colKey) => (
                                        <td
                                          key={colKey}
                                          className={cn(
                                            "px-3 py-2.5 align-middle",
                                            PROJECT_COL_HEADER_CLASSES[colKey],
                                          )}
                                        >
                                          {renderProjectTableCell(p, colKey)}
                                        </td>
                                      ))}
                                      <td
                                        className="w-10 px-2 py-2.5 text-right align-middle"
                                        onClick={(e) => e.stopPropagation()}
                                      >
                                        {renderProjectActionsMenu(
                                          p,
                                          "inline-flex h-7 w-7 items-center justify-center rounded-md hover:bg-muted text-muted-foreground opacity-0 group-hover/row:opacity-100 focus:opacity-100 transition-opacity",
                                        )}
                                      </td>
                                    </>
                                  )}
                                </SortableProjectTableRow>
                              )
                            })}
                          </tbody>
                        </SortableContext>
                      </table>
                    </div>
                  )}
                </div>
              ) : (
                /* Grid View (Desktop & Mobile) or Mobile List View */
                <SortableContext
                  items={filtered.map((p) => p.id)}
                  strategy={viewMode === "grid" ? rectSortingStrategy : verticalListSortingStrategy}
                >
                  <div
                    className={cn(
                      "grid gap-3",
                      viewMode === "grid"
                        ? leftPaneMeasuredWidth < 480
                          ? "grid-cols-2"
                          : leftPaneMeasuredWidth < 768
                            ? "grid-cols-2 sm:grid-cols-3"
                            : leftPaneMeasuredWidth < 1024
                              ? "grid-cols-3"
                              : "grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5"
                        : "grid-cols-1",
                    )}
                  >
                    {filtered.map((p) => {
                      const projTasks = tasks.filter((t) => t.project_id === p.id && t.processed)
                      const open = projTasks.filter((t) => t.status === "Open").length
                      const done = projTasks.filter((t) => t.status === "Done").length
                      const pct =
                        projTasks.length === 0 ? 0 : Math.round((done / projTasks.length) * 100)
                      const ProjIcon = p.icon ? ICONS[p.icon] ?? FolderKanban : FolderKanban
                      const isPreviewed = !isMobile && previewProjectId === p.id

                      if (viewMode === "grid") {
                        return (
                          <SortableProjectItem
                            id={p.id}
                            key={p.id}
                            onClick={() => handleSelect(p.id)}
                            className="group relative flex cursor-pointer flex-col overflow-hidden rounded-xl border border-border bg-card text-left transition-all hover:border-primary/50 hover:shadow-md aspect-[16/9]"
                            viewMode={viewMode}
                            isMobile={isMobile}
                          >
                            {/* Background Layer */}
                            <div
                              className="absolute inset-0 z-0 opacity-40 transition-opacity group-hover:opacity-50"
                              style={
                                p.background_image
                                  ? {
                                      backgroundImage: `url(${p.background_image})`,
                                      backgroundSize: "cover",
                                      backgroundPosition: "center",
                                    }
                                  : p.color
                                    ? {
                                        backgroundColor: `color-mix(in oklch, ${p.color} 20%, transparent)`,
                                      }
                                    : { backgroundColor: "var(--muted)" }
                              }
                            >
                              {p.background_image && (
                                <img
                                  src={p.background_image}
                                  alt=""
                                  aria-hidden="true"
                                  loading="eager"
                                  decoding="async"
                                  className="h-full w-full object-cover opacity-0 pointer-events-none"
                                />
                              )}
                            </div>
                            {!p.background_image && (
                              <div className="absolute inset-0 z-0 flex items-center justify-center opacity-20">
                                <ProjIcon
                                  className="w-24 h-24"
                                  style={{ color: p.color || "var(--primary)" }}
                                />
                              </div>
                            )}
                            <div className="absolute inset-0 z-0 bg-gradient-to-t from-background/90 via-background/40 to-transparent" />

                            <div
                              className="absolute top-2 right-2 z-20"
                              onClick={(e) => e.stopPropagation()}
                            >
                              {renderProjectActionsMenu(
                                p,
                                "flex h-8 w-8 items-center justify-center rounded-full bg-background/50 backdrop-blur-sm text-foreground hover:bg-background/80 transition-colors shadow-sm md:opacity-0 md:group-hover:opacity-100",
                              )}
                            </div>

                            {/* Content */}
                            <div className="relative z-10 flex flex-col justify-end h-full p-4">
                              <div className="flex items-center gap-2 mb-1.5">
                                {p.linked_person_id &&
                                  (() => {
                                    const lp = persons.find((per) => per.id === p.linked_person_id)
                                    return lp ? (
                                      <span className="inline-flex items-center gap-1 rounded-full bg-blue-500/80 backdrop-blur px-2 py-0.5 text-xs text-white font-medium">
                                        👤 {lp.name}
                                      </span>
                                    ) : null
                                  })()}
                              </div>
                              <h3 className="text-base font-bold tracking-tight text-foreground line-clamp-1 mb-1">
                                {p.name}
                              </h3>
                              <div className="flex items-center gap-3 text-xs text-muted-foreground font-medium drop-shadow-sm">
                                <span className="flex items-center gap-1">
                                  <Circle className="h-3 w-3" /> {open} open
                                </span>
                                <span className="flex items-center gap-1">
                                  <ListChecks className="h-3.5 w-3.5" /> {pct}%
                                </span>
                              </div>
                            </div>
                          </SortableProjectItem>
                        )
                      }

                      // Mobile single-column card list (used on mobile or when the desktop left pane is narrowed)
                      return (
                        <SortableProjectItem
                          id={p.id}
                          key={p.id}
                          onClick={() => {
                            if (!isMobile) {
                              setPreviewProjectId((prev) => (prev === p.id ? null : p.id))
                            } else {
                              handleSelect(p.id)
                            }
                          }}
                          className={cn(
                            "group relative flex cursor-pointer flex-col gap-2 rounded-lg border border-border bg-card p-3 text-left transition-all hover:border-primary/40",
                            isPreviewed && "border-primary/60 bg-primary/5 ring-1 ring-primary/20",
                          )}
                          viewMode={viewMode}
                          isMobile={isMobile}
                        >
                          <div
                            className="absolute top-2 right-2 z-10"
                            onClick={(e) => e.stopPropagation()}
                          >
                            {renderProjectActionsMenu(
                              p,
                              "flex h-7 w-7 items-center justify-center rounded-md hover:bg-muted text-muted-foreground md:opacity-0 md:group-hover:opacity-100 transition-opacity",
                            )}
                          </div>

                          <div className="flex items-center justify-between gap-2 min-w-0 pr-6">
                            <div className="group/desc relative flex items-center gap-2 min-w-0 flex-1">
                              <div
                                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md"
                                style={
                                  p.color
                                    ? {
                                        backgroundColor: `color-mix(in oklch, ${p.color} 15%, transparent)`,
                                        color: p.color,
                                        boxShadow: `inset 0 0 0 1px color-mix(in oklch, ${p.color} 30%, transparent)`,
                                      }
                                    : undefined
                                }
                              >
                                <ProjIcon className={cn("h-4 w-4", !p.color && "text-primary")} />
                              </div>
                              <h3 className="text-sm font-semibold tracking-tight truncate">
                                {p.name}
                              </h3>
                              {!isMobile && (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    handleSelect(p.id)
                                  }}
                                  className="shrink-0 opacity-0 pointer-events-none group-hover/desc:opacity-100 group-hover/desc:pointer-events-auto focus:opacity-100 focus:pointer-events-auto transition-opacity inline-flex items-center gap-1 rounded border border-primary/40 bg-card hover:bg-muted px-2 py-0.5 text-xs font-semibold text-primary shadow-sm cursor-pointer z-20"
                                  title="Open Project"
                                >
                                  <ArrowUpRight className="h-3.5 w-3.5" />
                                  <span>Open</span>
                                </button>
                              )}
                            </div>
                            <div className="flex items-center gap-1 shrink-0">
                              {p.linked_person_id &&
                                (() => {
                                  const lp = persons.find((per) => per.id === p.linked_person_id)
                                  return lp ? (
                                    <span className="inline-flex items-center gap-1 rounded-full bg-blue-500/10 border border-blue-500/20 px-2 py-0.5 text-xs text-blue-500 font-mono">
                                      👤 {lp.name}
                                    </span>
                                  ) : null
                                })()}
                              <span
                                className={cn(
                                  "shrink-0 inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-mono uppercase tracking-wider",
                                  p.status === "Ongoing"
                                    ? "border-primary/30 bg-primary/10 text-primary"
                                    : "border-border bg-muted/40 text-muted-foreground",
                                )}
                              >
                                {p.status}
                              </span>
                            </div>
                          </div>
                          <div>
                            {p.details ? (
                              <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
                                {p.details}
                              </p>
                            ) : null}
                          </div>

                          <div className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                            <Circle className="h-3.5 w-3.5" />
                            {open} open · {done} done · click to drill in
                          </div>
                        </SortableProjectItem>
                      )
                    })}
                  </div>
                </SortableContext>
              )}
            </DndContext>
          </div>

          {/* Right Pane: Resizable Project Preview Sidepanel (Desktop Only) */}
          {!isMobile && previewProject && (
            <div className="sticky top-0 flex items-stretch shrink-0 pl-3 max-h-[calc(100dvh-5rem)]">
              {/* Drag Resize Handle */}
              <div
                onMouseDown={startResizingPreview}
                title="Drag to resize preview panel"
                className={cn(
                  "group/handle relative flex w-3 -mr-1.5 z-20 cursor-col-resize items-center justify-center select-none",
                )}
              >
                <div
                  className={cn(
                    "h-full w-0.5 rounded-full transition-colors",
                    isResizingPreview
                      ? "bg-primary"
                      : "bg-transparent group-hover/handle:bg-primary/50",
                  )}
                />
                <div
                  className={cn(
                    "absolute flex h-7 w-3.5 items-center justify-center rounded border border-border bg-card text-muted-foreground shadow-sm opacity-0 transition-opacity group-hover/handle:opacity-100",
                    isResizingPreview && "opacity-100 border-primary text-primary",
                  )}
                >
                  <GripVertical className="h-3 w-3" />
                </div>
              </div>

              <aside
                ref={previewPanelRef}
                style={{ width: `${previewWidth}px` }}
                className="flex flex-col rounded-xl border border-border bg-card shadow-xl overflow-hidden max-h-[calc(100dvh-5rem)] animate-in slide-in-from-right-4 duration-200"
              >
                {/* Sidepanel Top Bar */}
                <div className="flex shrink-0 items-center justify-between border-b border-border bg-muted/30 px-3.5 py-2">
                  <span className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
                    Project Preview
                  </span>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => handleSelect(previewProject.id)}
                      className="inline-flex items-center gap-1 rounded border border-primary/40 bg-primary/5 hover:bg-primary/10 px-2 py-1 text-xs font-semibold text-primary transition-colors cursor-pointer"
                      title="Open full project page"
                    >
                      <ArrowUpRight className="h-3.5 w-3.5" />
                      <span>Open</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setPreviewProjectId(null)}
                      className="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition-colors cursor-pointer"
                      aria-label="Close preview panel"
                      title="Close preview (Esc)"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                {/* Container-responsive body: <768px = mobile project UI, >=768px = desktop project UI */}
                <div className="flex-1 min-h-0 overflow-y-auto p-3.5">
                  <MobileOverrideProvider value={previewPanelMeasuredWidth < 768}>
                    <ProjectDetail
                      project={previewProject}
                      projects={projects}
                      tasks={tasks}
                      notes={notes}
                      persons={persons}
                      contexts={contexts}
                      tags={tags}
                      urgencies={urgencies}
                      isPreviewPanel
                      onBack={() => setPreviewProjectId(null)}
                      onToggleProcessed={onToggleProcessed}
                      onToggleStatus={onToggleStatus}
                      onUpdate={onUpdate}
                      onArchiveTask={onArchiveTask}
                      onDeleteTask={onDeleteTask}
                      onDeleteTasks={onDeleteTasks}
                      onCreate={onCreate}
                      onCreateNote={onCreateNote}
                      onUpdateProject={onUpdateProject}
                      onDeleteProject={(id) => {
                        setPreviewProjectId(null)
                        onDeleteProject(id)
                      }}
                      onEdit={() => {
                        setEditingProject(previewProject)
                        setEditorOpen(true)
                      }}
                    />
                  </MobileOverrideProvider>
                </div>
              </aside>
            </div>
          )}
        </div>
      )}
    </>
  )
}

export function ProjectHeader({
  project,
  projects,
  tasks,
  notes,
  persons,
  onBack,
  onUpdateProject,
  onDeleteProject,
  onEdit,
  hideBackButton = false,
}: {
  project: Project
  projects: Project[]
  tasks: Task[]
  notes: Task[]
  persons: Person[]
  onBack: () => void
  onUpdateProject: (project: Project) => void
  onDeleteProject: (id: string) => void
  onEdit: () => void
  hideBackButton?: boolean
}) {
  const db = useDatabase()
  const isMobile = useIsMobile()
  const projTasks = tasks.filter((t) => t.project_id === project.id && t.processed)
  const open = projTasks.filter((t) => t.status === "Open")
  const done = projTasks.filter((t) => t.status === "Done")
  const ProjIcon = project.icon ? ICONS[project.icon] ?? FolderKanban : FolderKanban
  const linkedPerson = project.linked_person_id
    ? persons.find((per) => per.id === project.linked_person_id)
    : null

  return (
    <>
      {!hideBackButton && (
        <button
          type="button"
          onClick={onBack}
          className="mb-2 -ml-2 inline-flex items-center gap-1.5 p-2 text-sm text-muted-foreground hover:text-foreground md:ml-0 md:p-0 md:text-xs"
        >
          <ArrowLeft className="h-4 w-4 md:h-3 md:w-3" />
          All projects
        </button>
      )}

      {/* Compact header: icon + title + status on one line, meta on a tight second line */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <div
            className={cn(
              "flex h-9 w-9 shrink-0 items-center justify-center rounded-md",
              !project.color && "bg-primary/15 text-primary",
            )}
            style={
              project.color
                ? {
                    backgroundColor: `color-mix(in oklch, ${project.color} 15%, transparent)`,
                    color: project.color,
                    boxShadow: `inset 0 0 0 1px color-mix(in oklch, ${project.color} 30%, transparent)`,
                  }
                : undefined
            }
          >
            <ProjIcon className="h-4.5 w-4.5" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h2 className="truncate text-lg font-semibold tracking-tight">{project.name}</h2>
              <span
                className={cn(
                  "shrink-0 items-center gap-0.5 rounded-full border px-1.5 py-0.5 font-mono text-xs uppercase tracking-wider",
                  isMobile ? "hidden" : "hidden sm:inline-flex",
                  project.status === "Ongoing"
                    ? "border-primary/30 bg-primary/10 text-primary"
                    : "border-border bg-muted/40 text-muted-foreground",
                )}
              >
                <Dot className="h-3.5 w-3.5" />
                {project.status}
              </span>
            </div>
            <div className="mt-0.5 flex items-center gap-2.5 text-xs text-muted-foreground">
              {linkedPerson && (
                <span className="inline-flex items-center gap-1 truncate font-mono text-xs font-medium text-blue-500">
                  Shared · {linkedPerson.name}
                </span>
              )}
              <span className="whitespace-nowrap">{open.length} open</span>
              <span className="whitespace-nowrap">{done.length} done</span>
            </div>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
          <button
            type="button"
            onClick={() => window.dispatchEvent(new CustomEvent("open-search"))}
            className="inline-flex h-8 items-center justify-center gap-1.5 rounded-md border border-border bg-card px-2 sm:px-2.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
            title="Search tasks, notes, and projects"
          >
            <Search className="h-3.5 w-3.5" />
            {!isMobile && <span className="hidden sm:inline">Search</span>}
          </button>
          <button
            type="button"
            title="Save to Favorite Views"
            onClick={async () => {
              if (!db) return
              const existing = await db.saved_views.find().exec()
              const maxOrder = existing.reduce((max, v) => Math.max(max, v.order || 0), -1)
              await db.saved_views.insert({
                id: crypto.randomUUID(),
                name: project.name,
                icon: project.icon || "FolderKanban",
                color: project.color || "",
                context_ids: [],
                project_id: project.id,
                show_status: "open",
                is_grouped_by_project: false,
                show_hidden_by_show_on: false,
                sort_key: "date_created",
                sort_direction: "desc",
                filter_mode: "and",
                date_created: new Date().toISOString(),
                order: maxOrder + 1,
              })
              toast.success("Added to Views")
            }}
            className="inline-flex h-8 items-center justify-center gap-1.5 rounded-md border border-border bg-card px-2 sm:px-2.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
          >
            <Star className="h-3.5 w-3.5" />
            {!isMobile && <span className="hidden sm:inline">Add to Views</span>}
          </button>

          {/* Desktop-only direct action buttons */}
          {!isMobile && (
            <>
              <button
                type="button"
                onClick={onEdit}
                className="hidden sm:inline-flex h-8 items-center gap-1.5 rounded-md border border-border bg-card px-2.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
                title="Edit project"
              >
                <Pencil className="h-3.5 w-3.5" />
                <span>Edit</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  const current = project.status
                  onUpdateProject({
                    ...project,
                    status: current === "Ongoing" ? "Closed" : "Ongoing",
                  })
                }}
                className={cn(
                  "hidden sm:inline-flex h-8 items-center rounded-md border px-2.5 text-xs transition-colors",
                  project.status === "Ongoing"
                    ? "border-border bg-card hover:bg-muted"
                    : "border-primary/40 bg-primary/10 text-primary hover:bg-primary/20",
                )}
              >
                {project.status === "Ongoing" ? "Close" : "Reopen"}
              </button>
              {(() => {
                const hasItems =
                  tasks.some((t) => t.project_id === project.id) ||
                  notes.some((n) => n.project_id === project.id)
                return (
                  <button
                    type="button"
                    disabled={hasItems}
                    title={
                      hasItems ? "Remove all tasks and notes before deleting" : "Delete project"
                    }
                    onClick={() => {
                      if (confirm(`Are you sure you want to delete "${project.name}"?`)) {
                        onDeleteProject(project.id)
                      }
                    }}
                    className={cn(
                      "hidden sm:inline-flex h-8 items-center gap-1.5 rounded-md border px-2.5 text-xs transition-colors",
                      hasItems
                        ? "border-border bg-card text-muted-foreground/40 cursor-not-allowed"
                        : "border-destructive/40 bg-destructive/10 text-destructive hover:bg-destructive/20",
                    )}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    <span>Delete</span>
                  </button>
                )
              })()}
            </>
          )}

          {/* Mobile / Narrow-container three-dots menu */}
          <div className={cn(isMobile ? "block" : "sm:hidden")}>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  aria-label="More project options"
                  className="flex h-8 w-8 items-center justify-center rounded-md border border-border bg-card text-muted-foreground transition-colors hover:text-foreground hover:bg-muted outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <MoreVertical className="h-4 w-4" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem onClick={onEdit}>
                  <Pencil className="h-4 w-4 mr-2 text-muted-foreground" />
                  Edit project
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => {
                    const current = project.status
                    onUpdateProject({
                      ...project,
                      status: current === "Ongoing" ? "Closed" : "Ongoing",
                    })
                  }}
                >
                  {project.status === "Ongoing" ? (
                    <Archive className="h-4 w-4 mr-2 text-muted-foreground" />
                  ) : (
                    <CheckCircle2 className="h-4 w-4 mr-2 text-muted-foreground" />
                  )}
                  {project.status === "Ongoing" ? "Close project" : "Reopen project"}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                {(() => {
                  const hasItems =
                    tasks.some((t) => t.project_id === project.id) ||
                    notes.some((n) => n.project_id === project.id)
                  return (
                    <DropdownMenuItem
                      className={cn(
                        "text-destructive focus:text-destructive",
                        hasItems && "opacity-40 pointer-events-none",
                      )}
                      disabled={hasItems}
                      onClick={() => {
                        if (confirm(`Are you sure you want to delete "${project.name}"?`)) {
                          onDeleteProject(project.id)
                        }
                      }}
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Delete project
                      {hasItems && (
                        <span className="ml-auto text-xs text-muted-foreground font-normal">
                          Has items
                        </span>
                      )}
                    </DropdownMenuItem>
                  )
                })()}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>
    </>
  )
}

function ProjectDetail({
  project,
  projects,
  tasks,
  notes,
  persons,
  contexts,
  tags,
  onBack,
  onToggleProcessed,
  onToggleStatus,
  onUpdate,
  onArchiveTask,
  onDeleteTask,
  onDeleteTasks,
  urgencies,
  onUpdateProject,
  onDeleteProject,
  onEdit,
  onCreate,
  onCreateNote,
  initialTab,
  isPreviewPanel = false,
}: {
  project: Project
  projects: Project[]
  tasks: Task[]
  notes: Task[]
  persons: Person[]
  contexts: Context[]
  tags: Tag[]
  urgencies: UrgencyLevel[]
  onBack: () => void
  onToggleProcessed: (id: string) => void
  onToggleStatus: (id: string) => void
  onUpdate: (task: Task) => void
  onArchiveTask?: (id: string) => void
  onDeleteTask?: (id: string) => void
  onDeleteTasks?: (ids: string[]) => void
  onCreate?: (input: {
    description: string
    contextIds: string[]
    projectId: string | null
    personId: string | null
    processed: boolean
  }) => Promise<string | void>
  onCreateNote?: (input: {
    description: string
    contextIds: string[]
    projectId: string | null
    personId: string | null
    processed: boolean
  }) => Promise<string | void>
  onUpdateProject: (project: Project) => void
  onDeleteProject: (id: string) => void
  onEdit: () => void
  initialTab?: "tasks" | "notes" | "description"
  isPreviewPanel?: boolean
}) {
  const [tab, setTab] = useState<"tasks" | "notes" | "description">(initialTab || "tasks")

  useEffect(() => {
    if (initialTab) {
      setTab(initialTab)
    }
  }, [initialTab])

  const projTasks = tasks.filter((t) => t.project_id === project.id && t.processed)
  const projNotes = notes.filter((n) => n.project_id === project.id)
  const isMobile = useIsMobile()

  const handleTabChange = (newTab: "tasks" | "notes" | "description") => {
    if (!isPreviewPanel && isMobile && (newTab === "tasks" || newTab === "notes")) {
      window.dispatchEvent(new CustomEvent("mobile-section-change", { detail: newTab }))
    } else {
      setTab(newTab)
    }
  }

  return (
    <div
      className={cn(
        isPreviewPanel
          ? "p-0"
          : isMobile
            ? "px-2 pt-1 pb-24"
            : "px-6 pt-3 pb-24 md:pt-4 md:pb-6",
      )}
    >
      {(isPreviewPanel || !isMobile) && (
        <ProjectHeader
          project={project}
          projects={projects}
          tasks={tasks}
          notes={notes}
          persons={persons}
          onBack={onBack}
          onUpdateProject={onUpdateProject}
          onDeleteProject={onDeleteProject}
          onEdit={onEdit}
          hideBackButton={isPreviewPanel}
        />
      )}

      {(isPreviewPanel || !isMobile) && (
        <div className="mt-3 flex items-center gap-1 border-b border-border">
          <TabButton
            active={tab === "tasks"}
            onClick={() => handleTabChange("tasks")}
            icon={ListChecks}
          >
            Tasks
            <span className="ml-1.5 rounded bg-muted px-1.5 py-0.5 font-mono text-xs text-muted-foreground font-medium">
              {projTasks.length}
            </span>
          </TabButton>
          <TabButton
            active={tab === "notes"}
            onClick={() => handleTabChange("notes")}
            icon={StickyNote}
          >
            Notes
            <span className="ml-1.5 rounded bg-muted px-1.5 py-0.5 font-mono text-xs text-muted-foreground font-medium">
              {projNotes.length}
            </span>
          </TabButton>
          <TabButton
            active={tab === "description"}
            onClick={() => handleTabChange("description")}
            icon={FileText}
          >
            Description
          </TabButton>
        </div>
      )}

      {tab === "tasks" && (
        <div className={cn("mt-2", !isPreviewPanel && "md:mt-4 h-auto md:h-[500px]")}>
          <FilteredTasks
            tasks={projTasks}
            projects={projects}
            persons={persons}
            contexts={contexts}
            urgencies={urgencies}
            onToggleProcessed={onToggleProcessed}
            onToggleStatus={onToggleStatus}
            onUpdate={onUpdate}
            onArchiveTask={onArchiveTask}
            onDeleteTask={onDeleteTask}
            onDeleteTasks={onDeleteTasks}
            storageKey={`velocity:project-${project.id}:columns`}
            hideFilters={["project"]}
            emptyTitle={`No tasks for ${project.name}`}
            emptyHint="Tasks linked to this project will appear here."
            onCreate={onCreate}
            initialProjectId={project.id}
            initialSortKey={project.order_dependent ? "order" : undefined}
            initialSortDirection={project.order_dependent ? "asc" : undefined}
            fullWidthOnMobile={true}
            nestedOnMobile={true}
          />
        </div>
      )}

      {tab === "notes" && (
        <div className={cn("mt-2", !isPreviewPanel && "md:mt-4 h-auto md:h-[500px]")}>
          <FilteredTasks
            tasks={projNotes}
            projects={projects}
            persons={persons}
            contexts={[]}
            tags={tags}
            urgencies={urgencies}
            notesMode
            itemNoun="note"
            onToggleProcessed={onToggleProcessed}
            onToggleStatus={onToggleStatus}
            onUpdate={onUpdate}
            onArchiveTask={onArchiveTask}
            onDeleteTask={onDeleteTask}
            onDeleteTasks={onDeleteTasks}
            hideFilters={["project"]}
            storageKey={`velocity:project-${project.id}:notes-columns`}
            initialSortKey="order"
            initialSortDirection="asc"
            emptyTitle={`No notes for ${project.name}`}
            emptyHint="Notes assigned to this project will appear here."
            onCreate={onCreateNote}
            initialProjectId={project.id}
            fullWidthOnMobile={true}
            nestedOnMobile={true}
          />
        </div>
      )}

      {tab === "description" && (
        <div className="mt-2 md:mt-4 rounded-lg border border-border bg-card p-4 md:p-5">
          <p className="text-sm leading-relaxed text-foreground/90 whitespace-pre-wrap">
            {project.details ?? "No description yet. Click Edit to add details."}
          </p>
        </div>
      )}
    </div>
  )
}

function TabButton({
  active,
  onClick,
  icon: Icon,
  children,
}: {
  active: boolean
  onClick: () => void
  icon: React.ComponentType<{ className?: string }>
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "relative inline-flex items-center gap-1.5 px-3 py-2 text-sm transition-colors",
        active ? "text-foreground" : "text-muted-foreground hover:text-foreground",
      )}
    >
      <Icon className="h-3.5 w-3.5" />
      {children}
      {active ? <span className="absolute inset-x-0 -bottom-px h-px bg-primary" /> : null}
    </button>
  )
}

export function ProjectEditor({
  open,
  onOpenChange,
  project,
  onSave,
  persons,
  contexts,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  project: Project | null
  onSave: (p: Project | Omit<Project, "id">) => void
  persons: Person[]
  contexts: Context[]
}) {
  const [name, setName] = useState("")
  const [details, setDetails] = useState("")
  const [status, setStatus] = useState<ProjectStatus>("Ongoing")
  const [linkedPersonId, setLinkedPersonId] = useState<string>("not_shared")
  const [icon, setIcon] = useState<string>(DEFAULT_PROJECT_ICON)
  const [color, setColor] = useState<string>(COLOR_PALETTE[0])
  const [backgroundImage, setBackgroundImage] = useState<string>("")
  const [isUploading, setIsUploading] = useState(false)
  const [orderDependent, setOrderDependent] = useState<boolean>(false)
  const [showMobileColorPicker, setShowMobileColorPicker] = useState(false)
  const [defaultContextIds, setDefaultContextIds] = useState<string[]>([])

  useEffect(() => {
    if (open) {
      setName(project?.name ?? "")
      setDetails(project?.details ?? "")
      setStatus(project?.status ?? "Ongoing")
      setLinkedPersonId(project?.linked_person_id ?? "not_shared")
      setIcon(project?.icon ?? DEFAULT_PROJECT_ICON)
      setColor(project?.color ?? COLOR_PALETTE[0])
      setBackgroundImage(project?.background_image ?? "")
      setOrderDependent(project?.order_dependent ?? false)
      setDefaultContextIds(project?.default_context_ids ?? [])
      setShowMobileColorPicker(false)
    }
  }, [open, project])

  const handleSave = () => {
    if (!name.trim()) return
    onSave({
      ...(project ? { id: project.id } : {}),
      name: name.trim(),
      details: details.trim() || null,
      status,
      linked_person_id: linkedPersonId === "not_shared" ? null : linkedPersonId,
      icon,
      color,
      background_image: backgroundImage.trim() || null,
      order_dependent: orderDependent,
      default_context_ids: defaultContextIds,
    } as any)
  }

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    try {
      setIsUploading(true)
      const url = await uploadImage(file)
      preloadImage(url)
      setBackgroundImage(url)
      toast.success("Image uploaded successfully")
    } catch (error) {
      toast.error("Failed to upload image")
    } finally {
      setIsUploading(false)
      if (e.target) e.target.value = ""
    }
  }

  const linkablePersons = persons.filter((p) => !!p.linked_uid)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90dvh] overflow-y-auto sm:max-h-[85vh]">
        <DialogHeader>
          <DialogTitle>{project ? "Edit Project" : "New Project"}</DialogTitle>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="name">Name</Label>
            <Input
              id="name"
              placeholder="Project name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="details">Description</Label>
            <Textarea
              id="details"
              placeholder="Add details, goals, or notes..."
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              rows={4}
            />
          </div>
          <div className="grid gap-2">
            <Label>Default Contexts</Label>
            <FormMultiSelect
              options={contexts.map((c) => ({
                id: c.id,
                label: c.name,
                color: c.color,
                icon: c.icon,
              }))}
              selectedIds={defaultContextIds}
              onChange={setDefaultContextIds}
            />
            <p className="text-[11px] text-muted-foreground leading-tight">
              Tasks created for this project will automatically inherit these contexts.
            </p>
          </div>
          <div className="grid gap-2">
            <Label>Icon</Label>
            <IconPicker value={icon} onChange={setIcon} />
          </div>
          <div className="grid gap-2">
            <Label>Color</Label>
            <div
              className={cn(
                "md:hidden flex items-center gap-3",
                showMobileColorPicker ? "hidden" : "",
              )}
            >
              <div
                className="h-8 w-8 rounded-full border-2 border-foreground"
                style={{ backgroundColor: color }}
              />
              <Button variant="outline" size="sm" onClick={() => setShowMobileColorPicker(true)}>
                Change Color
              </Button>
            </div>
            <div
              className={cn(
                "flex-wrap gap-2 items-center",
                showMobileColorPicker ? "flex" : "hidden md:flex",
              )}
            >
              {COLOR_PALETTE.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  className={cn(
                    "h-8 w-8 rounded-full border-2 transition-all",
                    color === c
                      ? "border-foreground scale-110"
                      : "border-transparent hover:scale-110",
                  )}
                  style={{ backgroundColor: c }}
                  aria-label={c}
                />
              ))}
              <Button
                variant="ghost"
                size="sm"
                className="md:hidden ml-auto"
                onClick={() => setShowMobileColorPicker(false)}
              >
                Done
              </Button>
            </div>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="status">Status</Label>
            <Select value={status} onValueChange={(v: any) => setStatus(v)}>
              <SelectTrigger id="status">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Ongoing">Ongoing</SelectItem>
                <SelectItem value="Closed">Closed</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="sharing">Share Project</Label>
            <Select value={linkedPersonId} onValueChange={setLinkedPersonId}>
              <SelectTrigger id="sharing">
                <SelectValue placeholder="Not shared" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="not_shared">Not shared (Local only)</SelectItem>
                {linkablePersons.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    Shared with {p.name} ({p.linked_email || "Linked user"})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-[11px] text-muted-foreground leading-tight">
              Sharing a project will automatically sync the project&apos;s metadata and assign all
              its tasks to the selected person. Unlinking it keeps tasks linked, but makes the
              projects separate.
            </p>
          </div>
          <div className="grid gap-2">
            <Label>Background Image</Label>
            <div className="flex items-center gap-3">
              {backgroundImage ? (
                <div className="relative h-16 w-28 overflow-hidden rounded-md border border-border">
                  <div
                    className="absolute inset-0 bg-cover bg-center"
                    style={{ backgroundImage: `url(${backgroundImage})` }}
                  />
                  <button
                    type="button"
                    onClick={() => setBackgroundImage("")}
                    className="absolute top-1 right-1 flex h-5 w-5 items-center justify-center rounded-full bg-background/80 text-foreground hover:bg-destructive hover:text-destructive-foreground transition-colors"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              ) : (
                <div className="flex h-16 w-28 items-center justify-center rounded-md border border-dashed border-border bg-muted/40">
                  <ImageIcon className="h-5 w-5 text-muted-foreground/50" />
                </div>
              )}
              <div className="flex-1">
                <Label
                  htmlFor="bg-image-upload"
                  className={cn(
                    "inline-flex cursor-pointer items-center justify-center rounded-md border border-input bg-background px-3 py-1.5 text-xs font-medium shadow-sm transition-colors hover:bg-accent hover:text-accent-foreground",
                    isUploading && "pointer-events-none opacity-50",
                  )}
                >
                  {isUploading ? (
                    <>
                      <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                      Uploading...
                    </>
                  ) : (
                    "Upload Image"
                  )}
                </Label>
                <input
                  id="bg-image-upload"
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleImageUpload}
                  disabled={isUploading}
                />
                <p className="mt-1 text-xs text-muted-foreground">
                  Visible in grid view. Replaces color/icon.
                </p>
              </div>
            </div>
          </div>
          <div className="flex items-center justify-between rounded-lg border border-border p-3 shadow-sm">
            <div className="space-y-0.5">
              <Label htmlFor="order-dependent">Order Dependent</Label>
              <p className="text-xs text-muted-foreground leading-normal">
                When enabled, only the first open task is visible throughout the app until
                completed.
              </p>
            </div>
            <Switch
              id="order-dependent"
              checked={orderDependent}
              onCheckedChange={setOrderDependent}
            />
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="rounded-md px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={!name.trim()}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {project ? "Save Changes" : "Create Project"}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
