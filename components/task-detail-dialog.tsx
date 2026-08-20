"use client"

import React, { useEffect, useRef } from "react"
import {
  ArrowLeftRight,
  Calendar,
  Check,
  CircleCheck,
  Circle,
  FileText,
  FolderKanban,
  Maximize2,
  Tag,
  User,
  X,
  Pencil,
  Trash2,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { useIsMobile } from "@/hooks/use-mobile"
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog"
import { renderMarkdown } from "@/lib/markdown"
import {
  Label,
  ObjectEditFields,
  ObjectDetailsEditor,
  useObjectDraft,
} from "@/components/object-editor-shared"
import { useOpenObjectFullScreen } from "@/components/tab-object-context"
import type { Context, Person, Project, Tag as TagType, Task, UrgencyLevel } from "@/lib/types"

interface TaskDetailDialogProps {
  task: Task | null
  open: boolean
  onOpenChange: (open: boolean) => void
  projects: Project[]
  persons: Person[]
  contexts: Context[]
  tags?: TagType[]
  urgencies: UrgencyLevel[]
  onUpdate: (task: Task) => void
  onDelete?: (id: string) => void
  inboxMode?: boolean
  mode?: "view" | "edit"
  onModeChange?: (mode: "view" | "edit") => void
  portalContainer?: HTMLElement | null
  /** Desktop: expand into the active tab's full-screen editor (e.g. from search modal). */
  onExpandFullScreen?: (taskId: string, mode: "view" | "edit") => void
}

export function TaskDetailDialog({
  task,
  open,
  onOpenChange,
  projects,
  persons,
  contexts,
  tags = [],
  urgencies,
  onUpdate,
  onDelete,
  inboxMode,
  mode = "view",
  onModeChange,
  portalContainer,
  onExpandFullScreen,
}: TaskDetailDialogProps) {
  const isMobile = useIsMobile()
  const tabObject = useOpenObjectFullScreen()
  const expandFullScreen =
    onExpandFullScreen ?? tabObject?.openObjectFullScreen

  const {
    draft,
    setDraft,
    update,
    dirty,
    autoProcess,
    setAutoProcess,
    sortedUrgencies,
    save,
    saveWithoutClose,
    cancel,
    convertType,
    handleToggleTask,
  } = useObjectDraft({
    task,
    projects,
    urgencies,
    onUpdate,
    onClose: () => onOpenChange(false),
    autosave: true,
  })

  const handleDelete = () => {
    if (!draft || !onDelete) return
    if (window.confirm(draft.type === "note" ? "Are you sure you want to delete this note?" : "Are you sure you want to delete this task?")) {
      onDelete(draft.id)
      onOpenChange(false)
    }
  }

  const descriptionRef = useRef<HTMLTextAreaElement>(null)
  const detailsRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (open && (draft?.description === "New task" || draft?.description === "New note")) {
      setDraft((prev) => (prev ? { ...prev, description: "" } : prev))
      setTimeout(() => {
        descriptionRef.current?.focus()
      }, 0)
    }
  }, [open, draft?.description])

  // Press E in view mode to jump into edit (e.g. after opening from search).
  useEffect(() => {
    const switchToEdit = onModeChange
    if (!open || mode !== "view" || !switchToEdit) return
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key.toLowerCase() !== "e") return
      if (e.metaKey || e.ctrlKey || e.altKey) return
      const target = e.target as HTMLElement
      if (
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target instanceof HTMLSelectElement ||
        target.isContentEditable ||
        target.closest("[contenteditable]")
      ) {
        return
      }
      e.preventDefault()
      if (switchToEdit) switchToEdit("edit")
    }
    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [open, mode, onModeChange])

  if (!draft) return null

  const canExpand = !isMobile && !!expandFullScreen && !!task
  function expand() {
    if (!task || !expandFullScreen) return
    save()
    expandFullScreen(task.id, "edit")
    onOpenChange(false)
  }

  const isNote = draft.type === "note"
  const urgency = urgencies.find(u => u.id === draft.urgency_id) || urgencies[0]
  const created = new Date(draft.date_created)

  const selectedProject = draft.project_id ? projects.find(p => p.id === draft.project_id) : null;
  const isProjectShared = !!(selectedProject && selectedProject.linked_person_id);

  return (
    <Dialog open={open} onOpenChange={(o) => (o ? onOpenChange(o) : cancel())}>
      <DialogContent
        showCloseButton={false}
        portalContainer={isMobile ? null : portalContainer}
        disableTabPortal={!!portalContainer}
        overlayClassName={isMobile ? "hidden" : ""}
        className={cn(
          "gap-0 overflow-hidden p-0",
          isMobile 
            ? "fixed inset-0 z-50 flex h-full w-full max-w-none translate-x-0 translate-y-0 flex-col rounded-none border-none duration-200 shadow-none" 
            : portalContainer
              ? "max-h-[calc(100%-2rem)] max-w-2xl sm:rounded-lg"
              : "max-w-2xl sm:rounded-lg"
        )}
      >
        <DialogTitle className="sr-only">
          {draft.description || "Task details"}
        </DialogTitle>

        <>
            {/* Edit Mode Header */}
            <div className="flex items-center gap-2 sm:gap-3 border-b border-border bg-card px-4 md:px-5 py-3">
              {isNote ? (
                <div className="inline-flex items-center gap-1.5 rounded-md border border-primary/20 bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary shrink-0">
                  <FileText className="h-3.5 w-3.5" />
                  Note
                </div>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => update("processed", !draft.processed)}
                    className={cn(
                      "inline-flex items-center gap-2 rounded-md border px-3 py-2 text-sm transition-colors shrink-0 md:px-2.5 md:py-1 md:text-xs whitespace-nowrap",
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
                    onClick={() => update("status", draft.status === "Open" ? "Done" : "Open")}
                    className={cn(
                      "inline-flex items-center gap-2 rounded-md border px-3 py-2 text-sm transition-colors shrink-0 md:px-2.5 md:py-1 md:text-xs whitespace-nowrap",
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
                    {draft.status === "Done" ? "Mark as undone" : "Mark as done"}
                  </button>

                  <span
                    className="inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-2 py-1 font-mono text-xs uppercase tracking-wider text-muted-foreground shrink-0 whitespace-nowrap"
                  >
                    {urgency ? (
                      <>
                        <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: urgency.color }} />
                        {urgency.name}
                      </>
                    ) : "No urgency"}
                  </span>
                </>
              )}

              <div className="ml-auto flex items-center gap-1 shrink-0">
                {canExpand && (
                  <button
                    type="button"
                    onClick={expand}
                    className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                    aria-label="Expand to full screen"
                    title="Expand to full screen"
                  >
                    <Maximize2 className="h-4 w-4" />
                  </button>
                )}
                {onDelete && (
                  <button
                    type="button"
                    onClick={handleDelete}
                    className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive active:scale-95"
                    aria-label={isNote ? "Delete note" : "Delete task"}
                    title={isNote ? "Delete note" : "Delete task"}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
                <button
                  type="button"
                  onClick={cancel}
                  className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                  aria-label="Close"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Edit Mode Body */}
            <div className={cn("overflow-y-auto px-4 py-4 md:px-5 md:py-5", isMobile ? "flex-1" : "max-h-[70vh]")}>
              <div className="mb-3 flex items-center justify-between text-xs font-mono text-muted-foreground">
                <span>
                  Created {created.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}
                </span>
              </div>

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
                descriptionRef={descriptionRef}
                detailsRef={detailsRef}
                isMobile={isMobile}
                defaultPropertiesOpen={inboxMode}
                onSubmit={save}
              />

              <div className="mt-5">
                <ObjectDetailsEditor
                  value={draft.details ?? ""}
                  onChange={(val) => update("details", val)}
                  containerRef={detailsRef}
                />
              </div>
            </div>

            {/* Edit Mode Footer */}
            <div 
              className="flex items-center justify-between border-t border-border bg-background/40 px-4 md:px-5 pt-3 transition-[padding] duration-200"
              style={{ paddingBottom: "calc(0.75rem + var(--keyboard-toolbar-height, 0px))" }}
            >
              <div className="flex items-center">
                {task && !task.processed && !draft.processed && (
                  <label className="flex items-center gap-1.5 cursor-pointer text-sm font-medium text-muted-foreground hover:text-foreground transition-colors whitespace-nowrap">
                    <input
                      type="checkbox"
                      checked={autoProcess}
                      onChange={(e) => setAutoProcess(e.target.checked)}
                      className="h-3.5 w-3.5 rounded border-border bg-background accent-primary"
                    />
                    Processed
                  </label>
                )}
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={convertType}
                  className="inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-4 py-2.5 text-sm text-muted-foreground transition-colors hover:text-foreground md:px-3 md:py-1.5 md:text-xs whitespace-nowrap"
                  title={isNote ? "Convert this note into a task" : "Convert this task into a note"}
                >
                  <ArrowLeftRight className="h-3 w-3" />
                  {isNote ? "To task" : "To note"}
                </button>
                {onDelete && (
                  <button
                    type="button"
                    onClick={handleDelete}
                    className="inline-flex items-center gap-1.5 rounded-md border border-destructive/30 bg-destructive/10 px-3.5 py-2.5 text-sm font-medium text-destructive transition-colors hover:bg-destructive/20 md:px-2.5 md:py-1.5 md:text-xs whitespace-nowrap"
                    title={isNote ? "Delete note" : "Delete task"}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    <span className="hidden sm:inline">Delete</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={cancel}
                  className="rounded-md border border-border bg-background px-4 py-2.5 text-sm text-muted-foreground transition-colors hover:text-foreground md:px-3 md:py-1.5 md:text-xs whitespace-nowrap"
                >
                  Close
                </button>
                <button
                  type="button"
                  onClick={saveWithoutClose}
                  disabled={!dirty || !(draft.description || "").trim()}
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-md px-4 py-2.5 text-sm font-medium transition-colors md:px-3.5 md:py-1.5 md:text-xs whitespace-nowrap",
                    dirty
                      ? "bg-primary text-primary-foreground hover:bg-primary/90 shadow-xs"
                      : "bg-muted text-muted-foreground border border-border/40 cursor-not-allowed opacity-60"
                  )}
                >
                  <Check className="h-3.5 w-3.5" />
                  {dirty ? "Save now" : "Saved"}
                </button>
              </div>
            </div>
          </>
      </DialogContent>
    </Dialog>
  )
}
