"use client"

import { FilteredTasks } from "@/components/filtered-tasks"
import type { Context, Person, Project, Task, UrgencyLevel } from "@/lib/types"

interface AllTasksViewProps {
  tasks: Task[]
  projects: Project[]
  persons: Person[]
  contexts: Context[]
  urgencies: UrgencyLevel[]
  onToggleProcessed: (id: string) => void
  onUpdate: (task: Task) => void
  onArchiveTask?: (id: string) => void
  onDeleteTask?: (id: string) => void
  initialContextId?: string
  initialPersonId?: string
  initialProjectId?: string
}

export function AllTasksView(props: AllTasksViewProps) {
  return (
    <FilteredTasks
      {...props}
      storageKey="velocity:all-tasks:columns"
    />
  )
}

