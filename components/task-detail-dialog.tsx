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
  mode?: "view" | "edit"
  onModeChange?: (mode: "view" | "edit") => void
  portalContainer?: HTMLElement | null
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
  mode = "view",
  onModeChange,
  portalContainer,
}: TaskDetailDialogProps) {
  const isMobile = useIsMobile()
  const tabObject = useOpenObjectFullScreen()

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
    handleToggleTask,
  } = useObjectDraft({
    task,
    projects,
    urgencies,
    onUpdate,
    onClose: () => onOpenChange(false),
  })

  const descriptionRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (open && draft?.description === "New task") {
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

  const canExpand = !isMobile && !!tabObject && !!task
  function expand() {
    if (!task || !tabObject) return
    tabObject.openObjectFullScreen(task.id, "edit")
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

        {mode === "view" ? (
          <>
            {/* View Mode Header */}
            <div className="flex flex-wrap items-center gap-2 border-b border-border bg-card px-5 py-3 md:gap-3">
              {isNote ? (
                <div className="inline-flex items-center gap-1.5 rounded-full border border-primary/20 bg-primary/10 px-2.5 py-1 text-xs font-semibold leading-none text-primary">
                  <FileText className="h-3 w-3" />
                  Note
                </div>
              ) : (
                <>
                  <div className={cn(
                    "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold leading-none",
                    draft.status === "Done"
                      ? "border-emerald-500/25 bg-emerald-500/10 text-emerald-500"
                      : "border-blue-500/25 bg-blue-500/10 text-blue-500"
                  )}>
                    <span className="h-1.5 w-1.5 rounded-full bg-current" />
                    {draft.status === "Done" ? "Done" : "Open"}
                  </div>

                  <div className={cn(
                    "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold leading-none",
                    draft.processed
                      ? "border-primary/20 bg-primary/10 text-primary"
                      : "border-amber-500/25 bg-amber-500/10 text-amber-500"
                  )}>
                    <span className="h-1.5 w-1.5 rounded-full bg-current" />
                    {draft.processed ? "Processed" : "Inbox"}
                  </div>

                  {urgency && (
                    <span
                      className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background px-2.5 py-1 text-xs font-mono uppercase tracking-wider text-muted-foreground"
                    >
                      <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: urgency.color }} />
                      {urgency.name}
                    </span>
                  )}
                </>
              )}

              <span className="ml-auto font-mono text-[10px] text-muted-foreground hidden sm:inline-block">
                Created {created.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}
              </span>

              {canExpand && (
                <button
                  type="button"
                  onClick={expand}
                  className="ml-2 rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                  aria-label="Expand to full screen"
                  title="Expand to full screen"
                >
                  <Maximize2 className="h-4 w-4" />
                </button>
              )}

              <button
                type="button"
                onClick={cancel}
                className={cn(
                  "rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
                  !isMobile && !canExpand && "ml-2"
                )}
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* View Mode Body */}
            <div className={cn("overflow-y-auto px-5 py-5 space-y-5", isMobile ? "flex-1" : "max-h-[70vh]")}>
              {/* Description */}
              <div className="space-y-1">
                <h1 className="text-lg font-bold tracking-tight text-foreground leading-snug break-words">
                  {draft.description}
                </h1>
                {isMobile && (
                  <div className="font-mono text-[10px] text-muted-foreground pt-1">
                    Created {created.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}
                  </div>
                )}
              </div>

              {/* Properties Grid - Only renders assigned attributes */}
              {((draft.project_id) || (draft.person_id) || (!isNote && draft.show_on) || (draft.action_date) || (!isNote && draft.context_ids && draft.context_ids.length > 0) || (isNote && draft.tag_ids && draft.tag_ids.length > 0)) && (
                <div className="grid grid-cols-[120px_1fr] gap-y-3 gap-x-4 rounded-xl border border-border/40 bg-muted/10 p-4 items-center">
                  {/* Project */}
                  {selectedProject && (
                    <>
                      <Label icon={<FolderKanban className="h-3 w-3" />}>Project</Label>
                      <div className="text-xs font-semibold text-foreground bg-background border border-border/30 rounded-lg px-2.5 py-1.5 inline-block justify-self-start">
                        {selectedProject.name}
                      </div>
                    </>
                  )}

                  {/* Person */}
                  {draft.person_id && (
                    (() => {
                      const assignedPerson = persons.find(p => p.id === draft.person_id);
                      return assignedPerson ? (
                        <>
                          <Label icon={<User className="h-3 w-3" />}>Person</Label>
                          <div className="inline-flex items-center gap-1.5 bg-background border border-border/30 rounded-lg px-2.5 py-1.5 justify-self-start">
                            <span
                              className="flex h-4 w-4 items-center justify-center rounded-full text-[8px] font-bold text-foreground"
                              style={{
                                backgroundColor: `color-mix(in oklch, ${assignedPerson.color} 30%, transparent)`,
                              }}
                            >
                              {assignedPerson.initials}
                            </span>
                            <span className="text-xs font-semibold text-foreground leading-none">{assignedPerson.name}</span>
                          </div>
                        </>
                      ) : null;
                    })()
                  )}

                  {/* Show on */}
                  {!isNote && draft.show_on && (
                    <>
                      <Label icon={<Calendar className="h-3 w-3" />}>Show on</Label>
                      <div className="text-xs font-semibold text-foreground bg-background border border-border/30 rounded-lg px-2.5 py-1.5 inline-block font-mono justify-self-start">
                        {new Date(draft.show_on).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" })}
                      </div>
                    </>
                  )}

                  {/* Action date (tasks) / Date Override (notes) */}
                  {draft.action_date && (
                    <>
                      <Label icon={<Calendar className="h-3 w-3" />}>{isNote ? "Date Override" : "Action date"}</Label>
                      <div className="text-xs font-semibold text-foreground bg-background border border-border/30 rounded-lg px-2.5 py-1.5 inline-block font-mono justify-self-start">
                        {new Date(draft.action_date).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" })}
                      </div>
                    </>
                  )}

                  {/* Contexts (tasks only) */}
                  {!isNote && draft.context_ids && draft.context_ids.length > 0 && (
                    <>
                      <div className="self-start pt-1.5">
                        <Label icon={<Tag className="h-3 w-3" />}>Contexts</Label>
                      </div>
                      <div className="flex flex-wrap gap-1.5 justify-self-start">
                        {draft.context_ids.map((cid) => {
                          const ctx = contexts.find(c => c.id === cid);
                          if (!ctx) return null;
                          return (
                            <span
                              key={ctx.id}
                              className="inline-flex items-center gap-1.5 rounded-full border border-primary/20 bg-primary/5 px-2.5 py-1 text-xs font-medium text-primary"
                            >
                              <span
                                className="h-1.5 w-1.5 rounded-full"
                                style={{ backgroundColor: ctx.color }}
                              />
                              {ctx.name}
                            </span>
                          )
                        })}
                      </div>
                    </>
                  )}

                  {/* Tags (notes only) */}
                  {isNote && draft.tag_ids && draft.tag_ids.length > 0 && (
                    <>
                      <div className="self-start pt-1.5">
                        <Label icon={<Tag className="h-3 w-3" />}>Tags</Label>
                      </div>
                      <div className="flex flex-wrap gap-1.5 justify-self-start">
                        {draft.tag_ids.map((tid) => {
                          const tg = tags.find(t => t.id === tid);
                          if (!tg) return null;
                          return (
                            <span
                              key={tg.id}
                              className="inline-flex items-center gap-1.5 rounded-full border border-primary/20 bg-primary/5 px-2.5 py-1 text-xs font-medium text-primary"
                            >
                              <span
                                className="h-1.5 w-1.5 rounded-full"
                                style={{ backgroundColor: tg.color }}
                              />
                              {tg.name}
                            </span>
                          )
                        })}
                      </div>
                    </>
                  )}
                </div>
              )}

              {/* Details */}
              {draft.details && (
                <div className="space-y-2 border-t border-border/40 pt-4">
                  <Label icon={<FileText className="h-3 w-3" />}>Details</Label>
                  <div className="rounded-xl border border-border/30 bg-muted/5 p-4 text-xs leading-relaxed text-foreground/90 font-sans break-words shadow-sm">
                    {renderMarkdown(draft.details, handleToggleTask)}
                  </div>
                </div>
              )}
            </div>

            {/* View Mode Footer */}
            <div className="flex items-center justify-between border-t border-border bg-background/40 px-5 py-3">
              <span className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider hidden sm:inline-block">
                {isNote ? "View note" : "View task"}
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={convertType}
                  className="inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-4 py-2.5 text-sm text-muted-foreground transition-colors hover:text-foreground md:px-3 md:py-1.5 md:text-xs"
                  title={isNote ? "Convert this note into a task" : "Convert this task into a note"}
                >
                  <ArrowLeftRight className="h-3 w-3" />
                  {isNote ? "To task" : "To note"}
                </button>
                <button
                  type="button"
                  onClick={cancel}
                  className="rounded-md border border-border bg-background px-4 py-2.5 text-sm text-muted-foreground transition-colors hover:text-foreground md:px-3 md:py-1.5 md:text-xs"
                >
                  Close
                </button>
                <button
                  type="button"
                  onClick={() => onModeChange?.("edit")}
                  className="inline-flex items-center gap-1.5 rounded-md bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 md:px-3 md:py-1.5 md:text-xs"
                >
                  <Pencil className="h-3 w-3" />
                  {isNote ? "Edit note" : "Edit task"}
                </button>
              </div>
            </div>
          </>
        ) : (
          <>
            {/* Edit Mode Header */}
            <div className="flex items-center gap-3 border-b border-border bg-card px-5 py-3">
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
                      "inline-flex items-center gap-2 rounded-md border px-3 py-2 text-sm transition-colors md:px-2.5 md:py-1 md:text-xs",
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
                      "inline-flex items-center gap-2 rounded-md border px-3 py-2 text-sm transition-colors md:px-2.5 md:py-1 md:text-xs",
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

                  <span
                    className="inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-2 py-1 font-mono text-[10px] uppercase tracking-wider text-muted-foreground"
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

              <span className="ml-auto font-mono text-[10px] text-muted-foreground hidden sm:inline-block">
                Created {created.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}
              </span>
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
              <button
                type="button"
                onClick={cancel}
                className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Edit Mode Body */}
            <div className={cn("overflow-y-auto px-5 py-5", isMobile ? "flex-1" : "max-h-[70vh]")}>
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
              />

              <div className="mt-5">
                <ObjectDetailsEditor
                  value={draft.details ?? ""}
                  onChange={(val) => update("details", val)}
                />
              </div>
            </div>

            {/* Edit Mode Footer */}
            <div className={cn(
              "flex items-center gap-3 border-t border-border bg-background/40 px-5 py-3",
              isMobile ? "justify-end" : "justify-between"
            )}>
              {!isMobile && (
                <span className="font-mono text-[10px] text-muted-foreground">
                  <span className="mr-2 inline-block h-1.5 w-1.5 rounded-full bg-primary align-middle" />
                  Edits write to IndexedDB instantly
                </span>
              )}
              <div className="flex items-center gap-2">
                {task && !task.processed && !draft.processed && (
                  <label className="flex items-center gap-1.5 mr-2 cursor-pointer text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
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
                  className="inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-4 py-2.5 text-sm text-muted-foreground transition-colors hover:text-foreground md:px-3 md:py-1.5 md:text-xs"
                  title={isNote ? "Convert this note into a task" : "Convert this task into a note"}
                >
                  <ArrowLeftRight className="h-3 w-3" />
                  {isNote ? "To task" : "To note"}
                </button>
                <button
                  type="button"
                  onClick={cancel}
                  className="rounded-md border border-border bg-background px-4 py-2.5 text-sm text-muted-foreground transition-colors hover:text-foreground md:px-3 md:py-1.5 md:text-xs"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={save}
                  disabled={!dirty || !(draft.description || "").trim()}
                  className="inline-flex items-center gap-1.5 rounded-md bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-40 md:px-3 md:py-1.5 md:text-xs"
                >
                  <Check className="h-3 w-3" />
                  {isMobile ? "Save" : "Save changes"}
                </button>
              </div>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
