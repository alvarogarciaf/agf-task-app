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
  onToggleStatus: (id: string) => void
  onUpdate: (task: Task) => void
  onArchiveTask?: (id: string) => void
  onDeleteTask?: (id: string) => void
  initialContextId?: string | null
  initialContextIds?: string[]
  initialPersonId?: string | null
  initialProjectId?: string | null
  initialShowStatus?: "all" | "open" | "done"
  initialIsGroupedByProject?: boolean
  initialShowHiddenByShowOn?: boolean
  initialSortKey?: string
  initialSortDirection?: "asc" | "desc"
  fullWidthOnMobile?: boolean
  allowUnprocessed?: boolean
  onCreate?: (input: {
    description: string
    contextIds: string[]
    projectId: string | null
    personId: string | null
    processed: boolean
  }) => Promise<string | void>
}

export function AllTasksView(props: AllTasksViewProps) {
  return (
    <FilteredTasks
      {...props}
      storageKey="velocity:all-tasks:columns"
    />
  )
}

