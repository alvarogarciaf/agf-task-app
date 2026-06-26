"use client"

import React, { useEffect, useState, useRef } from "react"
import {
  Calendar,
  FileText,
  FolderKanban,
  Lock,
  Tag,
  User,
  Zap,
} from "lucide-react"
import * as SliderPrimitive from "@radix-ui/react-slider"
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

/**
 * Step-slider for urgency levels. Displays:
 * - Urgency name + color dot above the track
 * - Numbered ticks (1 = lowest on left, N = highest on right)
 * - Track fill and thumb tinted to the urgency's brand color
 */
function UrgencySlider({
  urgencies,
  value,
  onChange,
}: {
  urgencies: UrgencyLevel[]
  value: string
  onChange: (id: string) => void
}) {
  const n = urgencies.length
  if (n === 0) return null

  // Reverse for display: most urgent ends up at the right (highest number).
  // The original `urgencies` array is not mutated.
  const display = [...urgencies].reverse()

  const currentIdx = display.findIndex((u) => u.id === value)
  const safeIdx = currentIdx === -1 ? 0 : currentIdx
  const current = display[safeIdx]

  // Slider value: 1-based so ticks read 1…N, with N = most urgent (right)
  const sliderVal = safeIdx + 1

  function handleChange([val]: number[]) {
    const u = display[val - 1]
    if (u) onChange(u.id)
  }

  return (
    <div className="mt-1.5 select-none">
      {/* Name row */}
      <div className="mb-3 flex items-center gap-1.5">
        <span
          className="h-2 w-2 shrink-0 rounded-full transition-colors duration-200"
          style={{ backgroundColor: current.color }}
        />
        <span className="text-sm font-semibold text-foreground transition-all duration-200">
          {current.name}
        </span>
        <span className="ml-auto font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
          {sliderVal} / {n}
        </span>
      </div>

      {/* Slider + ticks */}
      <div className="relative px-2">
        <SliderPrimitive.Root
          min={1}
          max={n}
          step={1}
          value={[sliderVal]}
          onValueChange={handleChange}
          className="relative flex h-5 w-full touch-none items-center select-none"
          aria-label="Urgency"
        >
          <SliderPrimitive.Track className="relative h-1.5 w-full grow overflow-hidden rounded-full bg-muted">
            <SliderPrimitive.Range
              className="absolute h-full rounded-full transition-colors duration-200"
              style={{ backgroundColor: current.color }}
            />
          </SliderPrimitive.Track>
          <SliderPrimitive.Thumb
            className="block h-5 w-5 rounded-full border-2 bg-background shadow-md ring-0 transition-all duration-200 hover:scale-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50"
            style={{ borderColor: current.color }}
          />
        </SliderPrimitive.Root>

        {/* Tick numbers below the track */}
        <div className="mt-1.5 flex items-center justify-between">
          {display.map((u, i) => (
            <button
              key={u.id}
              type="button"
              onClick={() => onChange(u.id)}
              className={cn(
                "flex h-5 w-5 items-center justify-center rounded-full font-mono text-[11px] font-medium transition-all duration-150",
                i === safeIdx
                  ? "scale-110 text-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
              style={i === safeIdx ? { color: current.color } : undefined}
              aria-label={u.name}
            >
              {i + 1}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

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
  autosave,
}: {
  task: Task | null
  projects: Project[]
  urgencies: UrgencyLevel[]
  onUpdate: (task: Task) => void
  onClose: () => void
  autosave?: boolean
}) {
  const [draft, setDraft] = useState<Task | null>(getFullPlainTask(task))
  const [autoProcess, setAutoProcess] = useState(false)
  const [autosaveStatus, setAutosaveStatus] = useState<"idle" | "saving" | "saved">("idle")
  
  const prevDetailsRef = useRef(task?.details)
  const prevDescriptionRef = useRef(task?.description)
  const isTypingRef = useRef(false)

  useEffect(() => {
    const fullPlain = getFullPlainTask(task)
    if (!fullPlain) {
      setDraft(null)
      return
    }
    if (fullPlain.project_id) {
      const proj = projects.find((p) => p.id === fullPlain.project_id)
      if (proj && proj.linked_person_id) {
        fullPlain.person_id = proj.linked_person_id
      }
    }
    
    setDraft((prev) => {
      // If we are currently typing text fields in autosave mode, preserve the draft's text fields
      // to avoid incoming database updates (e.g. from other fields syncing) overwriting the text.
      if (prev && prev.id === fullPlain.id && autosave && isTypingRef.current) {
        return { ...fullPlain, details: prev.details, description: prev.description }
      }
      
      // If we're not actively typing, we are accepting the incoming DB state.
      // Update the refs so we don't trigger a fake autosave loop.
      prevDetailsRef.current = fullPlain.details
      prevDescriptionRef.current = fullPlain.description
      return fullPlain
    })

    setAutoProcess((prev) => {
      if (task && !task.processed) return true
      return false
    })
  }, [task, projects, autosave])

  const sortedUrgencies = [...urgencies].sort((a, b) => a.order - b.order)

  const isAutoProcessing =
    !!task && !task.processed && autoProcess && !!draft && !draft.processed
  const dirty =
    !!task &&
    !!draft &&
    (JSON.stringify(toPlain(draft)) !== JSON.stringify(toPlain(task)) ||
      isAutoProcessing)

  // Debounce text fields autosave (details & description)
  useEffect(() => {
    if (!autosave || !draft) return
    const detailsChanged = draft.details !== prevDetailsRef.current
    const descChanged = draft.description !== prevDescriptionRef.current

    if (detailsChanged || descChanged) {
      isTypingRef.current = true
      setAutosaveStatus("idle") // Revert from "saved" so user knows it's pending
      
      const timer = setTimeout(() => {
        setAutosaveStatus("saving")
        onUpdate({ ...draft, processed: isAutoProcessing ? true : draft.processed })
        setAutosaveStatus("saved")
        prevDetailsRef.current = draft.details
        prevDescriptionRef.current = draft.description
        isTypingRef.current = false
      }, 3000)
      
      return () => clearTimeout(timer)
    }
  }, [draft?.details, draft?.description, autosave, isAutoProcessing, onUpdate])

  function update<K extends keyof Task>(key: K, value: Task[K]) {
    setDraft((prev) => {
      if (!prev) return prev
      const next = { ...prev, [key]: value }
      
      // Immediately autosave non-text fields. Text fields are debounced.
      if (autosave && key !== "details" && key !== "description") {
        onUpdate({ ...next, processed: isAutoProcessing ? true : next.processed })
        setAutosaveStatus("saved")
      }
      
      return next
    })
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
    autosaveStatus,
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
  detailsRef,
  onSubmit,
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
  detailsRef?: React.RefObject<HTMLDivElement | null>
  onSubmit?: () => void
}) {
  function focusDetails() {
    const el = detailsRef?.current?.querySelector<HTMLElement>('[contenteditable]')
    el?.focus()
  }

  return (
    <>
      <div>
        <Label icon={<Zap className="h-3 w-3" />}>Description</Label>
        <Textarea
          ref={descriptionRef}
          value={draft.description}
          onChange={(e) => {
            // Strip newlines so the field stays single-line
            const cleaned = e.target.value.replace(/[\r\n]/g, "")
            update("description", cleaned)
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault()
              if (onSubmit) onSubmit()
            } else if (e.key === "Tab") {
              e.preventDefault()
              focusDetails()
            }
          }}
          placeholder="Enter a title or description"
          className="mt-1.5 resize-none border-border bg-background text-base font-medium leading-snug"
          rows={1}
        />
      </div>

      <div className="mt-5 grid gap-5">
        {!isNote && (
          <div>
            <Label icon={<Zap className="h-3 w-3" />}>Urgency</Label>
            <UrgencySlider
              urgencies={sortedUrgencies}
              value={draft.urgency_id}
              onChange={(id) => update("urgency_id", id)}
            />
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
                icon: c.icon,
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
                <SelectItem value="__none__" className="py-3 md:py-1.5">
                  <span className="text-muted-foreground">No one</span>
                </SelectItem>
                {persons.map((p) => (
                  <SelectItem key={p.id} value={p.id} className="py-3 md:py-1.5">
                    <span className="flex items-center gap-2">
                      <span
                        className="flex h-5 w-5 items-center justify-center rounded-full text-[9px] font-semibold shrink-0"
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
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label icon={<Calendar className="h-3 w-3" />}>Show on</Label>
              <FormDateField
                value={draft.show_on}
                onChange={(iso) => update("show_on", iso)}
              />
            </div>

            <div>
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
  containerRef,
}: {
  value: string
  onChange: (val: string | undefined) => void
  className?: string
  editorClassName?: string
  fillHeight?: boolean
  containerRef?: React.RefObject<HTMLDivElement | null>
}) {
  return (
    <div ref={containerRef} className={cn(fillHeight && "flex min-h-0 flex-1 flex-col", className)}>
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
