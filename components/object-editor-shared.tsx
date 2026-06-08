"use client"

import React, { useEffect, useState } from "react"
import {
  AlertCircle,
  Calendar,
  FileText,
  FolderKanban,
  Lock,
  Tag,
  User,
  Zap,
} from "lucide-react"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import { Textarea } from "@/components/ui/textarea"
import { RichMarkdownEditor } from "@/components/rich-markdown-editor"
import { toggleMarkdownTask } from "@/lib/markdown"
import { FormMultiSelect } from "@/components/form-multi-select"
import { FormDateField } from "@/components/form-date-field"
import { ProjectSelect } from "@/components/project-select"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import type {
  Context,
  ObjectType,
  Person,
  Project,
  Tag as TagType,
  Task,
  UrgencyLevel,
} from "@/lib/types"

export function Label({
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

function getFullPlainTask(t: Task | null): Task | null {
  if (!t) return null
  return typeof (t as any).toJSON === "function" ? (t as any).toJSON() : t
}

function toPlain(t: Task | null) {
  if (!t) return null
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

/**
 * Shared draft state + persistence logic for editing a task/note. Used by both
 * the modal (`TaskDetailDialog`) and the desktop full-screen editor so they
 * stay behaviorally identical. `onClose` lets each caller decide what "done"
 * means (close the modal vs. go back to the previous screen).
 */
export function useObjectDraft({
  task,
  projects,
  urgencies,
  onUpdate,
  onClose,
}: {
  task: Task | null
  projects: Project[]
  urgencies: UrgencyLevel[]
  onUpdate: (task: Task) => void
  onClose: () => void
}) {
  const [draft, setDraft] = useState<Task | null>(getFullPlainTask(task))
  const [autoProcess, setAutoProcess] = useState(false)

  useEffect(() => {
    const fullPlain = getFullPlainTask(task)
    if (fullPlain && fullPlain.project_id) {
      const proj = projects.find((p) => p.id === fullPlain.project_id)
      if (proj && proj.linked_person_id) {
        fullPlain.person_id = proj.linked_person_id
      }
    }
    setDraft(fullPlain)
    setAutoProcess(task && !task.processed ? true : false)
  }, [task, projects])

  const sortedUrgencies = [...urgencies].sort((a, b) => a.order - b.order)

  const isAutoProcessing =
    !!task && !task.processed && autoProcess && !!draft && !draft.processed
  const dirty =
    !!task &&
    !!draft &&
    (JSON.stringify(toPlain(draft)) !== JSON.stringify(toPlain(task)) ||
      isAutoProcessing)

  function update<K extends keyof Task>(key: K, value: Task[K]) {
    setDraft((prev) => (prev ? { ...prev, [key]: value } : prev))
  }

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
    if (isAutoProcessing) finalDraft.processed = true
    onUpdate(finalDraft)
    onClose()
  }

  function cancel() {
    setDraft(getFullPlainTask(task))
    onClose()
  }

  function convertType() {
    if (!draft) return
    const nextType: ObjectType = draft.type === "note" ? "task" : "note"
    const converted: Task = { ...draft, type: nextType }
    if (isAutoProcessing) converted.processed = true
    if (nextType === "task") {
      if (!converted.urgency_id) {
        converted.urgency_id = sortedUrgencies[0]?.id ?? urgencies[0]?.id
      }
      if (converted.status !== "Open" && converted.status !== "Done") {
        converted.status = "Open"
      }
    }
    onUpdate(converted)
    toast.success(
      nextType === "note" ? "Converted to Note" : "Converted to Task",
    )
    onClose()
  }

  return {
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
    getFullPlainTask,
  }
}

/**
 * All editable fields EXCEPT the Details editor. Rendered as a vertical stack;
 * the parent decides the surrounding layout (single column in the modal,
 * left column in full-screen).
 */
export function ObjectEditFields({
  draft,
  setDraft,
  update,
  isNote,
  projects,
  persons,
  contexts,
  tags,
  sortedUrgencies,
  isProjectShared,
  descriptionRef,
}: {
  draft: Task
  setDraft: React.Dispatch<React.SetStateAction<Task | null>>
  update: <K extends keyof Task>(key: K, value: Task[K]) => void
  isNote: boolean
  projects: Project[]
  persons: Person[]
  contexts: Context[]
  tags: TagType[]
  sortedUrgencies: UrgencyLevel[]
  isProjectShared: boolean
  descriptionRef?: React.Ref<HTMLTextAreaElement>
}) {
  return (
    <>
      <div>
        <Label icon={<Zap className="h-3 w-3" />}>Description</Label>
        <Textarea
          ref={descriptionRef}
          value={draft.description}
          onChange={(e) => update("description", e.target.value)}
          placeholder="Enter a title or description"
          className="mt-1.5 min-h-[60px] resize-none border-border bg-background text-base font-medium leading-snug"
          rows={2}
        />
      </div>

      <div className="mt-5 grid gap-5">
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
                {sortedUrgencies.map((u) => (
                  <SelectItem key={u.id} value={u.id}>
                    <span className="flex items-center gap-2">
                      <span
                        className="h-1.5 w-1.5 rounded-full"
                        style={{ backgroundColor: u.color }}
                      />
                      {u.name}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

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

        <div className="flex flex-wrap gap-4">
          <div className="flex-1 min-w-[200px]">
            <Label icon={<FolderKanban className="h-3 w-3" />}>Project</Label>
            <ProjectSelect
              projects={projects}
              value={draft.project_id ?? null}
              placeholder="No project"
              noneLabel="No project"
              className="mt-0"
              triggerClassName="mt-1.5"
              onChange={(projId) => {
                const proj = projId
                  ? projects.find((p) => p.id === projId)
                  : null
                if (proj?.linked_person_id) {
                  setDraft((prev) =>
                    prev
                      ? {
                          ...prev,
                          project_id: projId,
                          person_id: proj.linked_person_id,
                        }
                      : null,
                  )
                } else {
                  setDraft((prev) =>
                    prev ? { ...prev, project_id: projId } : null,
                  )
                }
              }}
            />
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
              <SelectTrigger
                className={cn(
                  "mt-1.5 w-full border-border bg-background h-11 md:h-9",
                  isProjectShared &&
                    "opacity-80 cursor-not-allowed bg-muted/20",
                )}
              >
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

        {isNote && (
          <div className="flex flex-wrap gap-4">
            <div className="flex-1 min-w-[200px]">
              <Label icon={<Calendar className="h-3 w-3" />}>
                Date Override
              </Label>
              <FormDateField
                value={draft.action_date}
                onChange={(iso) => update("action_date", iso)}
              />
            </div>
          </div>
        )}
      </div>
    </>
  )
}

/** The Details editor block (label + rich markdown editor). */
export function ObjectDetailsEditor({
  value,
  onChange,
  className,
  editorClassName,
  fillHeight = false,
}: {
  value: string
  onChange: (val: string | undefined) => void
  className?: string
  editorClassName?: string
  fillHeight?: boolean
}) {
  return (
    <div className={cn(fillHeight && "flex min-h-0 flex-1 flex-col", className)}>
      <Label icon={<FileText className="h-3 w-3" />}>Details</Label>
      <RichMarkdownEditor
        value={value}
        onChange={(val) => onChange(val === "" ? undefined : val)}
        placeholder="Add notes, links, or context. Markdown supported."
        className={cn(fillHeight && "mt-1.5 flex min-h-0 flex-1 flex-col", editorClassName)}
      />
    </div>
  )
}
