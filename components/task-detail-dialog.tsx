"use client"

import React, { useEffect, useState, useRef } from "react"
import {
  AlertCircle,
  ArrowLeftRight,
  Calendar,
  Check,
  CircleCheck,
  Circle,
  FileText,
  FolderKanban,
  Lock,
  Tag,
  User,
  X,
  Zap,
  Pencil,
} from "lucide-react"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import { useIsMobile } from "@/hooks/use-mobile"
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"
import { RichMarkdownEditor } from "@/components/rich-markdown-editor"
import { renderMarkdown, toggleMarkdownTask } from "@/lib/markdown"
import { FormMultiSelect } from "@/components/form-multi-select"
import { FormDateField } from "@/components/form-date-field"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import type { Context, ObjectType, Person, Project, Tag as TagType, Task, UrgencyLevel } from "@/lib/types"

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
}: TaskDetailDialogProps) {
  const isMobile = useIsMobile()
  function getFullPlainTask(t: Task | null): Task | null {
    if (!t) return null
    return typeof (t as any).toJSON === "function" ? (t as any).toJSON() : t
  }

  const [draft, setDraft] = useState<Task | null>(getFullPlainTask(task))
  const [autoProcess, setAutoProcess] = useState(false)

  // Sync draft when a different task is opened
  useEffect(() => {
    const fullPlain = getFullPlainTask(task);
    if (fullPlain && fullPlain.project_id) {
      const proj = projects.find(p => p.id === fullPlain.project_id);
      if (proj && proj.linked_person_id) {
        fullPlain.person_id = proj.linked_person_id;
      }
    }
    setDraft(fullPlain)
    setAutoProcess(task && !task.processed ? true : false)
  }, [task, projects])

  const descriptionRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (open && draft?.description === "New task") {
      setDraft((prev) => (prev ? { ...prev, description: "" } : prev))
      setTimeout(() => {
        descriptionRef.current?.focus()
      }, 0)
    }
  }, [open, draft?.description])

  if (!draft) return null

  // Safely extract primitive properties for comparison to avoid RxDB circular reference errors
  function toPlain(t: Task | null) {
    if (!t) return null
    // If it's an RxDocument it usually has a toJSON method
    const data = typeof (t as any).toJSON === "function" ? (t as any).toJSON() : t
    return {
      id: data.id,
      type: data.type,
      description: data.description,
      details: data.details,
      urgency_id: data.urgency_id,
      project_id: data.project_id,
      person_id: data.person_id,
      show_on: data.show_on,
      action_date: data.action_date,
      processed: data.processed,
      status: data.status,
      context_ids: [...(data.context_ids || [])].sort(),
      tag_ids: [...(data.tag_ids || [])].sort(),
    }
  }

  const isAutoProcessing = task && !task.processed && autoProcess && !draft.processed;
  const dirty = !!task && (JSON.stringify(toPlain(draft)) !== JSON.stringify(toPlain(task)) || isAutoProcessing)

  function update<K extends keyof Task>(key: K, value: Task[K]) {
    setDraft((prev) => (prev ? { ...prev, [key]: value } : prev))
  }

  // Toggling a checkbox in the read-only details view persists immediately so
  // it works without entering edit mode.
  function handleToggleTask(taskIndex: number, checked: boolean) {
    if (!draft?.details) return
    const nextDetails = toggleMarkdownTask(draft.details, taskIndex, checked)
    const updated = { ...draft, details: nextDetails }
    setDraft(updated)
    onUpdate(updated)
  }

  function save() {
    if (!draft) return
    const finalDraft = { ...draft }
    if (isAutoProcessing) {
      finalDraft.processed = true
    }
    onUpdate(finalDraft)
    onOpenChange(false)
  }

  function cancel() {
    setDraft(getFullPlainTask(task))
    onOpenChange(false)
  }

  function convertType() {
    if (!draft) return
    const nextType: ObjectType = draft.type === "note" ? "task" : "note"
    const converted: Task = { ...draft, type: nextType }
    if (isAutoProcessing) {
      converted.processed = true
    }
    if (nextType === "task") {
      // A note may predate task invariants; ensure the object renders cleanly
      // in task views without clearing any retained note data.
      if (!converted.urgency_id) {
        converted.urgency_id = sortedUrgencies[0]?.id ?? urgencies[0]?.id
      }
      if (converted.status !== "Open" && converted.status !== "Done") {
        converted.status = "Open"
      }
    }
    onUpdate(converted)
    toast.success(nextType === "note" ? "Converted to Note" : "Converted to Task")
    onOpenChange(false)
  }

  const isNote = draft.type === "note"
  const urgency = urgencies.find(u => u.id === draft.urgency_id) || urgencies[0]
  const sortedUrgencies = [...urgencies].sort((a, b) => a.order - b.order)
  const created = new Date(draft.date_created)

  const selectedProject = draft.project_id ? projects.find(p => p.id === draft.project_id) : null;
  const isProjectShared = !!(selectedProject && selectedProject.linked_person_id);

  return (
    <Dialog open={open} onOpenChange={(o) => (o ? onOpenChange(o) : cancel())}>
      <DialogContent
        showCloseButton={false}
        overlayClassName={isMobile ? "hidden" : ""}
        className={cn(
          "gap-0 overflow-hidden p-0",
          isMobile 
            ? "fixed inset-0 z-50 flex h-full w-full max-w-none translate-x-0 translate-y-0 flex-col rounded-none border-none duration-200 shadow-none" 
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

              <button
                type="button"
                onClick={cancel}
                className={cn(
                  "rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
                  !isMobile && "ml-2"
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
              {((draft.project_id) || (draft.person_id) || (!isNote && draft.show_on) || (!isNote && draft.action_date) || (!isNote && draft.context_ids && draft.context_ids.length > 0) || (isNote && draft.tag_ids && draft.tag_ids.length > 0)) && (
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

                  {/* Action date */}
                  {!isNote && draft.action_date && (
                    <>
                      <Label icon={<Calendar className="h-3 w-3" />}>Action date</Label>
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
              {/* Description */}
              <div>
                <Label icon={<Zap className="h-3 w-3" />}>Description</Label>
                <Textarea
                  ref={descriptionRef}
                  value={draft.description}
                  onChange={(e) => update("description", e.target.value)}
                  placeholder="What needs to happen?"
                  className="mt-1.5 min-h-[60px] resize-none border-border bg-background text-base font-medium leading-snug"
                  rows={2}
                />
              </div>

              {/* Single-column grid */}
              <div className="mt-5 grid gap-5">
                {/* Urgency (tasks only) */}
                {!isNote && (
                  <div>
                    <Label icon={<AlertCircle className="h-3 w-3" />}>Urgency</Label>
                    <Select
                      value={draft.urgency_id}
                      onValueChange={(v) => update("urgency_id", v)}
                    >
                      <SelectTrigger className="mt-1.5 w-full border-border bg-background h-11 md:h-9">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {sortedUrgencies.map((u) => {
                          return (
                            <SelectItem key={u.id} value={u.id}>
                              <span className="flex items-center gap-2">
                                <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: u.color }} />
                                {u.name}
                              </span>
                            </SelectItem>
                          )
                        })}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {/* Contexts (tasks only) */}
                {!isNote && (
                  <div>
                    <Label icon={<Tag className="h-3 w-3" />}>
                      Contexts
                      <span className="ml-1.5 font-mono text-[10px] text-muted-foreground/70">
                        {(draft.context_ids || []).length} selected
                      </span>
                    </Label>
                    <FormMultiSelect
                      options={contexts.map((c) => ({
                        id: c.id,
                        label: c.name,
                        color: c.color,
                      }))}
                      selectedIds={draft.context_ids || []}
                      onChange={(ids) => update("context_ids", ids)}
                      placeholder="Select contexts"
                    />
                  </div>
                )}

                {/* Tags (notes only) */}
                {isNote && (
                  <div>
                    <Label icon={<Tag className="h-3 w-3" />}>
                      Tags
                      <span className="ml-1.5 font-mono text-[10px] text-muted-foreground/70">
                        {(draft.tag_ids || []).length} selected
                      </span>
                    </Label>
                    <FormMultiSelect
                      options={tags.map((tg) => ({
                        id: tg.id,
                        label: tg.name,
                        color: tg.color,
                      }))}
                      selectedIds={draft.tag_ids || []}
                      onChange={(ids) => update("tag_ids", ids)}
                      placeholder="Select tags"
                    />
                  </div>
                )}

                {/* Project & Person Row */}
                <div className="flex flex-wrap gap-4">
                  <div className="flex-1 min-w-[200px]">
                    <Label icon={<FolderKanban className="h-3 w-3" />}>Project</Label>
                    <Select
                      value={draft.project_id ?? "__none__"}
                      onValueChange={(v) => {
                        const projId = v === "__none__" ? null : v;
                        const proj = projId ? projects.find(p => p.id === projId) : null;
                        if (proj && proj.linked_person_id) {
                          setDraft(prev => prev ? { ...prev, project_id: projId, person_id: proj.linked_person_id } : null);
                        } else {
                          setDraft(prev => prev ? { ...prev, project_id: projId } : null);
                        }
                      }}
                    >
                      <SelectTrigger className="mt-1.5 w-full border-border bg-background h-11 md:h-9">
                        <SelectValue placeholder="No project" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem
                          value="__none__"
                          className="py-3.5 text-base md:py-1.5 md:text-sm"
                        >
                          <span className="text-muted-foreground">No project</span>
                        </SelectItem>
                        {projects.map((p) => (
                          <SelectItem
                            key={p.id}
                            value={p.id}
                            className="py-3.5 text-base md:py-1.5 md:text-sm"
                          >
                            {p.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="flex-1 min-w-[200px]">
                    <div className="flex items-center justify-between">
                      <Label icon={<User className="h-3 w-3" />}>Person</Label>
                      {isProjectShared && (
                        <span className="flex items-center gap-1 text-[10px] font-medium text-blue-500 font-mono animate-fade-in">
                          <Lock className="h-2.5 w-2.5" /> Locked
                        </span>
                      )}
                    </div>
                    <Select
                      disabled={isProjectShared}
                      value={draft.person_id ?? "__none__"}
                      onValueChange={(v) =>
                        update("person_id", v === "__none__" ? null : v)
                      }
                    >
                      <SelectTrigger className={cn("mt-1.5 w-full border-border bg-background h-11 md:h-9", isProjectShared && "opacity-80 cursor-not-allowed bg-muted/20")}>
                        <SelectValue placeholder="No one" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">
                          <span className="text-muted-foreground">No one</span>
                        </SelectItem>
                        {persons.map((p) => (
                          <SelectItem key={p.id} value={p.id}>
                            <span className="flex items-center gap-2">
                              <span
                                className="flex h-4 w-4 items-center justify-center rounded-full text-[9px] font-semibold"
                                style={{
                                  backgroundColor: `color-mix(in oklch, ${p.color} 30%, transparent)`,
                                }}
                              >
                                {p.initials}
                              </span>
                              {p.name}
                            </span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Show on & Action date Row (tasks only) */}
                {!isNote && (
                  <div className="flex flex-wrap gap-4">
                    <div className="flex-1 min-w-[200px]">
                      <Label icon={<Calendar className="h-3 w-3" />}>Show on</Label>
                      <FormDateField
                        value={draft.show_on}
                        onChange={(iso) => update("show_on", iso)}
                      />
                    </div>

                    <div className="flex-1 min-w-[200px]">
                      <Label icon={<Calendar className="h-3 w-3" />}>Action date</Label>
                      <FormDateField
                        value={draft.action_date}
                        onChange={(iso) => update("action_date", iso)}
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Details */}
              <div className="mt-5">
                <Label icon={<FileText className="h-3 w-3" />}>Details</Label>
                <RichMarkdownEditor
                  value={draft.details ?? ""}
                  onChange={(val) =>
                    update("details", val === "" ? undefined : val)
                  }
                  placeholder="Add notes, links, or context. Markdown supported."
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

function Label({
  icon,
  children,
}: {
  icon?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <label className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
      {icon}
      {children}
    </label>
  )
}
