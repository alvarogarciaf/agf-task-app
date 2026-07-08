"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { Check, ChevronDown, FolderKanban, X } from "lucide-react"
import { cn } from "@/lib/utils"
import { ICONS } from "@/lib/constants"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { useDatabase } from "@/components/db-provider"
import type { Project } from "@/lib/types"

const DEFAULT_PROJECT_ICON = "Layers"

export function ProjectOptionIcon({
  icon,
  color,
  size = "sm",
  plain = false,
}: {
  icon?: string | null
  color?: string | null
  size?: "sm" | "md"
  plain?: boolean
}) {
  const Icon = icon ? ICONS[icon] ?? FolderKanban : FolderKanban
  const box = size === "sm" ? "h-5 w-5 rounded" : "h-6 w-6 rounded-md"
  const glyph = size === "sm" ? "h-3 w-3" : "h-3.5 w-3.5"

  if (plain) {
    return <Icon className={cn("shrink-0", glyph)} />
  }

  return (
    <div
      className={cn("flex shrink-0 items-center justify-center", box)}
      style={
        color
          ? {
              backgroundColor: `color-mix(in oklch, ${color} 15%, transparent)`,
              color: color,
              boxShadow: `inset 0 0 0 1px color-mix(in oklch, ${color} 30%, transparent)`,
            }
          : undefined
      }
    >
      <Icon className={cn(glyph, !color && "text-primary")} />
    </div>
  )
}

export function ProjectChip({
  project,
  className,
}: {
  project: Pick<Project, "name" | "icon" | "color">
  className?: string
}) {
  return (
    <span
      className={cn(
        "inline-flex max-w-full items-center gap-1 rounded border px-1.5 py-0.5 text-[11px]",
        !project.color && "border-border bg-background text-muted-foreground",
        className,
      )}
      style={
        project.color
          ? {
              backgroundColor: `color-mix(in oklch, ${project.color} 12%, transparent)`,
              color: project.color,
              borderColor: `color-mix(in oklch, ${project.color} 30%, transparent)`,
            }
          : undefined
      }
    >
      <ProjectOptionIcon
        icon={project.icon ?? DEFAULT_PROJECT_ICON}
        color={project.color}
        size="sm"
        plain
      />
      <span className="truncate font-medium">{project.name}</span>
    </span>
  )
}

export function projectToSelectOption(project: Project) {
  return {
    id: project.id,
    label: project.name,
    icon: project.icon ?? DEFAULT_PROJECT_ICON,
    color: project.color,
  }
}

interface ProjectSelectProps {
  projects: Project[]
  value: string | null
  onChange: (projectId: string | null) => void
  placeholder?: string
  noneLabel?: string
  allowNone?: boolean
  variant?: "field" | "pill"
  pillLabel?: string
  className?: string
  triggerClassName?: string
  onCreateProject?: (name: string) => Promise<string | void> | string | void
}

type ListItem = {
  id: string | null
  label: string
  project: Project | null
  isCreate?: boolean
}

