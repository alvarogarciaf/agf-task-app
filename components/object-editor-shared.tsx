"use client"

import React, { useEffect, useState, useRef, useCallback } from "react"
import {
  Calendar,
  FileText,
  FolderKanban,
  List,
  Lock,
  Tag,
  User,
  Zap,
  ChevronDown,
  Settings2,
  Bookmark,
} from "lucide-react"
import * as SliderPrimitive from "@radix-ui/react-slider"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import { RichMarkdownEditor } from "@/components/rich-markdown-editor"
import { toggleMarkdownTask } from "@/lib/markdown"
import { FormMultiSelect } from "@/components/form-multi-select"
import { FormDateField } from "@/components/form-date-field"
import { ProjectSelect } from "@/components/project-select"
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from "@/components/ui/collapsible"
import { Switch } from "@/components/ui/switch"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import type {
  Context,
  ListItem,
  ListCategory,
  ObjectType,
  Person,
  Project,
  Tag as TagType,
  Task,
  UrgencyLevel,
} from "@/lib/types"
import { ListEditor } from "@/components/list-editor"

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
    <div className="select-none">
      {/* Name row */}
      <div className="mb-2 flex items-center justify-between">
        <Label icon={<Zap className="h-3.5 w-3.5" />}>Urgency</Label>
        <div className="flex items-center gap-1.5 font-mono text-xs uppercase tracking-wider text-muted-foreground">
          <span
            className="h-1.5 w-1.5 shrink-0 rounded-full transition-colors duration-200"
            style={{ backgroundColor: current.color }}
          />
          {current.name}
        </div>
      </div>

      {/* Slider + ticks */}
      <div className="relative px-1">
        <SliderPrimitive.Root
          min={1}
          max={n}
          step={1}
          value={[sliderVal]}
          onValueChange={handleChange}
          className="relative flex h-4 w-full touch-none items-center select-none"
          aria-label="Urgency"
        >
          <SliderPrimitive.Track className="relative h-1 w-full grow overflow-hidden rounded-full bg-muted">
            <SliderPrimitive.Range
              className="absolute h-full rounded-full transition-colors duration-200"
              style={{ backgroundColor: current.color }}
            />
          </SliderPrimitive.Track>
          <SliderPrimitive.Thumb
            className="block h-3.5 w-3.5 rounded-full border-2 bg-background shadow-sm ring-0 transition-all duration-200 hover:scale-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50"
            style={{ borderColor: current.color }}
          />
        </SliderPrimitive.Root>

        {/* Tick numbers below the track */}
        <div className="mt-1 flex items-center justify-between">
          {display.map((u, i) => (
            <button
              key={u.id}
              type="button"
              onClick={() => onChange(u.id)}
              className={cn(
                "flex h-4.5 w-4.5 items-center justify-center rounded-full font-mono text-[11px] font-medium transition-all duration-150",
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
    <label className="flex items-center gap-1.5 font-mono text-xs uppercase tracking-wider text-muted-foreground">
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
    bookmarked: data.bookmarked,
    context_ids: [...(data.context_ids || [])].sort(),
    tag_ids: [...(data.tag_ids || [])].sort(),
    is_list: data.is_list ?? null,
    list_items: data.list_items ?? null,
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
  
  // Undo / Redo history tracking
  const historyRef = useRef<Task[]>([])
  const historyIndexRef = useRef<number>(0)
  const [canUndo, setCanUndo] = useState(false)
  const [canRedo, setCanRedo] = useState(false)
  const isUndoingOrRedoingRef = useRef(false)
  const lastHistoryTimestampRef = useRef<number>(0)

  const prevDetailsRef = useRef(task?.details)
  const prevDescriptionRef = useRef(task?.description)
  const isTypingRef = useRef(false)
  const prevTaskRef = useRef(task)
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastSavedSnapshotRef = useRef<any>(toPlain(getFullPlainTask(task)))
  const loadedTaskIdRef = useRef<string | null>(task?.id ?? null)

  // Helper to push history snapshots
  const pushHistory = useCallback((newDraft: Task, isTypingText = false) => {
    if (isUndoingOrRedoingRef.current) return
    const now = Date.now()
    const stack = historyRef.current
    const currentIndex = historyIndexRef.current

    // Discard any redo branch after current pointer
    const truncated = stack.slice(0, currentIndex + 1)
    const snapshot = JSON.parse(JSON.stringify(newDraft))

    // If continuously typing text within 800ms, update the top entry
    if (isTypingText && currentIndex > 0 && now - lastHistoryTimestampRef.current < 800) {
      truncated[currentIndex] = snapshot
      historyRef.current = truncated
      lastHistoryTimestampRef.current = now
      setCanUndo(currentIndex > 0)
      setCanRedo(false)
      return
    }

    // Push new snapshot
    truncated.push(snapshot)
    if (truncated.length > 100) {
      truncated.shift()
    }
    historyRef.current = truncated
    historyIndexRef.current = truncated.length - 1
    lastHistoryTimestampRef.current = now
    setCanUndo(historyIndexRef.current > 0)
    setCanRedo(false)
  }, [])

  useEffect(() => {
    const fullPlain = getFullPlainTask(task)
    if (!fullPlain) {
      setDraft(null)
      lastSavedSnapshotRef.current = null
      prevTaskRef.current = task
      loadedTaskIdRef.current = null
      historyRef.current = []
      historyIndexRef.current = 0
      setCanUndo(false)
      setCanRedo(false)
      return
    }

    const taskChanged = task !== prevTaskRef.current
    prevTaskRef.current = task

    // If only projects changed (not the task itself), preserve the draft
    // and only update linked_person_id if the current draft project has one.
    if (!taskChanged) {
      setDraft((prev) => {
        if (!prev) return prev
        const projId = prev.project_id
        if (projId) {
          const proj = projects.find((p) => p.id === projId)
          if (proj?.linked_person_id && prev.person_id !== proj.linked_person_id) {
            return { ...prev, person_id: proj.linked_person_id }
          }
        }
        return prev
      })
      return
    }

    // Task changed — do a full draft reset
    if (fullPlain.project_id) {
      const proj = projects.find((p) => p.id === fullPlain.project_id)
      if (proj && proj.linked_person_id) {
        fullPlain.person_id = proj.linked_person_id
      }
    }
    
    const isSameTaskId = fullPlain.id === loadedTaskIdRef.current

    setDraft((prev) => {
      // If the same task ID came back from DB (e.g. after autosave), preserve the
      // current draft text AND the entire history stack. Only update non-text metadata
      // so that structural changes (project, context, etc.) still reflect.
      if (prev && isSameTaskId && autosave) {
        // Update lastSavedSnapshotRef so dirty-checking stays accurate,
        // but keep the draft text intact so the editor doesn't jump.
        lastSavedSnapshotRef.current = toPlain({ ...fullPlain, details: prev.details, description: prev.description })
        return { ...fullPlain, details: prev.details, description: prev.description }
      }
      
      // We are opening a genuinely different task — full reset.
      loadedTaskIdRef.current = fullPlain.id
      prevDetailsRef.current = fullPlain.details
      prevDescriptionRef.current = fullPlain.description
      lastSavedSnapshotRef.current = toPlain(fullPlain)

      // Initialize history stack with initial state
      historyRef.current = [JSON.parse(JSON.stringify(fullPlain))]
      historyIndexRef.current = 0
      setCanUndo(false)
      setCanRedo(false)

      return fullPlain
    })

    setAutoProcess(() => {
      return false
    })
  }, [task, projects, autosave])

  const sortedUrgencies = [...urgencies].sort((a, b) => a.order - b.order)

  function isSameTask(a: any, b: any) {
    if (!a && !b) return true
    if (!a || !b) return false
    return JSON.stringify(toPlain(a)) === JSON.stringify(toPlain(b))
  }

  const isAutoProcessing =
    !!task && !task.processed && autoProcess && !!draft && !draft.processed
  const dirty =
    !!draft &&
    (!isSameTask(draft, lastSavedSnapshotRef.current) || isAutoProcessing)

  // Debounce text fields autosave (details & description)
  useEffect(() => {
    if (!autosave || !draft) return
    const detailsChanged = draft.details !== prevDetailsRef.current
    const descChanged = draft.description !== prevDescriptionRef.current

    if (detailsChanged || descChanged) {
      isTypingRef.current = true
      setAutosaveStatus("idle") // Revert from "saved" so user knows it's pending
      
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current)
      debounceTimerRef.current = setTimeout(() => {
        setAutosaveStatus("saving")
        onUpdate({ ...draft })
        lastSavedSnapshotRef.current = toPlain(draft)
        prevDetailsRef.current = draft.details
        prevDescriptionRef.current = draft.description
        isTypingRef.current = false
        setAutosaveStatus("saved")
      }, 2500)
      
      return () => {
        if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current)
      }
    }
  }, [draft?.details, draft?.description, autosave, onUpdate])

  function update<K extends keyof Task>(key: K, value: Task[K]) {
    setDraft((prev) => {
      if (!prev) return prev
      const next = { ...prev, [key]: value }
      const isText = key === "details" || key === "description"
      pushHistory(next, isText)
      
      // Immediately autosave non-text fields. Text fields are debounced.
      // Bookmarks always autosave immediately even if autosave is false (e.g. in modal)
      if ((autosave && key !== "details" && key !== "description") || key === "bookmarked") {
        onUpdate({ ...next })
        lastSavedSnapshotRef.current = toPlain(next)
        if (autosave) setAutosaveStatus("saved")
      }
      
      return next
    })
  }

  const undo = useCallback(() => {
    if (historyIndexRef.current <= 0) return

    const newIndex = historyIndexRef.current - 1
    const target = historyRef.current[newIndex]
    if (!target) return

    isUndoingOrRedoingRef.current = true
    historyIndexRef.current = newIndex
    setCanUndo(newIndex > 0)
    setCanRedo(newIndex < historyRef.current.length - 1)

    const cloned = JSON.parse(JSON.stringify(target))
    setDraft(cloned)

    prevDetailsRef.current = cloned.details
    prevDescriptionRef.current = cloned.description

    if (autosave) {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current)
      debounceTimerRef.current = setTimeout(() => {
        onUpdate({ ...cloned })
        lastSavedSnapshotRef.current = toPlain(cloned)
        setAutosaveStatus("saved")
      }, 500)
    }

    setTimeout(() => {
      isUndoingOrRedoingRef.current = false
    }, 50)
  }, [autosave, onUpdate])

  const redo = useCallback(() => {
    if (historyIndexRef.current >= historyRef.current.length - 1) return

    const newIndex = historyIndexRef.current + 1
    const target = historyRef.current[newIndex]
    if (!target) return

    isUndoingOrRedoingRef.current = true
    historyIndexRef.current = newIndex
    setCanUndo(newIndex > 0)
    setCanRedo(newIndex < historyRef.current.length - 1)

    const cloned = JSON.parse(JSON.stringify(target))
    setDraft(cloned)

    prevDetailsRef.current = cloned.details
    prevDescriptionRef.current = cloned.description

    if (autosave) {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current)
      debounceTimerRef.current = setTimeout(() => {
        onUpdate({ ...cloned })
        lastSavedSnapshotRef.current = toPlain(cloned)
        setAutosaveStatus("saved")
      }, 500)
    }

    setTimeout(() => {
      isUndoingOrRedoingRef.current = false
    }, 50)
  }, [autosave, onUpdate])

  function handleToggleTask(taskIndex: number, checked: boolean) {
    if (!draft?.details) return
    const nextDetails = toggleMarkdownTask(draft.details, taskIndex, checked)
    const updated = { ...draft, details: nextDetails }
    pushHistory(updated, false)
    setDraft(updated)
    onUpdate(updated)
    lastSavedSnapshotRef.current = toPlain(updated)
  }

  function save() {
    if (!draft) return
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current)
      debounceTimerRef.current = null
    }
    const finalDraft = { ...draft }
    if (isAutoProcessing) finalDraft.processed = true
    lastSavedSnapshotRef.current = toPlain(finalDraft)
    prevDetailsRef.current = finalDraft.details
    prevDescriptionRef.current = finalDraft.description
    isTypingRef.current = false
    onUpdate(finalDraft)
    onClose()
  }

  function saveWithoutClose() {
    if (!draft) return
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current)
      debounceTimerRef.current = null
    }
    const finalDraft = { ...draft }
    if (isAutoProcessing) {
      finalDraft.processed = true
      setAutoProcess(false)
    }
    setDraft(finalDraft)
    lastSavedSnapshotRef.current = toPlain(finalDraft)
    prevDetailsRef.current = finalDraft.details
    prevDescriptionRef.current = finalDraft.description
    isTypingRef.current = false
    onUpdate(finalDraft)
    setAutosaveStatus("saved")
  }

  function cancel() {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current)
      debounceTimerRef.current = null
    }
    setDraft(getFullPlainTask(task))
    onClose()
  }

  function convertType() {
    if (!draft) return
    const nextType: ObjectType = draft.type === "note" ? "task" : "note"
    const converted: Task = { ...draft, type: nextType }
    if (nextType === "task") {
      if (!converted.urgency_id) {
        converted.urgency_id = sortedUrgencies[0]?.id ?? urgencies[0]?.id
      }
      if (converted.status !== "Open" && converted.status !== "Done") {
        converted.status = "Open"
      }
    }
    pushHistory(converted, false)
    setDraft(converted)
    onUpdate(converted)
    toast.success(
      nextType === "note" ? "Converted to Note" : "Converted to Task",
    )
  }

  const updateListItems = useCallback((items: ListItem[]) => {
    update("list_items", items)
  }, [update])

  const updateListCategories = useCallback((categories: ListCategory[]) => {
    update("list_categories", categories)
  }, [update])

  return {
    draft,
    setDraft,
    update,
    updateListItems,
    updateListCategories,
    dirty,
    autoProcess,
    setAutoProcess,
    sortedUrgencies,
    save,
    saveWithoutClose,
    cancel,
    convertType,
    handleToggleTask,
    getFullPlainTask,
    autosaveStatus,
    undo,
    redo,
    canUndo,
    canRedo,
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
  isMobile,
  defaultPropertiesOpen,
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
  isMobile?: boolean
  defaultPropertiesOpen?: boolean
}) {
  const [propertiesOpen, setPropertiesOpen] = useState(defaultPropertiesOpen ?? false)

  useEffect(() => {
    if (defaultPropertiesOpen !== undefined) {
      setPropertiesOpen(defaultPropertiesOpen)
    }
  }, [defaultPropertiesOpen, draft.id])

  function focusDetails() {
    const el = detailsRef?.current?.querySelector<HTMLElement>('[contenteditable]')
    el?.focus()
  }

  const propertiesContent = (
    <div className={cn("grid gap-5", !isMobile && "mt-5")}>
      {!isNote && (
        <div>
          <Label icon={<Tag className="h-3.5 w-3.5" />}>
            Contexts
            <span className="ml-1.5 font-mono text-[11px] text-muted-foreground/70">
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
          <Label icon={<Tag className="h-3.5 w-3.5" />}>
            Tags
            <span className="ml-1.5 font-mono text-[11px] text-muted-foreground/70">
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
          <Label icon={<FolderKanban className="h-3.5 w-3.5" />}>Project</Label>
          <ProjectSelect
            projects={projects}
            value={draft.project_id ?? null}
            placeholder="No project"
            noneLabel="No project"
            className="mt-0"
            triggerClassName="mt-1.5"
            onChange={(projId) => {
              update("project_id", projId)
              const proj = projId
                ? projects.find((p) => p.id === projId)
                : null
              if (proj?.linked_person_id) {
                update("person_id", proj.linked_person_id)
              }
            }}
          />
        </div>

        <div className="flex-1 min-w-[200px]">
          <div className="flex items-center justify-between">
            <Label icon={<User className="h-3.5 w-3.5" />}>Person</Label>
            {isProjectShared && (
              <span className="flex items-center gap-1 text-xs font-medium text-blue-500 font-mono animate-fade-in">
                <Lock className="h-3 w-3" /> Locked
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
                      className="flex h-5 w-5 items-center justify-center rounded-full text-[11px] font-semibold shrink-0"
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
            <Label icon={<Calendar className="h-3.5 w-3.5" />}>Show on</Label>
            <FormDateField
              value={draft.show_on}
              onChange={(iso) => update("show_on", iso)}
            />
          </div>

          <div>
            <Label icon={<Calendar className="h-3.5 w-3.5" />}>Action date</Label>
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
            <Label icon={<Calendar className="h-3.5 w-3.5" />}>
              Date Override
            </Label>
            <FormDateField
              value={draft.action_date}
              onChange={(iso) => update("action_date", iso)}
            />
          </div>
        </div>
      )}

      <div>
        <Label icon={<FileText className="h-3.5 w-3.5" />}>Body Type</Label>
        <div className="mt-2 flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => update("is_list", null)}
            className={cn(
              "flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold transition-colors",
              !draft.is_list
                ? "bg-primary/15 text-primary"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            )}
          >
            Text
          </button>
          <button
            type="button"
            onClick={() => update("is_list", true)}
            className={cn(
              "flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold transition-colors",
              draft.is_list
                ? "bg-primary/15 text-primary"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            )}
          >
            List
          </button>
        </div>
      </div>
    </div>
  )

  return (
    <>
      <div className="mb-2 flex items-start gap-2">
        <textarea
          ref={descriptionRef}
          value={draft.description}
          onChange={(e) => {
            const cleaned = e.target.value.replace(/[\r\n]/g, "")
            update("description", cleaned)
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault()
              if (isNote) {
                focusDetails()
              } else {
                if (onSubmit) onSubmit()
              }
            } else if (e.key === "Tab") {
              e.preventDefault()
              focusDetails()
            }
          }}
          placeholder="Enter a title or description"
          className="w-full resize-none bg-transparent px-0 py-1 text-xl font-bold leading-snug tracking-tight text-foreground outline-none placeholder:text-muted-foreground/50"
          rows={1}
          style={{ border: "none", boxShadow: "none", fieldSizing: "content" as any }}
        />
        {isNote && (
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault()
              update("bookmarked", !draft.bookmarked)
            }}
            className={cn(
              "mt-1 p-2 rounded-md hover:bg-muted transition-colors shrink-0",
              draft.bookmarked ? "text-primary" : "text-muted-foreground"
            )}
            title={draft.bookmarked ? "Remove Bookmark" : "Add Bookmark"}
          >
            <Bookmark className="h-5 w-5" fill={draft.bookmarked ? "currentColor" : "none"} />
          </button>
        )}
      </div>

      {!isNote && (
        <div className="mt-5">
          <UrgencySlider
            urgencies={sortedUrgencies}
            value={draft.urgency_id}
            onChange={(id) => update("urgency_id", id)}
          />
        </div>
      )}



      {isMobile ? (
        <>
          <Collapsible open={propertiesOpen} onOpenChange={setPropertiesOpen} className="mt-4">
            <CollapsibleTrigger className="flex w-full items-center justify-between py-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground [&[data-state=open]>svg]:rotate-180">
              <div className="flex items-center gap-2">
                <Settings2 className="h-4 w-4" />
                Properties
              </div>
              <ChevronDown className="h-4 w-4 transition-transform duration-200" />
            </CollapsibleTrigger>
            <CollapsibleContent className="pb-4 pt-3">
              {propertiesContent}
            </CollapsibleContent>
          </Collapsible>
          <div className="border-b border-muted-foreground/25 mt-2 mb-1" />
        </>
      ) : (
        propertiesContent
      )}
    </>
  )
}

