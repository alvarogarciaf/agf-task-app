"use client"

import { useEffect, useState } from "react"
import {
  AlertCircle,
  Calendar,
  Check,
  CircleCheck,
  Circle,
  FileText,
  FolderKanban,
  Tag,
  User,
  X,
  Zap,
} from "lucide-react"
import { cn } from "@/lib/utils"
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import type { Context, Person, Project, Task, UrgencyLevel } from "@/lib/types"

interface TaskDetailDialogProps {
  task: Task | null
  open: boolean
  onOpenChange: (open: boolean) => void
  projects: Project[]
  persons: Person[]
  contexts: Context[]
  urgencies: UrgencyLevel[]
  onUpdate: (task: Task) => void
}

export function TaskDetailDialog({
  task,
  open,
  onOpenChange,
  projects,
  persons,
  contexts,
  urgencies,
  onUpdate,
}: TaskDetailDialogProps) {
  function getFullPlainTask(t: Task | null): Task | null {
    if (!t) return null
    return typeof (t as any).toJSON === "function" ? (t as any).toJSON() : t
  }

  const [draft, setDraft] = useState<Task | null>(getFullPlainTask(task))

  // Sync draft when a different task is opened
  useEffect(() => {
    setDraft(getFullPlainTask(task))
  }, [task])

  if (!draft) return null

  // Safely extract primitive properties for comparison to avoid RxDB circular reference errors
  function toPlain(t: Task | null) {
    if (!t) return null
    // If it's an RxDocument it usually has a toJSON method
    const data = typeof (t as any).toJSON === "function" ? (t as any).toJSON() : t
    return {
      id: data.id,
      description: data.description,
      details: data.details,
      urgency_id: data.urgency_id,
      project_id: data.project_id,
      person_id: data.person_id,
      show_on: data.show_on,
      action_date: data.action_date,
      processed: data.processed,
      context_ids: [...(data.context_ids || [])].sort(),
    }
  }

  const dirty = !!task && JSON.stringify(toPlain(draft)) !== JSON.stringify(toPlain(task))

  function update<K extends keyof Task>(key: K, value: Task[K]) {
    setDraft((prev) => (prev ? { ...prev, [key]: value } : prev))
  }

  function toggleContext(id: string) {
    setDraft((prev) => {
      if (!prev) return prev
      const currentContexts = prev.context_ids || []
      const has = currentContexts.includes(id)
      return {
        ...prev,
        context_ids: has
          ? currentContexts.filter((c) => c !== id)
          : [...currentContexts, id],
      }
    })
  }

  function save() {
    if (!draft) return
    onUpdate(draft)
    onOpenChange(false)
  }

  function cancel() {
    setDraft(getFullPlainTask(task))
    onOpenChange(false)
  }

  const urgency = urgencies.find(u => u.id === draft.urgency_id) || urgencies[0]
  const sortedUrgencies = [...urgencies].sort((a, b) => a.order - b.order)
  const created = new Date(draft.date_created)

  return (
    <Dialog open={open} onOpenChange={(o) => (o ? onOpenChange(o) : cancel())}>
      <DialogContent
        showCloseButton={false}
        className="max-w-2xl gap-0 overflow-hidden p-0 sm:rounded-xl"
      >
        <DialogTitle className="sr-only">
          {draft.description || "Edit task"}
        </DialogTitle>

        {/* Header */}
        <div className="flex items-center gap-3 border-b border-border bg-card px-5 py-3">
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

          <span className="ml-auto font-mono text-[10px] text-muted-foreground">
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

        {/* Body */}
        <div className="max-h-[70vh] overflow-y-auto px-5 py-5">
          {/* Description */}
          <div>
            <Label icon={<Zap className="h-3 w-3" />}>Description</Label>
            <Textarea
              value={draft.description}
              onChange={(e) => update("description", e.target.value)}
              placeholder="What needs to happen?"
              className="mt-1.5 min-h-[60px] resize-none border-border bg-background text-base font-medium leading-snug"
              rows={2}
            />
          </div>

          {/* Details */}
          <div className="mt-5">
            <Label icon={<FileText className="h-3 w-3" />}>Details</Label>
            <Textarea
              value={draft.details ?? ""}
              onChange={(e) =>
                update("details", e.target.value === "" ? undefined : e.target.value)
              }
              placeholder="Add notes, links, or context. Markdown supported."
              className="mt-1.5 min-h-[120px] border-border bg-background text-sm leading-relaxed"
              rows={5}
            />
          </div>

          {/* Single-column grid */}
          <div className="mt-5 grid gap-5">
            {/* Urgency */}
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

            {/* Project */}
            <div>
              <Label icon={<FolderKanban className="h-3 w-3" />}>Project</Label>
              <Select
                value={draft.project_id ?? "__none__"}
                onValueChange={(v) =>
                  update("project_id", v === "__none__" ? null : v)
                }
              >
                <SelectTrigger className="mt-1.5 w-full border-border bg-background h-11 md:h-9">
                  <SelectValue placeholder="No project" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">
                    <span className="text-muted-foreground">No project</span>
                  </SelectItem>
                  {projects.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Person */}
            <div>
              <Label icon={<User className="h-3 w-3" />}>Person</Label>
              <Select
                value={draft.person_id ?? "__none__"}
                onValueChange={(v) =>
                  update("person_id", v === "__none__" ? null : v)
                }
              >
                <SelectTrigger className="mt-1.5 w-full border-border bg-background h-11 md:h-9">
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

            {/* Show on */}
            <div>
              <Label icon={<Calendar className="h-3 w-3" />}>Show on</Label>
              <input
                type="date"
                value={toDateInputValue(draft.show_on)}
                onChange={(e) =>
                  update(
                    "show_on",
                    e.target.value === "" ? null : new Date(e.target.value).toISOString(),
                  )
                }
                className="mt-1.5 h-11 w-full rounded-md border border-border bg-background px-3 text-base focus:outline-none focus:ring-2 focus:ring-ring/40 md:h-9 md:text-sm"
              />
            </div>

            {/* Action date */}
            <div>
              <Label icon={<Calendar className="h-3 w-3" />}>Action date</Label>
              <input
                type="date"
                value={toDateInputValue(draft.action_date)}
                onChange={(e) =>
                  update(
                    "action_date",
                    e.target.value === "" ? null : new Date(e.target.value).toISOString(),
                  )
                }
                className="mt-1.5 h-11 w-full rounded-md border border-border bg-background px-3 text-base focus:outline-none focus:ring-2 focus:ring-ring/40 md:h-9 md:text-sm"
              />
            </div>
          </div>

          {/* Contexts */}
          <div className="mt-5">
            <Label icon={<Tag className="h-3 w-3" />}>
              Contexts
              <span className="ml-1.5 font-mono text-[10px] text-muted-foreground/70">
                {(draft.context_ids || []).length} selected
              </span>
            </Label>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {contexts.map((c) => {
                const selected = (draft.context_ids || []).includes(c.id)
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => toggleContext(c.id)}
                    className={cn(
                      "inline-flex items-center gap-1.5 rounded-full border px-3 py-2 text-sm transition-colors md:px-2.5 md:py-1 md:text-xs",
                      selected
                        ? "border-primary/40 bg-primary/10 text-primary"
                        : "border-border bg-background text-muted-foreground hover:text-foreground",
                    )}
                  >
                    <span
                      className="h-1.5 w-1.5 rounded-full"
                      style={{ backgroundColor: c.color }}
                    />
                    {c.name}
                    {selected ? <Check className="h-3 w-3" /> : null}
                  </button>
                )
              })}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-3 border-t border-border bg-background/40 px-5 py-3">
          <span className="font-mono text-[10px] text-muted-foreground">
            <span className="mr-2 inline-block h-1.5 w-1.5 rounded-full bg-primary align-middle" />
            Edits write to IndexedDB instantly
          </span>
          <div className="flex items-center gap-2">
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
              Save changes
            </button>
          </div>
        </div>
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

function toDateInputValue(iso?: string | null): string {
  if (!iso) return ""
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ""
  // Format as YYYY-MM-DD in local time
  const yyyy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, "0")
  const dd = String(d.getDate()).padStart(2, "0")
  return `${yyyy}-${mm}-${dd}`
}
