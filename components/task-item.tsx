"use client"

import { Circle, CircleCheck, FolderKanban, Calendar } from "lucide-react"
import { cn } from "@/lib/utils"
import type { Task, Project, Person, Context, UrgencyLevel } from "@/lib/types"

interface TaskItemProps {
  task: Task
  project?: Project
  person?: Person
  contexts: Context[]
  urgency?: UrgencyLevel
  onToggleProcessed?: (id: string) => void
  onClick?: (task: Task) => void
  compact?: boolean
}

export function TaskItem({
  task,
  project,
  person,
  contexts,
  urgency,
  onToggleProcessed,
  onClick,
  compact = false,
}: TaskItemProps) {
  const showOn = task.show_on ? new Date(task.show_on) : null

  return (
    <div
      onClick={() => onClick?.(task)}
      onKeyDown={(e) => {
        if (onClick && (e.key === "Enter" || e.key === " ")) {
          e.preventDefault()
          onClick(task)
        }
      }}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      className={cn(
        "group grid grid-cols-[auto_1fr_auto] items-start gap-3 border-b border-border px-4 py-3 transition-colors hover:bg-muted/40",
        compact && "py-2.5",
        onClick && "cursor-pointer focus-visible:bg-muted/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring/40"
      )}
    >
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation()
          onToggleProcessed?.(task.id)
        }}
        className="mt-0.5 text-muted-foreground transition-colors hover:text-primary"
        aria-label={task.processed ? "Mark as inbox" : "Mark as processed"}
      >
        {task.processed ? (
          <CircleCheck className="h-4 w-4 text-primary" />
        ) : (
          <Circle className="h-4 w-4" />
        )}
      </button>

      <div className="min-w-0">
        <div className="flex flex-wrap items-baseline gap-x-2">
          {urgency ? (
            <span
              className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground"
            >
              <span 
                className="mr-1 inline-block h-1.5 w-1.5 rounded-full align-middle" 
                style={{ backgroundColor: urgency.color }}
              />
              {urgency.name}
            </span>
          ) : null}
          <p
            className={cn(
              "truncate text-sm leading-snug",
              task.processed ? "text-foreground" : "text-foreground",
            )}
          >
            {task.description}
          </p>
        </div>

        {task.details && !compact ? (
          <p className="mt-1 line-clamp-1 text-xs text-muted-foreground">{task.details}</p>
        ) : null}

        <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
          {project ? (
            <span className="inline-flex items-center gap-1 rounded border border-border bg-card px-1.5 py-0.5 text-[11px] text-muted-foreground">
              <FolderKanban className="h-3 w-3" />
              {project.name}
            </span>
          ) : null}
          {contexts.map((c) => (
            <span
              key={c.id}
              className="inline-flex items-center gap-1 rounded border border-border bg-card px-1.5 py-0.5 text-[11px] text-muted-foreground"
            >
              <span
                className="h-1.5 w-1.5 rounded-full"
                style={{ backgroundColor: c.color }}
              />
              {c.name}
            </span>
          ))}
          {showOn ? (
            <span className="inline-flex items-center gap-1 rounded border border-border bg-card px-1.5 py-0.5 text-[11px] text-muted-foreground">
              <Calendar className="h-3 w-3" />
              {showOn.toLocaleDateString(undefined, { month: "short", day: "numeric" })}
            </span>
          ) : null}
        </div>
      </div>

      <div className="flex items-center gap-2 self-center">
        {person ? (
          <div
            className="flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-semibold text-foreground"
            style={{ backgroundColor: `color-mix(in oklch, ${person.color} 30%, transparent)` }}
            title={person.name}
          >
            {person.initials}
          </div>
        ) : null}
        <span className="font-mono text-[10px] text-muted-foreground">
          {new Date(task.date_created).toLocaleDateString(undefined, {
            month: "short",
            day: "numeric",
          })}
        </span>
      </div>
    </div>
  )
}
