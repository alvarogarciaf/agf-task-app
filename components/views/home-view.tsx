"use client"

import { useEffect, useRef, useState } from "react"
import { ArrowRight, Sparkles, Tag, FolderKanban, User, Zap, Clock } from "lucide-react"
import { cn } from "@/lib/utils"
import { TaskItem } from "@/components/task-item"
import { TaskDetailDialog } from "@/components/task-detail-dialog"
import type { Context, Person, Project, Task, UrgencyLevel } from "@/lib/types"

interface HomeViewProps {
  projects: Project[]
  persons: Person[]
  contexts: Context[]
  urgencies: UrgencyLevel[]
  recent: Task[]
  onCreate: (input: {
    description: string
    contextIds: string[]
    projectId: string | null
  }) => void
  onUpdate: (task: Task) => void
}

export function HomeView({ projects, persons, contexts, urgencies, recent, onCreate, onUpdate }: HomeViewProps) {
  const [text, setText] = useState("")
  const [contextIds, setContextIds] = useState<string[]>([])
  const [projectId, setProjectId] = useState<string | null>(null)
  const [personId, setPersonId] = useState<string | null>(null)
  const [latencyMs, setLatencyMs] = useState<number | null>(null)
  const [activeTaskId, setActiveTaskId] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const activeTask = activeTaskId ? recent.find((t) => t.id === activeTaskId) ?? null : null

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  function toggleContext(id: string) {
    setContextIds((prev) => (prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]))
  }

  function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!text.trim()) return
    const start = performance.now()
    onCreate({ description: text.trim(), contextIds, projectId, personId })
    const ms = performance.now() - start
    setLatencyMs(Math.max(0.4, Math.round(ms * 10) / 10))
    setText("")
    setContextIds([])
    inputRef.current?.focus()
  }

  return (
    <div className="px-6 py-6">
      {/* Stats row */}
      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard
          label="Local writes today"
          value="247"
          hint="0 spinners shown"
          icon={<Zap className="h-3.5 w-3.5" />}
        />
        <StatCard
          label="Avg. capture latency"
          value={latencyMs ? `${latencyMs}ms` : "0.8ms"}
          hint="IndexedDB round-trip"
          icon={<Clock className="h-3.5 w-3.5" />}
          highlight={latencyMs !== null}
        />
        <StatCard label="Pending sync" value="3" hint="will push when online" />
        <StatCard label="Devices in sync" value="2" hint="laptop, phone" />
      </div>

      {/* Capture form */}
      <form
        onSubmit={submit}
        className="overflow-hidden rounded-xl border border-border bg-card shadow-sm"
      >
        <div className="flex items-center gap-2 border-b border-border bg-background/40 px-4 py-2.5">
          <Sparkles className="h-3.5 w-3.5 text-primary" />
          <span className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
            Quick capture
          </span>
          <span className="ml-auto font-mono text-[10px] text-muted-foreground">
            ↵ to save · ⌘↵ to save & open
          </span>
        </div>

        <div className="px-4 pt-5 pb-3">
          <input
            ref={inputRef}
            type="text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="What needs to happen?"
            className="w-full bg-transparent text-2xl font-medium placeholder:text-muted-foreground/60 focus:outline-none md:text-3xl"
            aria-label="New task description"
          />
        </div>

        {/* Attribute pickers */}
        <div className="grid grid-cols-1 gap-px bg-border md:grid-cols-3">
          <AttributePicker
            icon={<Tag className="h-3.5 w-3.5" />}
            label="Context"
            placeholder="Select contexts"
            multi
            options={contexts.map((c) => ({ id: c.id, label: c.name, color: c.color }))}
            selectedIds={contextIds}
            onToggle={toggleContext}
          />
          <AttributePicker
            icon={<FolderKanban className="h-3.5 w-3.5" />}
            label="Project"
            placeholder="No project"
            options={projects.map((p) => ({ id: p.id, label: p.name }))}
            selectedIds={projectId ? [projectId] : []}
            onToggle={(id) => setProjectId((prev) => (prev === id ? null : id))}
          />
          <AttributePicker
            icon={<User className="h-3.5 w-3.5" />}
            label="Person"
            placeholder="No one"
            options={persons.map((p) => ({ id: p.id, label: p.name, color: p.color }))}
            selectedIds={personId ? [personId] : []}
            onToggle={(id) => setPersonId((prev) => (prev === id ? null : id))}
          />
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-border bg-background/40 px-4 py-3">
          <span className="font-mono text-[10px] text-muted-foreground">
            <span className="mr-2 inline-block h-1.5 w-1.5 rounded-full bg-primary align-middle" />
            Goes to <span className="text-foreground">Inbox</span> — processed=false
          </span>
          <button
            type="submit"
            disabled={!text.trim()}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-md bg-primary px-3.5 py-1.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-40",
            )}
          >
            Capture
            <ArrowRight className="h-3.5 w-3.5" />
          </button>
        </div>
      </form>

      {/* Recently captured */}
      <section className="mt-8">
        <div className="mb-3 flex items-end justify-between">
          <div>
            <h2 className="text-sm font-semibold">Recently captured</h2>
            <p className="text-xs text-muted-foreground">
              The last few writes from this device. Live-updated by RxDB.
            </p>
          </div>
          <span className="font-mono text-[10px] text-muted-foreground">
            {recent.length} items
          </span>
        </div>

        <div className="overflow-hidden rounded-lg border border-border bg-card">
          {recent.slice(0, 5).map((task) => {
            const project = projects.find((p) => p.id === task.project_id)
            const person = persons.find((p) => p.id === task.person_id)
            const tCtx = contexts.filter((c) => (task.context_ids || []).includes(c.id))
            const urgency = urgencies.find((u) => u.id === task.urgency_id)
            return (
              <TaskItem
                key={task.id}
                task={task}
                project={project}
                person={person}
                contexts={tCtx}
                urgency={urgency}
                onClick={(t) => setActiveTaskId(t.id)}
                compact
              />
            )
          })}
        </div>
      </section>

      <TaskDetailDialog
        task={activeTask}
        open={activeTask !== null}
        onOpenChange={(o) => {
          if (!o) setActiveTaskId(null)
        }}
        projects={projects}
        persons={persons}
        contexts={contexts}
        urgencies={urgencies}
        onUpdate={onUpdate}
      />
    </div>
  )
}

