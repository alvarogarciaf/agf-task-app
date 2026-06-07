"use client"

import { useState, useEffect } from "react"
import { ArrowLeft, FolderKanban, FileText, ListChecks, Circle, Dot, Plus, Trash2, StickyNote, Pencil } from "lucide-react"
import { cn } from "@/lib/utils"
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
import { MoreVertical, Edit2 } from "lucide-react"
import { ICON_OPTIONS, ICONS, COLOR_PALETTE } from "@/lib/constants"
import type { Context, Person, Project, Tag, Task, UrgencyLevel, ProjectStatus } from "@/lib/types"

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
}: ProjectsViewProps) {
  const [selected, setSelected] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState<"Ongoing" | "Closed" | "All">("Ongoing")
  const [editorOpen, setEditorOpen] = useState(false)
  const [editingProject, setEditingProject] = useState<Project | null>(null)

  const handleSaveProject = (p: Project | Omit<Project, "id">) => {
    if ("id" in p) {
      onUpdateProject(p as Project)
    } else {
      onAddProject(p as Omit<Project, "id">)
    }
    setEditorOpen(false)
    setEditingProject(null)
  }

  const filtered = projects.filter((p) => statusFilter === "All" || p.status === statusFilter)

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
              onBack={() => setSelected(null)}
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
                setSelected(null)
                onDeleteProject(id)
              }}
              onEdit={() => {
                setEditingProject(project)
                setEditorOpen(true)
              }}
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

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {filtered.map((p) => {
          const projTasks = tasks.filter((t) => t.project_id === p.id && t.processed)
          const open = projTasks.filter((t) => t.status === "Open").length
          const done = projTasks.filter((t) => t.status === "Done").length
          const pct = projTasks.length === 0 ? 0 : Math.round((done / projTasks.length) * 100)
          return (
            <div
              key={p.id}
              onClick={() => setSelected(p.id)}
              className="group relative flex cursor-pointer flex-col gap-3 rounded-lg border border-border bg-card p-4 text-left transition-all hover:border-primary/40"
            >
              <div className="absolute top-2 right-2 z-10" onClick={(e) => e.stopPropagation()}>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button className="flex h-7 w-7 items-center justify-center rounded-md hover:bg-muted text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity">
                      <MoreVertical className="h-3.5 w-3.5" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-32">
                    <DropdownMenuItem onClick={() => { setEditingProject(p); setEditorOpen(true); }}>
                      <Edit2 className="h-3.5 w-3.5 mr-2" />
                      Edit
                    </DropdownMenuItem>
                    <DropdownMenuItem 
                      className="text-destructive focus:text-destructive" 
                      onClick={() => { if(confirm(`Are you sure you want to delete "${p.name}"?`)) onDeleteProject(p.id) }}
                    >
                      <Trash2 className="h-3.5 w-3.5 mr-2" />
                      Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>

              <div className="flex items-center justify-between gap-2 min-w-0 pr-6">
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  {(() => {
                    const ProjIcon = p.icon ? ICONS[p.icon] ?? FolderKanban : FolderKanban
                    return (
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
                    )
                  })()}
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

              <div className="mt-auto">
                <div className="mb-1 flex items-center justify-between font-mono text-[10px] text-muted-foreground">
                  <span>
                    {done}/{projTasks.length} done
                  </span>
                  <span>{pct}%</span>
                </div>
                <div className="h-1 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className={cn(
                      "h-full rounded-full transition-all",
                      p.status === "Ongoing" ? "bg-primary" : "bg-muted-foreground/40",
                    )}
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <div className="mt-2 flex items-center gap-1.5 text-[11px] text-muted-foreground">
                  <Circle className="h-3 w-3" />
                  {open} open · click to drill in
                </div>
              </div>
            </div>
          )
        })}
      </div>
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
}) {
  const [tab, setTab] = useState<"tasks" | "notes" | "description">("tasks")
  const projTasks = tasks.filter((t) => t.project_id === project.id && t.processed)
  const projNotes = notes.filter((n) => n.project_id === project.id)
  const open = projTasks.filter((t) => t.status === "Open")
  const done = projTasks.filter((t) => t.status === "Done")
  const ProjIcon = project.icon ? ICONS[project.icon] ?? FolderKanban : FolderKanban
  const linkedPerson = project.linked_person_id
    ? persons.find((per) => per.id === project.linked_person_id)
    : null

  return (
    <div className="px-4 pt-3 pb-24 md:px-6 md:pt-4 md:pb-6">
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
        </div>
      </div>

      <div className="mt-3 flex items-center gap-1 border-b border-border">
        <TabButton active={tab === "tasks"} onClick={() => setTab("tasks")} icon={ListChecks}>
          Tasks
          <span className="ml-1.5 rounded bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
            {projTasks.length}
          </span>
        </TabButton>
        <TabButton active={tab === "notes"} onClick={() => setTab("notes")} icon={StickyNote}>
          Notes
          <span className="ml-1.5 rounded bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
            {projNotes.length}
          </span>
        </TabButton>
        <TabButton
          active={tab === "description"}
          onClick={() => setTab("description")}
          icon={FileText}
        >
          Description
        </TabButton>
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

  useEffect(() => {
    if (open) {
      setName(project?.name ?? "")
      setDetails(project?.details ?? "")
      setStatus(project?.status ?? "Ongoing")
      setLinkedPersonId(project?.linked_person_id ?? "not_shared")
      setIcon(project?.icon ?? DEFAULT_PROJECT_ICON)
      setColor(project?.color ?? COLOR_PALETTE[0])
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
    } as any)
  }

  const linkablePersons = persons.filter(p => !!p.linked_uid)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
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
