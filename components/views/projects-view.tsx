"use client"

import { useState } from "react"
import { ArrowLeft, FolderKanban, FileText, ListChecks, Circle, Dot } from "lucide-react"
import { cn } from "@/lib/utils"
import { FilteredTasks } from "@/components/filtered-tasks"
import { TaskDetailDialog } from "@/components/task-detail-dialog"
import type { Context, Person, Project, Task, UrgencyLevel } from "@/lib/types"

interface ProjectsViewProps {
  projects: Project[]
  tasks: Task[]
  persons: Person[]
  contexts: Context[]
  urgencies: UrgencyLevel[]
  onToggleProcessed: (id: string) => void
  onUpdate: (task: Task) => void
  onArchiveTask?: (id: string) => void
  onDeleteTask?: (id: string) => void
}

export function ProjectsView({
  projects,
  tasks,
  persons,
  contexts,
  urgencies,
  onToggleProcessed,
  onUpdate,
  onArchiveTask,
  onDeleteTask,
}: ProjectsViewProps) {
  const [selected, setSelected] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState<"Ongoing" | "Closed" | "All">("Ongoing")

  if (selected) {
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
        onUpdate={onUpdate}
        onArchiveTask={onArchiveTask}
        onDeleteTask={onDeleteTask}
        urgencies={urgencies}
      />
    )
  }

  const filtered = projects.filter((p) => statusFilter === "All" || p.status === statusFilter)

  return (
    <div className="px-3 md:px-6 py-6">
      <div className="mb-4 flex items-center gap-1 rounded-md border border-border bg-card p-1 w-fit">
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

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {filtered.map((p) => {
          const projTasks = tasks.filter((t) => t.project_id === p.id)
          const open = projTasks.filter((t) => !t.processed).length
          const done = projTasks.filter((t) => t.processed).length
          const pct = projTasks.length === 0 ? 0 : Math.round((done / projTasks.length) * 100)
          return (
            <button
              key={p.id}
              type="button"
              onClick={() => setSelected(p.id)}
              className="group flex flex-col gap-3 rounded-xl border border-border bg-card p-4 text-left transition-all hover:border-primary/40"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary/15 text-primary">
                  <FolderKanban className="h-4 w-4" />
                </div>
                <span
                  className={cn(
                    "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-mono uppercase tracking-wider",
                    p.status === "Ongoing"
                      ? "border-primary/30 bg-primary/10 text-primary"
                      : "border-border bg-muted/40 text-muted-foreground",
                  )}
                >
                  <Dot className="h-3 w-3" />
                  {p.status}
                </span>
              </div>
              <div>
                <h3 className="text-sm font-semibold tracking-tight">{p.name}</h3>
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
            </button>
          )
        })}
      </div>
    </div>
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
  onUpdate,
  onArchiveTask,
  onDeleteTask,
  urgencies,
}: {
  project: Project
  projects: Project[]
  tasks: Task[]
  persons: Person[]
  contexts: Context[]
  urgencies: UrgencyLevel[]
  onBack: () => void
  onToggleProcessed: (id: string) => void
  onUpdate: (task: Task) => void
  onArchiveTask?: (id: string) => void
  onDeleteTask?: (id: string) => void
}) {
  const [tab, setTab] = useState<"tasks" | "description">("tasks")
  const projTasks = tasks.filter((t) => t.project_id === project.id)
  const open = projTasks.filter((t) => !t.processed)
  const done = projTasks.filter((t) => t.processed)

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

        <button
          type="button"
          className={cn(
            "rounded-md border px-3 py-1.5 text-xs transition-colors",
            project.status === "Ongoing"
              ? "border-border bg-card hover:bg-muted"
              : "border-primary/40 bg-primary/10 text-primary hover:bg-primary/20",
          )}
        >
          {project.status === "Ongoing" ? "Mark as Closed" : "Reopen project"}
        </button>
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
            onUpdate={onUpdate}
            onArchiveTask={onArchiveTask}
            onDeleteTask={onDeleteTask}
            storageKey={`velocity:project-${project.id}:columns`}
            hideFilters={["project"]}
            emptyTitle={`No tasks for ${project.name}`}
            emptyHint="Tasks linked to this project will appear here."
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
