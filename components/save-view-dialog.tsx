"use client"

import * as React from "react"
import { useState, useEffect } from "react"
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Check, X, Star, Filter, SlidersHorizontal } from "lucide-react"
import { cn } from "@/lib/utils"
import { COLOR_PALETTE, ICONS } from "@/lib/constants"
import { IconPicker } from "@/components/icon-picker"
import { FormMultiSelect } from "@/components/form-multi-select"
import { ProjectSelect } from "@/components/project-select"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import type { Context, Person, Project, SavedView } from "@/lib/types"

interface SaveViewDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSave: (data: Partial<SavedView>) => void
  editingView?: SavedView | null
  initialFilters?: Partial<SavedView>
  contexts?: Context[]
  projects?: Project[]
  persons?: Person[]
}

export function SaveViewDialog({
  open,
  onOpenChange,
  onSave,
  editingView,
  initialFilters,
  contexts = [],
  projects = [],
  persons = [],
}: SaveViewDialogProps) {
  const [activeTab, setActiveTab] = useState<"general" | "filters">("general")
  const [name, setName] = useState("")
  const [icon, setIcon] = useState("Star")
  const [color, setColor] = useState(COLOR_PALETTE[0])
  const [showStatus, setShowStatus] = useState<"all" | "open" | "done">("open")
  const [contextIds, setContextIds] = useState<string[]>([])
  const [filterMode, setFilterMode] = useState<"and" | "or">("and")
  const [projectId, setProjectId] = useState<string | null>(null)
  const [personId, setPersonId] = useState<string | null>(null)
  const [isGroupedByProject, setIsGroupedByProject] = useState(false)
  const [showHiddenByShowOn, setShowHiddenByShowOn] = useState(false)
  const [sortKey, setSortKey] = useState("urgency")
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc")

  useEffect(() => {
    const src = editingView || initialFilters
    if (src) {
      if (editingView) {
        setName(editingView.name)
        setIcon(editingView.icon || "Star")
        setColor(editingView.color || COLOR_PALETTE[0])
      } else {
        setName("")
        setIcon("Star")
        setColor(COLOR_PALETTE[0])
      }
      setShowStatus(src.show_status || "open")
      setContextIds(src.context_ids || [])
      setFilterMode(src.filter_mode || "and")
      setProjectId(src.project_id ?? null)
      setPersonId(src.person_id ?? null)
      setIsGroupedByProject(src.is_grouped_by_project || false)
      setShowHiddenByShowOn(src.show_hidden_by_show_on || false)
      setSortKey(src.sort_key || "urgency")
      setSortDirection(src.sort_direction || "asc")
    } else {
      setName("")
      setIcon("Star")
      setColor(COLOR_PALETTE[0])
      setShowStatus("open")
      setContextIds([])
      setFilterMode("and")
      setProjectId(null)
      setPersonId(null)
      setIsGroupedByProject(false)
      setShowHiddenByShowOn(false)
      setSortKey("urgency")
      setSortDirection("asc")
    }
    setActiveTab("general")
  }, [editingView, initialFilters, open])

  const handleSave = () => {
    if (name.trim()) {
      onSave({
        name: name.trim(),
        icon,
        color,
        show_status: showStatus,
        context_ids: contextIds,
        filter_mode: filterMode,
        project_id: projectId,
        person_id: personId,
        is_grouped_by_project: isGroupedByProject,
        show_hidden_by_show_on: showHiddenByShowOn,
        sort_key: sortKey,
        sort_direction: sortDirection,
      })
      onOpenChange(false)
    }
  }

  const SelectedIcon = ICONS[icon] || Star

  const activeFiltersCount =
    (showStatus !== "open" ? 1 : 0) +
    (contextIds.length > 0 ? 1 : 0) +
    (projectId ? 1 : 0) +
    (personId ? 1 : 0) +
    (isGroupedByProject ? 1 : 0) +
    (showHiddenByShowOn ? 1 : 0) +
    (sortKey !== "urgency" || sortDirection !== "asc" ? 1 : 0)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent showCloseButton={false} className="max-w-lg gap-0 overflow-hidden p-0 sm:rounded-xl">
        <DialogTitle className="sr-only">{editingView ? "Edit view" : "Save current view"}</DialogTitle>

        {/* Header */}
        <div className="flex items-center justify-between border-b border-border bg-card px-5 py-3">
          <div className="flex items-center gap-2.5">
            <div
              className="flex h-8 w-8 items-center justify-center rounded-md"
              style={{
                backgroundColor: `color-mix(in oklch, ${color} 15%, transparent)`,
                color: color,
              }}
            >
              <SelectedIcon className="h-4 w-4" />
            </div>
            <span className="text-sm font-semibold">{editingView ? "Edit Saved View" : "New Saved View"}</span>
          </div>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="w-full">
          <div className="px-5 pt-3 border-b border-border bg-card/40">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="general" className="gap-1.5 text-xs">
                <SlidersHorizontal className="h-3.5 w-3.5" />
                General
              </TabsTrigger>
              <TabsTrigger value="filters" className="gap-1.5 text-xs">
                <Filter className="h-3.5 w-3.5" />
                Filters &amp; Display
                {activeFiltersCount > 0 && (
                  <span className="ml-1 rounded-full bg-primary/20 text-primary px-1.5 py-0.2 text-[10px] font-semibold">
                    {activeFiltersCount}
                  </span>
                )}
              </TabsTrigger>
            </TabsList>
          </div>

          <div className="px-5 py-4 max-h-[60vh] overflow-y-auto">
            <TabsContent value="general" className="space-y-5 mt-0">
              {/* Name */}
              <div>
                <label className="flex items-center gap-1.5 font-mono text-xs uppercase tracking-wider text-muted-foreground mb-1.5">
                  Name
                </label>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="h-10 w-full md:h-9"
                  placeholder="e.g., Focus Mode, Work Projects..."
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleSave()
                  }}
                  autoFocus
                />
              </div>

              {/* Icon picker */}
              <div>
                <label className="flex items-center gap-1.5 font-mono text-xs uppercase tracking-wider text-muted-foreground mb-2">
                  Icon
                </label>
                <IconPicker value={icon} onChange={setIcon} />
              </div>

              {/* Color picker */}
              <div>
                <label className="flex items-center gap-1.5 font-mono text-xs uppercase tracking-wider text-muted-foreground mb-2">
                  Color
                </label>
                <div className="flex flex-wrap gap-2">
                  {COLOR_PALETTE.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setColor(c)}
                      className={cn(
                        "h-8 w-8 rounded-full border-2 transition-all",
                        color === c
                          ? "border-foreground scale-110 shadow-sm"
                          : "border-transparent hover:scale-110"
                      )}
                      style={{ backgroundColor: c }}
                      aria-label={c}
                    />
                  ))}
                </div>
              </div>
            </TabsContent>

            <TabsContent value="filters" className="space-y-4.5 mt-0">
              {/* Status Segmented Control */}
              <div>
                <label className="block text-xs font-mono uppercase tracking-wider text-muted-foreground mb-1.5">
                  Status
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {(["all", "open", "done"] as const).map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setShowStatus(s)}
                      className={cn(
                        "h-9 rounded-md border text-xs font-medium transition-all cursor-pointer",
                        showStatus === s
                          ? "border-primary bg-primary/10 text-primary font-semibold shadow-xs"
                          : "border-border bg-background text-muted-foreground hover:bg-muted"
                      )}
                    >
                      {s === "all" ? "All" : s === "open" ? "Open" : "Done"}
                    </button>
                  ))}
                </div>
              </div>

              {/* Contexts */}
              <div>
                <label className="block text-xs font-mono uppercase tracking-wider text-muted-foreground mb-1.5">
                  Contexts
                </label>
                <FormMultiSelect
                  options={contexts.map((c) => ({ id: c.id, label: c.name, color: c.color, icon: c.icon }))}
                  selectedIds={contextIds}
                  onChange={setContextIds}
                  placeholder="All contexts"
                />
              </div>

              {/* Multiple filters match (AND / OR) */}
              {contextIds.length > 1 && (
                <div>
                  <label className="block text-xs font-mono uppercase tracking-wider text-muted-foreground mb-1.5">
                    Multiple Contexts Match
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setFilterMode("and")}
                      className={cn(
                        "h-8 rounded-md border text-xs font-medium transition-all cursor-pointer",
                        filterMode === "and"
                          ? "border-primary bg-primary/10 text-primary font-semibold shadow-xs"
                          : "border-border bg-background text-muted-foreground hover:bg-muted"
                      )}
                    >
                      Match all (AND)
                    </button>
                    <button
                      type="button"
                      onClick={() => setFilterMode("or")}
                      className={cn(
                        "h-8 rounded-md border text-xs font-medium transition-all cursor-pointer",
                        filterMode === "or"
                          ? "border-primary bg-primary/10 text-primary font-semibold shadow-xs"
                          : "border-border bg-background text-muted-foreground hover:bg-muted"
                      )}
                    >
                      Match any (OR)
                    </button>
                  </div>
                </div>
              )}

              {/* Project Select */}
              <div>
                <label className="block text-xs font-mono uppercase tracking-wider text-muted-foreground mb-1.5">
                  Project
                </label>
                <ProjectSelect
                  projects={projects}
                  value={projectId}
                  noneLabel="All projects"
                  placeholder="All projects"
                  className="mt-0"
                  onChange={setProjectId}
                />
              </div>

              {/* Person Select */}
              <div>
                <label className="block text-xs font-mono uppercase tracking-wider text-muted-foreground mb-1.5">
                  Person
                </label>
                <Select
                  value={personId ?? "__none__"}
                  onValueChange={(v) => setPersonId(v === "__none__" ? null : v)}
                >
                  <SelectTrigger className="w-full border-border bg-background h-9 text-xs">
                    <SelectValue placeholder="All people" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">
                      <span className="text-muted-foreground">All people</span>
                    </SelectItem>
                    {persons.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        <span className="flex items-center gap-2">
                          <span
                            className="flex h-4 w-4 items-center justify-center rounded-full text-[10px] font-semibold shrink-0"
                            style={{ backgroundColor: `color-mix(in oklch, ${p.color} 30%, transparent)` }}
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

              {/* Sorting */}
              <div>
                <label className="block text-xs font-mono uppercase tracking-wider text-muted-foreground mb-1.5">
                  Sorting
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <Select value={sortKey} onValueChange={setSortKey}>
                    <SelectTrigger className="w-full border-border bg-background h-9 text-xs">
                      <SelectValue placeholder="Sort by" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="urgency">Urgency</SelectItem>
                      <SelectItem value="date_created">Date Created</SelectItem>
                      <SelectItem value="description">Description</SelectItem>
                      <SelectItem value="action_date">Action Date</SelectItem>
                      <SelectItem value="show_on">Show on Date</SelectItem>
                    </SelectContent>
                  </Select>

                  <Select value={sortDirection} onValueChange={(v) => setSortDirection(v as "asc" | "desc")}>
                    <SelectTrigger className="w-full border-border bg-background h-9 text-xs">
                      <SelectValue placeholder="Direction" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="asc">Ascending</SelectItem>
                      <SelectItem value="desc">Descending</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Display Options */}
              <div className="space-y-3 pt-2 border-t border-border">
                <label className="block text-xs font-mono uppercase tracking-wider text-muted-foreground">
                  Display Options
                </label>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium">Group by project</span>
                  <Switch
                    checked={isGroupedByProject}
                    onCheckedChange={setIsGroupedByProject}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-xs font-medium">Show hidden by &quot;Show on&quot;</div>
                    <div className="text-[11px] text-muted-foreground">Include tasks scheduled for future dates</div>
                  </div>
                  <Switch
                    checked={showHiddenByShowOn}
                    onCheckedChange={setShowHiddenByShowOn}
                  />
                </div>
              </div>
            </TabsContent>
          </div>
        </Tabs>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 border-t border-border bg-background/40 px-5 py-3">
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button size="sm" onClick={handleSave} disabled={!name.trim()}>
            <Check className="mr-2 h-3.5 w-3.5" />
            {editingView ? "Update View" : "Save View"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
