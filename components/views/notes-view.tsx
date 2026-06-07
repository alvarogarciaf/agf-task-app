"use client"

import { FilteredTasks } from "@/components/filtered-tasks"
import type { Person, Project, Tag, Task, UrgencyLevel } from "@/lib/types"

interface NotesViewProps {
  tasks: Task[]
  projects: Project[]
  persons: Person[]
  tags: Tag[]
  urgencies: UrgencyLevel[]
  onToggleProcessed: (id: string) => void
  onToggleStatus: (id: string) => void
  onUpdate: (task: Task) => void
  onArchiveTask?: (id: string) => void
  onDeleteTask?: (id: string) => void
  initialTagId?: string | null
  fullWidthOnMobile?: boolean
  onCreate?: (input: {
    description: string
    contextIds: string[]
    projectId: string | null
    personId: string | null
    processed: boolean
  }) => Promise<string | void>
}

export function NotesView(props: NotesViewProps) {
  return (
    <FilteredTasks
      {...props}
      contexts={[]}
      notesMode
      itemNoun="note"
      storageKey="velocity:notes:columns"
      initialSortKey="date_created"
      initialSortDirection="desc"
      emptyTitle="No notes yet"
      emptyHint="Capture a thought to get started."
    />
  )
}
