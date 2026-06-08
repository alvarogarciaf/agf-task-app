"use client"

import { useEffect } from "react"
import {
  ArrowLeft,
  ArrowLeftRight,
  Check,
  Circle,
  CircleCheck,
  FileText,
} from "lucide-react"
import { cn } from "@/lib/utils"
import {
  ObjectEditFields,
  ObjectDetailsEditor,
  useObjectDraft,
} from "@/components/object-editor-shared"
import type {
  Context,
  Person,
  Project,
  Tag as TagType,
  Task,
  UrgencyLevel,
} from "@/lib/types"

interface ObjectFullScreenViewProps {
  task: Task | null
  previousLabel: string
  onBack: () => void
  projects: Project[]
  persons: Person[]
  contexts: Context[]
  tags?: TagType[]
  urgencies: UrgencyLevel[]
  onUpdate: (task: Task) => void
}

export function ObjectFullScreenView({
  task,
  previousLabel,
  onBack,
  projects,
  persons,
  contexts,
  tags = [],
  urgencies,
  onUpdate,
}: ObjectFullScreenViewProps) {
  // If the object disappears (deleted elsewhere), return to the previous screen.
  useEffect(() => {
    if (!task) onBack()
  }, [task, onBack])

  const {
    draft,
    setDraft,
    update,
    dirty,
    autoProcess,
    setAutoProcess,
    sortedUrgencies,
    save,
    cancel,
    convertType,
  } = useObjectDraft({
    task,
    projects,
    urgencies,
    onUpdate,
    onClose: onBack,
  })

  if (!draft) return null

  const isNote = draft.type === "note"
  const urgency = urgencies.find((u) => u.id === draft.urgency_id) || urgencies[0]
  const selectedProject = draft.project_id
    ? projects.find((p) => p.id === draft.project_id)
    : null
  const isProjectShared = !!(selectedProject && selectedProject.linked_person_id)

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* Top bar */}
      <div className="flex items-center gap-3 border-b border-border bg-card px-4 py-2.5">
        <button
          type="button"
          onClick={cancel}
          className="inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-2.5 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
          title={`Back to ${previousLabel}`}
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to {previousLabel}
        </button>

        {isNote ? (
          <div className="inline-flex items-center gap-1.5 rounded-md border border-primary/20 bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary">
            <FileText className="h-3.5 w-3.5" />
            Note
          </div>
        ) : (
          <>
            <button
              type="button"
              onClick={() => update("processed", !draft.processed)}
              className={cn(
                "inline-flex items-center gap-2 rounded-md border px-2.5 py-1 text-xs transition-colors",
                draft.processed
                  ? "border-primary/40 bg-primary/10 text-primary"
                  : "border-border bg-background text-muted-foreground hover:text-foreground",
              )}
            >
              {draft.processed ? (
                <CircleCheck className="h-3.5 w-3.5" />
              ) : (
                <Circle className="h-3.5 w-3.5" />
              )}
              {draft.processed ? "Processed" : "Inbox"}
            </button>

            <button
              type="button"
              onClick={() =>
                update("status", draft.status === "Open" ? "Done" : "Open")
              }
              className={cn(
                "inline-flex items-center gap-2 rounded-md border px-2.5 py-1 text-xs transition-colors",
                draft.status === "Done"
                  ? "border-primary/40 bg-primary/10 text-primary"
                  : "border-border bg-background text-muted-foreground hover:text-foreground",
              )}
            >
              {draft.status === "Done" ? (
                <CircleCheck className="h-3.5 w-3.5" />
              ) : (
                <Circle className="h-3.5 w-3.5" />
              )}
              {draft.status === "Done" ? "Done" : "Open"}
            </button>

            <span className="inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-2 py-1 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
              {urgency ? (
                <>
                  <span
                    className="h-1.5 w-1.5 rounded-full"
                    style={{ backgroundColor: urgency.color }}
                  />
                  {urgency.name}
                </>
              ) : (
                "No urgency"
              )}
            </span>
          </>
        )}

        <div className="ml-auto flex items-center gap-2">
          {task && !task.processed && !draft.processed && (
            <label className="mr-1 flex cursor-pointer items-center gap-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground">
              <input
                type="checkbox"
                checked={autoProcess}
                onChange={(e) => setAutoProcess(e.target.checked)}
                className="h-3.5 w-3.5 rounded border-border bg-background accent-primary"
              />
              Processed
            </label>
          )}
          <button
            type="button"
            onClick={convertType}
            className="inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
            title={
              isNote
                ? "Convert this note into a task"
                : "Convert this task into a note"
            }
          >
            <ArrowLeftRight className="h-3 w-3" />
            {isNote ? "To task" : "To note"}
          </button>
          <button
            type="button"
            onClick={cancel}
            className="rounded-md border border-border bg-background px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={save}
            disabled={!dirty || !(draft.description || "").trim()}
            className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Check className="h-3 w-3" />
            Save changes
          </button>
        </div>
      </div>

      {/* Two columns */}
      <div className="flex min-h-0 flex-1">
        {/* Left: all fields */}
        <div className="w-[380px] shrink-0 overflow-y-auto border-r border-border px-5 py-5 lg:w-[440px]">
          <ObjectEditFields
            draft={draft}
            setDraft={setDraft}
            update={update}
            isNote={isNote}
            projects={projects}
            persons={persons}
            contexts={contexts}
            tags={tags}
            sortedUrgencies={sortedUrgencies}
            isProjectShared={isProjectShared}
          />
        </div>

        {/* Right: details editor only, capped to the maximized-editor width */}
        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-5 py-5">
          <div className="mx-auto flex min-h-0 w-full max-w-3xl flex-1 flex-col">
            <ObjectDetailsEditor
              value={draft.details ?? ""}
              onChange={(val) => update("details", val)}
              fillHeight
            />
          </div>
        </div>
      </div>
    </div>
  )
}