export function ProjectSelect({
  projects,
  value,
  onChange,
  placeholder = "Select project",
  noneLabel = "No project",
  allowNone = true,
  variant = "field",
  pillLabel = "Project",
  className,
  triggerClassName,
  onCreateProject,
}: ProjectSelectProps) {
  const db = useDatabase()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState("")
  const [highlightedIdx, setHighlightedIdx] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)

  const selected = projects.find((p) => p.id === value) ?? null

  const filtered = useMemo(
    () =>
      projects.filter((p) =>
        p.name.toLowerCase().includes(query.trim().toLowerCase()),
      ),
    [projects, query],
  )

  const items: ListItem[] = useMemo(() => {
    const list: ListItem[] = []
    const trimmed = query.trim()
    if (allowNone && !trimmed) {
      list.push({ id: null, label: noneLabel, project: null })
    }
    for (const p of filtered) {
      list.push({ id: p.id, label: p.name, project: p })
    }
    if (trimmed) {
      list.push({ id: "__create__", label: `Add "${trimmed}"`, project: null, isCreate: true })
    }
    return list
  }, [allowNone, noneLabel, filtered, query])

  useEffect(() => {
    if (open) {
      setQuery("")
      setHighlightedIdx(0)
      requestAnimationFrame(() => inputRef.current?.focus())
    }
  }, [open])

  useEffect(() => {
    setHighlightedIdx(0)
  }, [query])

  async function select(item: ListItem) {
    if (item.isCreate) {
      const trimmedName = query.trim()
      if (onCreateProject) {
        const newId = await onCreateProject(trimmedName)
        if (newId && typeof newId === "string") {
          onChange(newId)
        }
      } else if (db) {
        try {
          const newId = crypto.randomUUID()
          await db.projects.insert({
            id: newId,
            name: trimmedName,
            details: null,
            color: "#64748b",
            icon: "Folder",
            status: "Ongoing",
            linked_person_id: null,
          })
          onChange(newId)
        } catch (err) {
          console.error("[ProjectSelect] Failed to create project:", err)
        }
      }
      setOpen(false)
      return
    }
    onChange(item.id)
    setOpen(false)
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault()
      setHighlightedIdx((i) => Math.min(i + 1, items.length - 1))
    }
    if (e.key === "ArrowUp") {
      e.preventDefault()
      setHighlightedIdx((i) => Math.max(i - 1, 0))
    }
    if (e.key === "Enter") {
      e.preventDefault()
      const item = items[highlightedIdx]
      if (item) select(item)
    }
    if (e.key === "Escape") {
      e.preventDefault()
      setOpen(false)
    }
  }

  const isPill = variant === "pill"
  const isPillActive = isPill && !!selected

  const triggerClass = cn(
    isPill
      ? cn(
          "inline-flex cursor-pointer select-none items-center gap-1.5 rounded-md border px-3 py-2 text-sm transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring md:px-2.5 md:py-1 md:text-xs",
          isPillActive
            ? "border-primary bg-primary/10 text-primary shadow-sm"
            : "border-border bg-background text-foreground/80 shadow-sm hover:bg-muted hover:text-foreground hover:border-foreground/20",
        )
      : cn(
          "flex h-11 w-full items-center justify-between gap-2 rounded-md border border-border bg-background px-3 text-base transition-colors focus:outline-none focus:ring-2 focus:ring-ring/40 md:h-9 md:text-sm",
          !selected && "text-muted-foreground",
        ),
    !isPill && "mt-1.5",
    triggerClassName,
    className,
  )

  const triggerContent = (
    <>
      {isPill ? (
        <>
          <span className="font-mono text-[10px] uppercase tracking-wider">
            {pillLabel}
          </span>
          {selected ? (
            <>
              <span className="h-3 w-px bg-primary/30" />
              <ProjectOptionIcon
                icon={selected.icon ?? DEFAULT_PROJECT_ICON}
                color={selected.color}
              />
              <span className="max-w-[10rem] truncate text-foreground">
                {selected.name}
              </span>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  onChange(null)
                }}
                className="ml-0.5 rounded p-0.5 hover:bg-primary/20 transition-colors"
                aria-label="Clear project filter"
              >
                <X className="h-2.5 w-2.5" />
              </button>
            </>
          ) : null}
        </>
      ) : selected ? (
        <span className="flex min-w-0 flex-1 items-center gap-2">
          <ProjectOptionIcon
            icon={selected.icon ?? DEFAULT_PROJECT_ICON}
            color={selected.color}
          />
          <span className="truncate">{selected.name}</span>
        </span>
      ) : (
        <span className="truncate">{placeholder}</span>
      )}
      {!isPill || !selected ? (
        <ChevronDown className="h-4 w-4 shrink-0 opacity-50" />
      ) : null}
    </>
  )

  return (
    <Popover open={open} onOpenChange={setOpen} modal={false}>
      {isPill ? (
        <PopoverTrigger asChild>
          <div role="button" tabIndex={0} className={triggerClass}>
            {triggerContent}
          </div>
        </PopoverTrigger>
      ) : (
        <PopoverTrigger asChild>
          <button type="button" className={triggerClass}>
            {triggerContent}
          </button>
        </PopoverTrigger>
      )}

      <PopoverContent
        align="start"
        side="bottom"
        collisionPadding={12}
        className="z-[100] w-[var(--radix-popover-trigger-width)] overflow-hidden p-0"
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Search projects…"
          className="w-full border-b border-border bg-background px-3 py-2 text-sm outline-none placeholder:text-muted-foreground focus:ring-0"
        />
        <div 
          className="overflow-y-auto overscroll-contain touch-pan-y p-1"
          style={{ maxHeight: "min(320px, calc(var(--radix-popover-content-available-height) - 50px))", WebkitOverflowScrolling: "touch" }}
        >
          {items.length === 0 ? (
            <p className="px-3 py-2 text-sm text-muted-foreground">No projects found</p>
          ) : (
            items.map((item, idx) => {
              const isSelected = value === item.id
              const isHighlighted = idx === highlightedIdx
              return (
                <button
                  key={item.id ?? "__none__"}
                  type="button"
                  onMouseEnter={() => setHighlightedIdx(idx)}
                  onClick={() => select(item)}
                  className={cn(
                    "flex w-full items-center gap-2.5 rounded-md px-2.5 py-3 text-left text-base md:py-2 md:text-sm transition-colors",
                    isHighlighted && "bg-muted ring-1 ring-inset ring-primary/40",
                    !isHighlighted && "hover:bg-muted",
                    item.id === null && "text-muted-foreground",
                  )}
                >
                  {item.isCreate ? (
                    <ProjectOptionIcon
                      icon="Folder"
                      color="#64748b"
                    />
                  ) : item.project ? (
                    <ProjectOptionIcon
                      icon={item.project.icon ?? DEFAULT_PROJECT_ICON}
                      color={item.project.color}
                    />
                  ) : (
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded border border-dashed border-border" />
                  )}
                  <span className={cn("flex-1 truncate", item.isCreate && "text-primary font-medium")}>{item.label}</span>
                  {isSelected ? (
                    <Check className="h-4 w-4 shrink-0 text-primary" />
                  ) : null}
                </button>
              )
            })
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}
