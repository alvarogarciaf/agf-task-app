"use client"

import React, { useState, useEffect } from "react"

import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  TouchSensor,
  MouseSensor,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  rectSortingStrategy,
  verticalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";

import { ArrowLeft, FolderKanban, FileText, ListChecks, Circle, Dot, Plus, Trash2, StickyNote, Pencil, LayoutGrid, List, Image as ImageIcon, Loader2, Star } from "lucide-react"
import { cn } from "@/lib/utils"
import { useDatabase } from "@/components/db-provider"
import { FilteredTasks } from "@/components/filtered-tasks"
import { TaskDetailDialog } from "@/components/task-detail-dialog"
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
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Switch } from "@/components/ui/switch"
import { MoreVertical, Edit2 } from "lucide-react"
import { ICON_OPTIONS, ICONS, COLOR_PALETTE } from "@/lib/constants"
import type { Context, Person, Project, Tag, Task, UrgencyLevel, ProjectStatus } from "@/lib/types"
import { uploadImage } from "@/lib/image-upload"
import { toast } from "sonner"
const DEFAULT_PROJECT_ICON = "Layers"

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
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: props.id });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.4 : undefined, position: 'relative' as const, zIndex: isDragging ? 1 : 0 };
  
  const { viewMode, isMobile } = props;
  let children = props.children;
  
  if (viewMode === 'list') {
    children = React.Children.map(props.children, (child, index) => {
      if (index === 0) {
        return React.cloneElement(child as any, {
          children: (
            <div className="flex items-center gap-1 w-full">
              {!isMobile && (
                <div {...attributes} {...listeners} onClick={e => e.stopPropagation()} className="cursor-grab active:cursor-grabbing text-muted-foreground/30 hover:text-muted-foreground p-1 shrink-0">
                  <GripVertical className="h-4 w-4" />
                </div>
              )}
              {(child as any).props.children}
            </div>
          )
        });
      }
      return child;
    });
  }

  const bindProps = (isMobile || viewMode === 'grid') ? { ...attributes, ...listeners } : {};

  return (
    <div ref={setNodeRef} style={style} className={props.className} onClick={props.onClick} {...bindProps}>
      {children}
    </div>
  );
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
  const [statusFilter, setStatusFilter] = useState<"Ongoing" | "Closed" | "All">("Ongoing")
  const [viewMode, setViewMode] = useState<"list" | "grid">("list")
  const [editorOpen, setEditorOpen] = useState(false)
  const [editingProject, setEditingProject] = useState<Project | null>(null)
  const isMobile = useIsMobile()

  const handleToggleMode = () => {
    const mode = viewMode === "grid" ? "list" : "grid"
    setViewMode(mode)
    localStorage.setItem("projects_view_mode", mode)
  }

  useEffect(() => {
    const saved = localStorage.getItem("projects_view_mode")
    if (saved === "grid" || saved === "list") {
      setViewMode(saved)
    }
  }, [])

  const handleViewModeChange = (mode: "list" | "grid") => {
    setViewMode(mode)
    localStorage.setItem("projects_view_mode", mode)
  }

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const urlProj = params.get("project")
    if (urlProj) {
      setSelected(urlProj)
      onSelect?.(urlProj)
    } else {
      setSelected(initialSelectedId || null)
      onSelect?.(initialSelectedId || null)
    }
  }, [initialSelectedId])

  useEffect(() => {
    const handlePopState = () => {
      const params = new URLSearchParams(window.location.search)
      const id = params.get("project") || initialSelectedId || null
      setSelected(id)
      onSelect?.(id)
    }
    window.addEventListener("popstate", handlePopState)
    return () => window.removeEventListener("popstate", handlePopState)
  }, [initialSelectedId])

  const handleSelect = (id: string | null) => {
    setSelected(id)
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
      window.history.pushState(null, "", newUrl)
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

  
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      onReorderProjects?.(active.id as string, over.id as string);
    }
  };

  const filtered = projects.filter((p) => statusFilter === "All" || p.status === statusFilter).sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
  

  return (
    <>
      <ProjectEditor
        open={editorOpen}
        onOpenChange={setEditorOpen}
        project={editingProject}
        onSave={handleSaveProject}
        persons={persons}
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
              onBack={() => handleSelect(null)}
              onToggleProcessed={onToggleProcessed}
              onToggleStatus={onToggleStatus}
              onUpdate={onUpdate}
              onArchiveTask={onArchiveTask}
              onDeleteTask={onDeleteTask}
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
        <div className="pb-24 md:pb-0">
          <div className="mb-4 flex items-center justify-between gap-3">
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
              <div className="flex items-center rounded-md border border-border bg-card p-0.5">
                <button
                  type="button"
                  onClick={() => handleViewModeChange("list")}
                  className={cn(
                    "flex h-7 w-7 items-center justify-center rounded-sm transition-colors",
                    viewMode === "list" ? "bg-primary/15 text-primary" : "text-muted-foreground hover:text-foreground"
                  )}
                  aria-label="List view"
                >
                  <List className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => handleViewModeChange("grid")}
                  className={cn(
                    "flex h-7 w-7 items-center justify-center rounded-sm transition-colors",
                    viewMode === "grid" ? "bg-primary/15 text-primary" : "text-muted-foreground hover:text-foreground"
                  )}
                  aria-label="Grid view"
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
            <SortableContext items={filtered.map(p => p.id)} strategy={viewMode === "grid" ? rectSortingStrategy : verticalListSortingStrategy}>
              <div className={cn(
                "grid gap-3",
                viewMode === "grid" 
                  ? "grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5"
                  : "sm:grid-cols-2 lg:grid-cols-3"
              )}>
                {filtered.map((p) => {

          const projTasks = tasks.filter((t) => t.project_id === p.id && t.processed)
          const open = projTasks.filter((t) => t.status === "Open").length
          const done = projTasks.filter((t) => t.status === "Done").length
          const pct = projTasks.length === 0 ? 0 : Math.round((done / projTasks.length) * 100)
          const ProjIcon = p.icon ? ICONS[p.icon] ?? FolderKanban : FolderKanban
          
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
                      ? { backgroundImage: `url(${p.background_image})`, backgroundSize: 'cover', backgroundPosition: 'center' }
                      : p.color 
                        ? { backgroundColor: `color-mix(in oklch, ${p.color} 20%, transparent)` }
                        : { backgroundColor: 'var(--muted)' }
                  }
                />
                {!p.background_image && (
                  <div className="absolute inset-0 z-0 flex items-center justify-center opacity-20">
                    <ProjIcon className="w-24 h-24" style={{ color: p.color || 'var(--primary)' }} />
                  </div>
                )}
                <div className="absolute inset-0 z-0 bg-gradient-to-t from-background/90 via-background/40 to-transparent" />

                <div className="absolute top-2 right-2 z-20" onClick={(e) => e.stopPropagation()}>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button className="flex h-8 w-8 items-center justify-center rounded-full bg-background/50 backdrop-blur-sm text-foreground hover:bg-background/80 transition-colors shadow-sm md:opacity-0 md:group-hover:opacity-100">
                        <MoreVertical className="h-4 w-4" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-40">
                      <DropdownMenuItem onClick={() => { setEditingProject(p); setEditorOpen(true); }}>
                        <Edit2 className="h-3.5 w-3.5 mr-2" />
                        Edit
                      </DropdownMenuItem>
                      {(() => {
                        const hasItems = tasks.some((t) => t.project_id === p.id) || notes.some((n) => n.project_id === p.id)
                        return (
                          <DropdownMenuItem
                            className={cn("text-destructive focus:text-destructive", hasItems && "opacity-40 pointer-events-none")}
                            disabled={hasItems}
                            onClick={() => { if(confirm(`Are you sure you want to delete "${p.name}"?`)) onDeleteProject(p.id) }}
                          >
                            <Trash2 className="h-3.5 w-3.5 mr-2" />
                            Delete
                            {hasItems && <span className="ml-auto text-[10px] text-muted-foreground font-normal">Has items</span>}
                          </DropdownMenuItem>
                        )
                      })()}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>

                {/* Content */}
                <div className="relative z-10 flex flex-col justify-end h-full p-4">
                   <div className="flex items-center gap-2 mb-1.5">
                     {p.linked_person_id && (() => {
                        const lp = persons.find(per => per.id === p.linked_person_id)
                        return lp ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-blue-500/80 backdrop-blur px-2 py-0.5 text-[10px] text-white font-medium">
                            👤 {lp.name}
                          </span>
                        ) : null
                      })()}
                   </div>
                   <h3 className="text-lg font-bold tracking-tight text-foreground line-clamp-1 mb-1">{p.name}</h3>
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

          return (
            <SortableProjectItem
              id={p.id}
              key={p.id}
              onClick={() => handleSelect(p.id)}
              className="group relative flex cursor-pointer flex-col gap-3 rounded-lg border border-border bg-card p-4 text-left transition-all hover:border-primary/40"
              viewMode={viewMode}
              isMobile={isMobile}
            
            >
              <div className="absolute top-2 right-2 z-10" onClick={(e) => e.stopPropagation()}>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button className="flex h-7 w-7 items-center justify-center rounded-md hover:bg-muted text-muted-foreground md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                      <MoreVertical className="h-3.5 w-3.5" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-40">
                    <DropdownMenuItem onClick={() => { setEditingProject(p); setEditorOpen(true); }}>
                      <Edit2 className="h-3.5 w-3.5 mr-2" />
                      Edit
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={async () => {
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
                          date_created: new Date().toISOString(),
                          order: maxOrder + 1,
                        })
                        toast.success("Added to Views")
                      }}
                    >
                      <Star className="h-3.5 w-3.5 mr-2" />
                      Add to Views
                    </DropdownMenuItem>
                    {(() => {
                      const hasItems = tasks.some((t) => t.project_id === p.id) || notes.some((n) => n.project_id === p.id)
                      return (
                        <DropdownMenuItem
                          className={cn("text-destructive focus:text-destructive", hasItems && "opacity-40 pointer-events-none")}
                          disabled={hasItems}
                          onClick={() => { if(confirm(`Are you sure you want to delete "${p.name}"?`)) onDeleteProject(p.id) }}
                        >
                          <Trash2 className="h-3.5 w-3.5 mr-2" />
                          Delete
                          {hasItems && <span className="ml-auto text-[10px] text-muted-foreground font-normal">Has items</span>}
                        </DropdownMenuItem>
                      )
                    })()}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>

              <div className="flex items-center justify-between gap-2 min-w-0 pr-6">
                <div className="flex items-center gap-2 min-w-0 flex-1">
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
                  <h3 className="text-sm font-semibold tracking-tight truncate">{p.name}</h3>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  {p.linked_person_id && (() => {
                    const lp = persons.find(per => per.id === p.linked_person_id)
                    return lp ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-blue-500/10 border border-blue-500/20 px-2 py-0.5 text-[10px] text-blue-500 font-mono">
                        👤 {lp.name}
                      </span>
                    ) : null
                  })()}
                  <span
                    className={cn(
                      "shrink-0 inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-mono uppercase tracking-wider",
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
                  <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{p.details}</p>
                ) : null}
              </div>

              <div className="mt-2 flex items-center gap-1.5 text-[11px] text-muted-foreground">
                <Circle className="h-3 w-3" />
                {open} open · {done} done · click to drill in
              </div>
            </SortableProjectItem>
          )
        })}
              </div>
            </SortableContext>
          </DndContext>
    </div>
  )}
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
  urgencies,
  onUpdateProject,
  onDeleteProject,
  onEdit,
  onCreate,
  onCreateNote,
  initialTab,
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
}) {
  const db = useDatabase()
  const [tab, setTab] = useState<"tasks" | "notes" | "description">(initialTab || "tasks")
  
  useEffect(() => {
    if (initialTab) {
      setTab(initialTab)
    }
  }, [initialTab])
  const projTasks = tasks.filter((t) => t.project_id === project.id && t.processed)
  const projNotes = notes.filter((n) => n.project_id === project.id)
  const open = projTasks.filter((t) => t.status === "Open")
  const done = projTasks.filter((t) => t.status === "Done")
  const ProjIcon = project.icon ? ICONS[project.icon] ?? FolderKanban : FolderKanban
  const linkedPerson = project.linked_person_id
    ? persons.find((per) => per.id === project.linked_person_id)
    : null
  
  const isMobile = useIsMobile()
  const handleTabChange = (newTab: "tasks" | "notes" | "description") => {
    if (isMobile && (newTab === "tasks" || newTab === "notes")) {
      window.dispatchEvent(new CustomEvent("mobile-section-change", { detail: newTab }))
    } else {
      setTab(newTab)
    }
  }

  return (
    <div 
      className="px-4 pt-3 pb-24 md:px-6 md:pt-4 md:pb-6"
    >
      <button
        type="button"
        onClick={onBack}
        className="mb-2 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-3 w-3" />
        All projects
      </button>

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
                  "hidden shrink-0 items-center gap-0.5 rounded-full border px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wider sm:inline-flex",
                  project.status === "Ongoing"
                    ? "border-primary/30 bg-primary/10 text-primary"
                    : "border-border bg-muted/40 text-muted-foreground",
                )}
              >
                <Dot className="h-3 w-3" />
                {project.status}
              </span>
            </div>
            <div className="mt-0.5 flex items-center gap-2.5 text-xs text-muted-foreground">
              {linkedPerson && (
                <span className="inline-flex items-center gap-1 truncate font-mono text-[10px] font-medium text-blue-500">
                  Shared · {linkedPerson.name}
                </span>
              )}
              <span className="whitespace-nowrap">{open.length} open</span>
              <span className="whitespace-nowrap">{done.length} done</span>
            </div>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2">
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
                date_created: new Date().toISOString(),
                order: maxOrder + 1,
              })
              toast.success("Added to Views")
            }}
            className="inline-flex h-8 items-center gap-1.5 rounded-md border border-border bg-card px-2.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
          >
            <Star className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Add to Views</span>
          </button>
          <button
            type="button"
            onClick={onEdit}
            className="inline-flex h-8 items-center gap-1.5 rounded-md border border-border bg-card px-2.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
            title="Edit project"
          >
            <Pencil className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Edit</span>
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
              "flex h-8 items-center rounded-md border px-2.5 text-xs transition-colors",
              project.status === "Ongoing"
                ? "border-border bg-card hover:bg-muted"
                : "border-primary/40 bg-primary/10 text-primary hover:bg-primary/20",
            )}
          >
            {project.status === "Ongoing" ? "Close" : "Reopen"}
          </button>
          {(() => {
            const hasItems = tasks.some((t) => t.project_id === project.id) || notes.some((n) => n.project_id === project.id)
            return (
              <button
                type="button"
                disabled={hasItems}
                title={hasItems ? "Remove all tasks and notes before deleting" : "Delete project"}
                onClick={() => {
                  if (confirm(`Are you sure you want to delete "${project.name}"?`)) {
                    onDeleteProject(project.id)
                  }
                }}
                className={cn(
                  "inline-flex h-8 items-center gap-1.5 rounded-md border px-2.5 text-xs transition-colors",
                  hasItems
                    ? "border-border bg-card text-muted-foreground/40 cursor-not-allowed"
                    : "border-destructive/40 bg-destructive/10 text-destructive hover:bg-destructive/20",
                )}
              >
                <Trash2 className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Delete</span>
              </button>
            )
          })()}
        </div>
      </div>

      <div className="mt-3 flex items-center gap-1 border-b border-border">
        <TabButton active={tab === "tasks"} onClick={() => handleTabChange("tasks")} icon={ListChecks}>
          Tasks
          <span className="ml-1.5 rounded bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
            {projTasks.length}
          </span>
        </TabButton>
        <TabButton active={tab === "notes"} onClick={() => handleTabChange("notes")} icon={StickyNote}>
          Notes
          <span className="ml-1.5 rounded bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
            {projNotes.length}
          </span>
        </TabButton>
        {!isMobile && (
          <TabButton
            active={tab === "description"}
            onClick={() => handleTabChange("description")}
            icon={FileText}
          >
            Description
          </TabButton>
        )}
      </div>

      {tab === "tasks" && (
        <div className="mt-4 h-auto md:h-[500px] -mx-4 md:-mx-6">
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
            storageKey={`velocity:project-${project.id}:columns`}
            hideFilters={["project"]}
            emptyTitle={`No tasks for ${project.name}`}
            emptyHint="Tasks linked to this project will appear here."
            onCreate={onCreate}
            initialProjectId={project.id}
          />
        </div>
      )}

      {tab === "notes" && (
        <div className="mt-4 h-auto md:h-[500px] -mx-4 md:-mx-6">
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
            hideFilters={["project"]}
            storageKey={`velocity:project-${project.id}:notes-columns`}
            initialSortKey="date_created"
            initialSortDirection="desc"
            emptyTitle={`No notes for ${project.name}`}
            emptyHint="Notes assigned to this project will appear here."
            onCreate={onCreateNote}
            initialProjectId={project.id}
          />
        </div>
      )}

      {tab === "description" && (
        <div className="mt-4 rounded-lg border border-border bg-card p-5">
          <p className="text-sm leading-relaxed text-foreground/90">
            {project.details ?? "No description yet. Click to add details with Markdown."}
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
      {active ? (
        <span className="absolute inset-x-0 -bottom-px h-px bg-primary" />
      ) : null}
    </button>
  )
}