function StatCard({
  label,
  value,
  hint,
  icon,
  highlight,
}: {
  label: string
  value: string
  hint?: string
  icon?: React.ReactNode
  highlight?: boolean
}) {
  return (
    <div
      className={cn(
        "rounded-lg border bg-card px-4 py-3 transition-colors",
        highlight ? "border-primary/40 bg-primary/5" : "border-border",
      )}
    >
      <div className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
        {icon}
        {label}
      </div>
      <div className="mt-1 font-mono text-xl font-medium tabular-nums">{value}</div>
      {hint ? <div className="text-[11px] text-muted-foreground">{hint}</div> : null}
    </div>
  )
}

interface AttributePickerProps {
  icon: React.ReactNode
  label: string
  placeholder: string
  options: { id: string; label: string; color?: string }[]
  selectedIds: string[]
  onToggle: (id: string) => void
  multi?: boolean
}

function AttributePicker({
  icon,
  label,
  placeholder,
  options,
  selectedIds,
  onToggle,
  multi,
}: AttributePickerProps) {
  const [open, setOpen] = useState(false)
  const selected = options.filter((o) => selectedIds.includes(o.id))

  return (
    <div className="relative bg-card">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-2 px-4 py-3 text-left text-sm hover:bg-muted/40"
      >
        <span className="text-muted-foreground">{icon}</span>
        <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
          {label}
        </span>
        <span className="ml-auto flex max-w-[55%] flex-wrap items-center justify-end gap-1 truncate">
          {selected.length === 0 ? (
            <span className="text-muted-foreground">{placeholder}</span>
          ) : (
            selected.map((s) => (
              <span
                key={s.id}
                className="inline-flex items-center gap-1 rounded border border-border bg-background px-1.5 py-0.5 text-[11px]"
              >
                {s.color ? (
                  <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: s.color }} />
                ) : null}
                {s.label}
              </span>
            ))
          )}
        </span>
      </button>

      {open ? (
        <div className="absolute left-2 right-2 top-full z-10 mt-1 max-h-64 overflow-auto rounded-md border border-border bg-popover p-1 shadow-lg">
          {options.map((opt) => {
            const isSel = selectedIds.includes(opt.id)
            return (
              <button
                key={opt.id}
                type="button"
                onClick={() => {
                  onToggle(opt.id)
                  if (!multi) setOpen(false)
                }}
                className={cn(
                  "flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm hover:bg-muted",
                  isSel && "bg-muted",
                )}
              >
                {opt.color ? (
                  <span
                    className="h-2 w-2 rounded-full"
                    style={{ backgroundColor: opt.color }}
                  />
                ) : (
                  <span className="h-2 w-2 rounded-full bg-muted-foreground/40" />
                )}
                <span className="flex-1 truncate">{opt.label}</span>
                {isSel ? <span className="font-mono text-[10px] text-primary">✓</span> : null}
              </button>
            )
          })}
        </div>
      ) : null}
    </div>
  )
}