/** The Details editor block — renders a ListEditor when isListMode=true, otherwise a rich-text editor. */
export function ObjectDetailsEditor({
  value,
  onChange,
  className,
  editorClassName,
  fillHeight = false,
  containerRef,
  isListMode = false,
  listItems,
  onListItemsChange,
  listCategories,
  onListCategoriesChange,
}: {
  value: string
  onChange: (val: string | undefined) => void
  className?: string
  editorClassName?: string
  fillHeight?: boolean
  containerRef?: React.RefObject<HTMLDivElement | null>
  isListMode?: boolean
  listItems?: ListItem[] | null
  onListItemsChange?: (items: ListItem[]) => void
  listCategories?: ListCategory[] | null
  onListCategoriesChange?: (categories: ListCategory[]) => void
}) {
  if (isListMode) {
    return (
      <div ref={containerRef} className={cn(fillHeight && "flex min-h-0 flex-1 flex-col", className)}>
        <ListEditor
          items={listItems ?? []}
          onChange={onListItemsChange ?? (() => {})}
          categories={listCategories ?? []}
          onCategoriesChange={onListCategoriesChange ?? (() => {})}
        />
      </div>
    )
  }

  return (
    <div ref={containerRef} className={cn(fillHeight && "flex min-h-0 flex-1 flex-col", className)}>
      <RichMarkdownEditor
        value={value}
        onChange={(val) => onChange(val === "" ? undefined : val)}
        placeholder="Add notes, links, or context. Markdown supported."
        className={cn(fillHeight && "flex min-h-0 flex-1 flex-col", editorClassName)}
        variant="ghost"
      />
    </div>
  )
}