function ProjectEditor({
  open,
  onOpenChange,
  project,
  onSave,
  persons,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  project: Project | null
  onSave: (p: Project | Omit<Project, "id">) => void
  persons: Person[]
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
    } as any)
  }

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    
    try {
      setIsUploading(true)
      const url = await uploadImage(file)
      setBackgroundImage(url)
      toast.success("Image uploaded successfully")
    } catch (error) {
      toast.error("Failed to upload image")
    } finally {
      setIsUploading(false)
      if (e.target) e.target.value = "" // reset input
    }
  }

  const linkablePersons = persons.filter(p => !!p.linked_uid)

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
            <Label>Icon</Label>
            <div className="grid grid-cols-8 gap-1.5 sm:grid-cols-9 max-h-40 overflow-y-auto rounded-md border border-border bg-background/40 p-2">
              {ICON_OPTIONS.map((opt) => {
                const OptIcon = opt.icon
                const isSelected = icon === opt.name
                return (
                  <button
                    key={opt.name}
                    type="button"
                    onClick={() => setIcon(opt.name)}
                    className={cn(
                      "flex h-9 w-9 items-center justify-center rounded-lg border transition-colors",
                      isSelected
                        ? "border-primary bg-primary/15 text-primary"
                        : "border-transparent text-muted-foreground hover:bg-muted hover:text-foreground"
                    )}
                    aria-label={opt.name}
                  >
                    <OptIcon className="h-4 w-4" />
                  </button>
                )
              })}
            </div>
          </div>
          <div className="grid gap-2">
            <Label>Color</Label>
            <div className="flex flex-wrap gap-2">
              {COLOR_PALETTE.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  className={cn(
                    "h-8 w-8 rounded-full border-2 transition-all",
                    color === c
                      ? "border-foreground scale-110"
                      : "border-transparent hover:scale-110"
                  )}
                  style={{ backgroundColor: c }}
                  aria-label={c}
                />
              ))}
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
              Sharing a project will automatically sync the project's metadata and assign all its tasks to the selected person. Unlinking it keeps tasks linked, but makes the projects separate.
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
                    isUploading && "pointer-events-none opacity-50"
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
                <p className="mt-1 text-[10px] text-muted-foreground">
                  Visible in grid view. Replaces color/icon.
                </p>
              </div>
            </div>
          </div>
          <div className="flex items-center justify-between rounded-lg border border-border p-3 shadow-sm">
            <div className="space-y-0.5">
              <Label htmlFor="order-dependent">Order Dependent</Label>
              <p className="text-[11px] text-muted-foreground leading-tight">
                When enabled, only the first open task is visible throughout the app until completed.
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
