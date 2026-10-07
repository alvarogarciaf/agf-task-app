"use client"

import React, { useEffect, useState, useMemo } from "react"
import { useDatabase } from "@/components/db-provider"
import { Task, Project, UrgencyLevel } from "@/lib/types"
import { ProjectOptionIcon } from "@/components/project-select"
import { ICONS } from "@/lib/constants"
import { Circle, CircleCheck, FileText, Check } from "lucide-react"
import { cn } from "@/lib/utils"

interface InlineTaskCardProps {
  taskId: string
  onClick: (taskId: string) => void
}

export function InlineTaskCard({ taskId, onClick }: InlineTaskCardProps) {
  const db = useDatabase()
  const [task, setTask] = useState<Task | null>(null)
  const [project, setProject] = useState<Project | null>(null)
  const [urgency, setUrgency] = useState<UrgencyLevel | null>(null)

  const [isEditing, setIsEditing] = useState(false)
  const inputRef = React.useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus()
      inputRef.current.select()
    }
  }, [isEditing])

  const saveTitle = async (newTitle: string) => {
    setIsEditing(false)
    if (!db || !task) return
    const d = await db.tasks.findOne(task.id).exec()
    if (d) {
      await d.update({ $set: { description: newTitle.trim() || "New task" } })
    }
  }

  // Subscriptions
  useEffect(() => {
    if (!db || !taskId) return

    const sub = db.tasks
      .findOne(taskId)
      .$
      .subscribe((t) => {
        if (t) {
          const data = t.toJSON() as Task
          setTask(data)
          if (data.description === "New task" && !isEditing) {
            setIsEditing(true)
          }
        } else {
          setTask(null)
        }
      })

    return () => sub.unsubscribe()
  }, [db, taskId])

  useEffect(() => {
    if (!db || !task?.project_id) {
      setProject(null)
      return
    }
    const sub = db.projects
      .findOne(task.project_id)
      .$
      .subscribe((p) => {
        if (p) setProject(p.toJSON() as Project)
      })
    return () => sub.unsubscribe()
  }, [db, task?.project_id])

  useEffect(() => {
    if (!db || !task?.urgency_id) {
      setUrgency(null)
      return
    }
    const sub = db.urgency_levels
      .findOne(task.urgency_id)
      .$
      .subscribe((u) => {
        if (u) setUrgency(u.toJSON() as UrgencyLevel)
      })
    return () => sub.unsubscribe()
  }, [db, task?.urgency_id])

  if (!task) {
    return (
      <div className="flex items-center gap-2 p-3 my-2 text-sm text-muted-foreground bg-muted/20 border border-border/50 rounded-xl">
        Loading task...
      </div>
    )
  }

  const isNote = task.type === "note"

  return (
    <div 
      className={cn(
        "relative flex min-h-[48px] items-center gap-3 rounded-xl border pl-4 pr-3 py-2 my-2 transition-all active:scale-[0.98] select-none shadow-sm",
        "border-border/80 bg-card hover:border-border cursor-pointer",
        task.status === "Done" ? "opacity-65 bg-muted/20" : ""
      )}
      onClick={() => {
        if (!isEditing) onClick(taskId)
      }}
      contentEditable={false}
    >
      {/* Urgency Line Indicator */}
      {!isNote && urgency && task.status !== "Done" && (
        <div 
          className="absolute left-0 top-0 bottom-0 w-[3.5px] rounded-l-xl"
          style={{ backgroundColor: urgency.color }}
        />
      )}

      {/* Icon or Checkbox */}
      {isNote ? (
        <span className="shrink-0 flex items-center justify-center">
          {project ? (
            <ProjectOptionIcon
              icon={task.icon || project.icon || "FileText"}
              color={project.color}
              size="sm"
            />
          ) : (
            (() => {
              const effectiveIcon = task.icon || "FileText"
              const IconComp = (effectiveIcon && ICONS[effectiveIcon as keyof typeof ICONS]) || FileText
              return <IconComp className="h-4.5 w-4.5 text-muted-foreground" />
            })()
          )}
        </span>
      ) : (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            if (db) {
              const doc = db.tasks.findOne(task.id)
              doc.exec().then((d) => {
                if (d) {
                  d.update({ $set: { status: task.status === "Done" ? "Open" : "Done" } })
                }
              })
            }
          }}
          className={cn(
            "flex h-4.5 w-4.5 shrink-0 items-center justify-center rounded-full border-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring cursor-pointer",
            task.status === "Done"
              ? "border-primary bg-primary text-primary-foreground"
              : "border-muted-foreground/60 bg-muted/20 hover:border-foreground/80 hover:bg-muted/40"
          )}
        >
          {task.status === "Done" && <Check className="h-3 w-3 stroke-[3]" />}
        </button>
      )}

      {/* Description */}
      {isEditing ? (
        <input
          ref={inputRef}
          type="text"
          defaultValue={task.description === "New task" ? "" : task.description}
          onBlur={(e) => saveTitle(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") saveTitle(e.currentTarget.value)
            if (e.key === "Escape") setIsEditing(false)
          }}
          onClick={(e) => e.stopPropagation()}
          className="flex-1 bg-transparent text-sm font-medium outline-none placeholder:text-muted-foreground"
          placeholder="New task"
        />
      ) : (
        <span
          className={cn(
            "flex-1 min-w-0 truncate text-sm font-medium leading-tight",
            !isNote && task.status === "Done" ? "text-muted-foreground line-through" : "text-foreground"
          )}
        >
          {task.description}
        </span>
      )}

      {/* Right side: Urgency label */}
      <div className="flex items-center gap-1.5 shrink-0" onClick={(e) => e.stopPropagation()}>
        {!isNote && urgency && task.status !== "Done" && (
          <span 
            className="hidden sm:inline-block font-mono text-xs font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded-md"
            style={{ 
              backgroundColor: `color-mix(in oklch, ${urgency.color} 12%, transparent)`, 
              color: urgency.color 
            }}
          >
            {urgency.name}
          </span>
        )}
      </div>
    </div>
  )
}
