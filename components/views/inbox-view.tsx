"use client"

import { Inbox as InboxIcon, Sparkles, ArrowRight } from "lucide-react"
import { FilteredTasks } from "@/components/filtered-tasks"
import type { Context, Person, Project, Task, UrgencyLevel } from "@/lib/types"

interface InboxViewProps {
  tasks: Task[]
  projects: Project[]
  persons: Person[]
  contexts: Context[]
  urgencies: UrgencyLevel[]
  onToggleProcessed: (id: string) => void
  onUpdate: (task: Task) => void
}

export function InboxView({
  tasks,
  projects,
  persons,
  contexts,
  urgencies,
  onToggleProcessed,
  onUpdate,
}: InboxViewProps) {
  const inbox = tasks.filter((t) => !t.processed)

  if (inbox.length === 0) {
    return (
      <div className="px-6 py-12">
        <div className="mx-auto flex max-w-md flex-col items-center rounded-xl border border-dashed border-border bg-card px-8 py-12 text-center">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Sparkles className="h-5 w-5" />
          </div>
          <h2 className="mt-4 text-base font-semibold">Inbox zero</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Nothing to triage. Everything you&apos;ve captured has been processed.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="px-6 py-6">
      <div className="mb-4 flex items-center justify-between gap-3 rounded-lg border border-border bg-card px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary/15 text-primary">
            <InboxIcon className="h-4 w-4" />
          </div>
          <div>
            <div className="text-sm font-medium">{inbox.length} items to triage</div>
            <div className="text-xs text-muted-foreground">
              Click a row to edit, or toggle the circle to mark as processed.
            </div>
          </div>
        </div>
        <button
          type="button"
          className="inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-3 py-1.5 text-xs hover:bg-muted"
        >
          Process all
          <ArrowRight className="h-3 w-3" />
        </button>
      </div>

      <div className="h-[calc(100vh-200px)] -mx-6">
        <FilteredTasks
          tasks={inbox}
          projects={projects}
          persons={persons}
          contexts={contexts}
          urgencies={urgencies}
          onToggleProcessed={onToggleProcessed}
          onUpdate={onUpdate}
          itemNoun="item"
          emptyTitle="Inbox zero"
          emptyHint="Nothing to triage right now."
          hideFilters={["status"]}
          inboxMode={true}
        />
      </div>
    </div>
  )
}
