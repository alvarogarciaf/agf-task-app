"use client"

import { useState, useEffect } from "react"
import { ArrowLeft, FolderKanban, FileText, ListChecks, Circle, Dot, Plus, Settings2, Trash2 } from "lucide-react"
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
import type { Context, Person, Project, Task, UrgencyLevel, ProjectStatus } from "@/lib/types"

interface ProjectsViewProps {
  projects: Project[]
  tasks: Task[]
  persons: Person[]
  contexts: Context[]
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
  onAddProject: (project: Omit<Project, "id">) => void
  onUpdateProject: (project: Project) => void
  onDeleteProject: (id: string) => void
}

export function ProjectsView({
  projects,
  tasks,
  persons,
  contexts,
  urgencies,
  onToggleProcessed,
  onToggleStatus,
  onUpdate,
  onArchiveTask,
  onDeleteTask,
  onCreate,
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
              persons={persons}
              contexts={contexts}
              onBack={() => setSelected(null)}
              onToggleProcessed={onToggleProcessed}
              onToggleStatus={onToggleStatus}
              onUpdate={onUpdate}
              onArchiveTask={onArchiveTask}
              onDeleteTask={onDeleteTask}
              urgencies={urgencies}
              onCreate={onCreate}
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
        <div>
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
                <h3 className="text-sm font-semibold tracking-tight truncate flex-1">{p.name}</h3>
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
  persons,
  contexts,
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
}: {
  project: Project
  projects: Project[]
  tasks: Task[]
  persons: Person[]
  contexts: Context[]
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
  onUpdateProject: (project: Project) => void
  onDeleteProject: (id: string) => void
  onEdit: () => void
}) {
  const [tab, setTab] = useState<"tasks" | "description">("tasks")
  const projTasks = tasks.filter((t) => t.project_id === project.id && t.processed)
  const open = projTasks.filter((t) => t.status === "Open")
  const done = projTasks.filter((t) => t.status === "Done")

  return (
    <div className="px-6 py-6">
      <button
        type="button"
        onClick={onBack}
        className="mb-4 inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-3 w-3" />
        All projects
      </button>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-md bg-primary/15 text-primary">
            <FolderKanban className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-xl font-semibold tracking-tight">{project.name}</h2>
            <div className="mt-1 flex items-center gap-3 text-xs text-muted-foreground">
              <span
                className={cn(
                  "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider",
                  project.status === "Ongoing"
                    ? "border-primary/30 bg-primary/10 text-primary"
                    : "border-border bg-muted/40 text-muted-foreground",
                )}
              >
                <Dot className="h-3 w-3" />
                {project.status}
              </span>
              <span>{open.length} open</span>
              <span>{done.length} done</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onEdit}
            className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-border bg-card text-muted-foreground hover:text-foreground"
            title="Edit project"
          >
            <Settings2 className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => {
              const current = project.status
              onUpdateProject({ 
                id: project.id,
                name: project.name,
                details: project.details,
                status: current === "Ongoing" ? "Closed" : "Ongoing" 
              })
            }}
            className={cn(
              "rounded-md border px-3 py-1.5 text-xs transition-colors h-8 flex items-center",
              project.status === "Ongoing"
                ? "border-border bg-card hover:bg-muted"
                : "border-primary/40 bg-primary/10 text-primary hover:bg-primary/20",
            )}
          >
            {project.status === "Ongoing" ? "Close project" : "Reopen project"}
          </button>
        </div>
      </div>

      <div className="mt-5 flex items-center gap-1 border-b border-border">
        <TabButton active={tab === "tasks"} onClick={() => setTab("tasks")} icon={ListChecks}>
          Tasks
          <span className="ml-1.5 rounded bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
            {projTasks.length}
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

      {tab === "tasks" ? (
        <div className="mt-5 h-[500px] -mx-6">
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
          />
        </div>
      ) : (
        <div className="mt-5 rounded-lg border border-border bg-card p-6">
          <p className="text-sm leading-relaxed text-foreground/90">
            {project.details ?? "No description yet. Click to add details with Markdown."}
          </p>
          <div className="mt-6 border-t border-border pt-4 font-mono text-[11px] text-muted-foreground">
            Stored locally in IndexedDB · synced via Cloud Firestore
          </div>
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
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  project: Project | null
  onSave: (p: Project | Omit<Project, "id">) => void
}) {
  const [name, setName] = useState("")
  const [details, setDetails] = useState("")
  const [status, setStatus] = useState<ProjectStatus>("Ongoing")

  useEffect(() => {
    if (open) {
      setName(project?.name ?? "")
      setDetails(project?.details ?? "")
      setStatus(project?.status ?? "Ongoing")
    }
  }, [open, project])

  const handleSave = () => {
    if (!name.trim()) return
    onSave({
      ...(project ? { id: project.id } : {}),
      name: name.trim(),
      details: details.trim() || null,
      status,
    } as any)
  }

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
