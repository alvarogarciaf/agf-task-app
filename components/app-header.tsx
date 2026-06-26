"use client"

import { useState, useRef, useEffect, useMemo } from "react"
import { Search, Command, Settings, Menu, Users, Tags, Tag as TagIcon, AlertCircle, Calendar, Trash2, Info, Bell, Circle, CheckCircle2, FolderKanban, ListChecks, FileText, Plus } from "lucide-react"
import { UserMenu } from "@/components/user-menu"
import type { TabToolbarState } from "@/components/tab-toolbar-context"
import type { ViewKey, Task, Project, Person, Context, Tag, UrgencyLevel } from "@/lib/types"
import type { SyncStatus } from "./db-provider"
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog"
import { TaskDetailDialog } from "./task-detail-dialog"
import { Cloud, CloudOff } from "lucide-react"
import { 
  Drawer, 
  DrawerContent, 
  DrawerHeader, 
  DrawerTitle, 
  DrawerTrigger, 
  DrawerClose 
} from "@/components/ui/drawer"
import type { TabKey } from "./views/settings-view"
import { cn } from "@/lib/utils"
import { markdownToPlainText } from "@/lib/markdown"

const TITLES: Record<ViewKey, string> = {
  home: "Inbox",
  inbox: "Inbox",
  all: "All Tasks",
  contexts: "Contexts",
  persons: "People",
  projects: "Projects",
  settings: "Settings",
  "saved-view": "Saved View",
  today: "Today",
  notes: "Notes",
  tags: "Tags",
}

interface AppHeaderProps {
  view: ViewKey
  savedViewName?: string | null
  onNavigate?: (view: ViewKey, savedViewId?: string, settingsTab?: TabKey) => void
  user?: { uid: string; displayName: string | null; email: string | null; photoURL?: string | null } | null
  onSignOut?: () => void
  syncStatus?: SyncStatus
  tasks?: Task[]
  notes?: Task[]
  projects?: Project[]
  persons?: Person[]
  contexts?: Context[]
  tags?: Tag[]
  urgencies?: UrgencyLevel[]
  onUpdateTask?: (task: Task) => void
  desktopTabs?: boolean
  tabBar?: React.ReactNode
  tabToolbar?: TabToolbarState
  tabPortalContainer?: HTMLElement | null
  onExpandFullScreen?: (taskId: string, mode: "view" | "edit") => void
  mobileCenterContent?: React.ReactNode
}

export function AppHeader({
  view,
  savedViewName,
  onNavigate,
  user,
  onSignOut,
  syncStatus,
  tasks = [],
  notes = [],
  projects = [],
  persons = [],
  contexts = [],
  tags = [],
  urgencies = [],
  onUpdateTask,
  desktopTabs = false,
  tabBar,
  tabToolbar,
  tabPortalContainer = null,
  onExpandFullScreen,
  mobileCenterContent,
}: AppHeaderProps) {
  const title = view === "saved-view" ? savedViewName || "Saved View" : TITLES[view]
  const [drawerOpen, setDrawerOpen] = useState(false)

  const [searchOpen, setSearchOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [searchScope, setSearchScope] = useState<"tasks" | "notes" | "all">("tasks")
  const [activeTask, setActiveTask] = useState<Task | null>(null)
  const [detailMode, setDetailMode] = useState<"view" | "edit">("view")
  const [highlightedIdx, setHighlightedIdx] = useState(0)

  const searchInputRef = useRef<HTMLInputElement>(null)
  const resultRefs = useRef<(HTMLDivElement | null)[]>([])

  // Listen for global keyboard shortcut (Cmd+K / Ctrl+K) and custom open event
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault()
        setSearchOpen((o) => !o)
      }
    }
    const handleOpenSearch = () => setSearchOpen(true)
    
    document.addEventListener("keydown", handleKeyDown)
    window.addEventListener("open-search", handleOpenSearch)
    
    return () => {
      document.removeEventListener("keydown", handleKeyDown)
      window.removeEventListener("open-search", handleOpenSearch)
    }
  }, [])

  // Focus input when modal opens, clear query when it closes.
  // Default the search scope to match where it was opened from: Notes screens
  // search notes first, everything else searches tasks first.
  useEffect(() => {
    if (searchOpen) {
      setSearchScope(view === "notes" || view === "tags" ? "notes" : "tasks")
      setTimeout(() => {
        searchInputRef.current?.focus()
      }, 80)
    } else {
      setSearchQuery("")
    }
  }, [searchOpen, view])

  // Filter objects by case-insensitive query matches in description or details,
  // scoped to tasks, notes, or both.
  const filteredResults = useMemo(() => {
    const q = searchQuery.toLowerCase().trim()
    if (!q) return []
    const pool =
      searchScope === "tasks" ? tasks : searchScope === "notes" ? notes : [...tasks, ...notes]
    return pool.filter((t) => {
      const desc = t.description?.toLowerCase() || ""
      const det = t.details?.toLowerCase() || ""
      return desc.includes(q) || det.includes(q)
    })
  }, [searchQuery, searchScope, tasks, notes])

  useEffect(() => {
    setHighlightedIdx(0)
  }, [searchQuery, searchScope, filteredResults.length])

  useEffect(() => {
    resultRefs.current[highlightedIdx]?.scrollIntoView({ block: "nearest" })
  }, [highlightedIdx])

  function openSearchResult(task: Task) {
    setActiveTask(task)
    setDetailMode("view")
    setSearchOpen(false)
  }

  const scopeOptions: { key: "tasks" | "notes" | "all"; label: string }[] = [
    { key: "tasks", label: "Tasks" },
    { key: "notes", label: "Notes" },
    { key: "all", label: "All" },
  ]

  const settingsOptions: { key: TabKey; label: string; icon: any }[] = [
    { key: "contexts", label: "Contexts", icon: Tags },
    { key: "tags", label: "Tags", icon: TagIcon },
    { key: "calendar", label: "Calendar", icon: Calendar },
    { key: "data", label: "Data Management", icon: Trash2 },
    { key: "notifications", label: "Notifications", icon: Bell },
    { key: "troubleshoot", label: "Sync & Debug", icon: Info },
  ]

  // Browse destinations relocated from the mobile bottom bar into the hamburger menu.
  const browseOptions: { key: ViewKey; label: string; icon: any }[] = [
    { key: "all", label: "All Tasks", icon: ListChecks },
    { key: "notes", label: "Notes", icon: FileText },
    { key: "projects", label: "Projects", icon: FolderKanban },
    { key: "contexts", label: "Contexts", icon: Tags },
    { key: "tags", label: "Tags", icon: TagIcon },
    { key: "persons", label: "People", icon: Users },
  ]

  return (
    <header className="pt-safe border-b border-border bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div
        className={cn(
          "flex items-center gap-3 px-3 md:px-4",
          desktopTabs ? "h-12" : "h-14 justify-between md:px-6",
        )}
      >
        {desktopTabs && tabBar ? (
          <div className="flex min-w-0 flex-1 items-stretch gap-3 self-stretch">
            {tabBar}
          </div>
        ) : null}

        <div className={cn("flex items-center gap-2", !desktopTabs && "min-w-0")}>
          {/* Mobile: Hamburger Drawer */}
          <div className="md:hidden">
            <Drawer open={drawerOpen} onOpenChange={setDrawerOpen} direction="left">
              <DrawerTrigger asChild>
                <button
                  type="button"
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                  aria-label="Menu"
                >
                  <Menu className="h-5 w-5" />
                </button>
              </DrawerTrigger>
              <DrawerContent className="h-full w-[280px]">
                <DrawerHeader className="border-b border-border">
                  <DrawerTitle className="text-left font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                    Menu
                  </DrawerTitle>
                </DrawerHeader>
                <div className="flex flex-col overflow-y-auto py-2">
                  <div className="px-4 pt-2 pb-1 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                    Browse
                  </div>
                  {browseOptions.map((opt) => (
                    <button
                      key={opt.key}
                      onClick={() => {
                        onNavigate?.(opt.key)
                        setDrawerOpen(false)
                      }}
                      className="flex items-center gap-3 px-4 py-3 text-sm font-medium text-foreground transition-colors hover:bg-muted active:bg-muted"
                    >
                      <opt.icon className="h-4.5 w-4.5 text-muted-foreground" />
                      {opt.label}
                    </button>
                  ))}

                  <div className="mt-2 border-t border-border px-4 pt-3 pb-1 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                    Settings
                  </div>
                  {settingsOptions.map((opt) => (
                    <button
                      key={opt.key}
                      onClick={() => {
                        onNavigate?.("settings", undefined, opt.key)
                        setDrawerOpen(false)
                      }}
                      className="flex items-center gap-3 px-4 py-3 text-sm font-medium text-foreground transition-colors hover:bg-muted active:bg-muted"
                    >
                      <opt.icon className="h-4.5 w-4.5 text-muted-foreground" />
                      {opt.label}
                    </button>
                  ))}
                </div>
              </DrawerContent>
            </Drawer>
          </div>
          {/* Mobile Center Content (Tabs) */}
          {!desktopTabs && mobileCenterContent && (
            <div className="absolute left-1/2 -translate-x-1/2 flex items-center justify-center">
              {mobileCenterContent}
            </div>
          )}

          {/* Section title (desktop only uses tab labels, mobile uses the separate title row now) */}
        </div>

        {/* Right side controls */}
        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={() => setSearchOpen(true)}
            className="hidden h-10 items-center gap-2 rounded-md border border-border bg-card px-3 text-sm text-muted-foreground transition-all hover:bg-muted active:scale-[0.98] md:flex md:h-8 md:text-xs"
          >
            <Search className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Search…</span>
            <span className="ml-2 hidden items-center gap-1 font-mono text-[10px] sm:flex">
              <Command className="h-3 w-3" />K
            </span>
          </button>

          {desktopTabs && tabToolbar?.canAdd && tabToolbar.onAdd && (
            <button
              type="button"
              onClick={tabToolbar.onAdd}
              className="hidden items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/90 md:inline-flex"
            >
              <Plus className="h-3.5 w-3.5" />
              {tabToolbar.addLabel}
            </button>
          )}

          {/* Avatar (mobile only; desktop uses sidebar) */}
          <div className="md:hidden">
            <UserMenu user={user} onSignOut={onSignOut} syncStatus={syncStatus} />
          </div>
        </div>
      </div>

      {/* Second row for Mobile Title */}
      {!desktopTabs && (
        <div className="flex items-center px-4 pb-2 md:hidden">
          <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
        </div>
      )}

      {/* Search Modal */}
      <Dialog open={searchOpen} onOpenChange={setSearchOpen}>
        <DialogContent
          disableTabPortal
          className="max-w-xl gap-0 overflow-hidden p-0 bg-card sm:rounded-xl border border-border shadow-2xl"
        >
          <DialogTitle className="sr-only">Search Tasks</DialogTitle>
          
          {/* Search Input Box */}
          <div className="flex items-center gap-3 border-b border-border px-4 py-3 bg-muted/20">
            <Search className="h-4 w-4 text-muted-foreground shrink-0" />
            <input
              ref={searchInputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => {
                if (filteredResults.length === 0) return
                if (e.key === "ArrowDown") {
                  e.preventDefault()
                  setHighlightedIdx((i) => Math.min(i + 1, filteredResults.length - 1))
                }
                if (e.key === "ArrowUp") {
                  e.preventDefault()
                  setHighlightedIdx((i) => Math.max(i - 1, 0))
                }
                if (e.key === "Enter") {
                  e.preventDefault()
                  const hit = filteredResults[highlightedIdx]
                  if (hit) openSearchResult(hit)
                }
              }}
              placeholder="Search tasks by description or details..."
              className="h-10 w-full bg-transparent text-base focus:outline-none placeholder:text-muted-foreground md:h-9 md:text-sm"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="text-xs font-medium text-muted-foreground hover:text-foreground px-1.5 py-0.5 rounded bg-muted/60 transition-colors"
              >
                Clear
              </button>
            )}
          </div>

          {/* Scope toggle: Tasks / Notes / All */}
          <div className="flex items-center gap-1 border-b border-border px-3 py-2">
            <div className="inline-flex items-center gap-0.5 rounded-md border border-border bg-muted/30 p-0.5">
              {scopeOptions.map((opt) => (
                <button
                  key={opt.key}
                  type="button"
                  onClick={() => setSearchScope(opt.key)}
                  className={`rounded px-3 py-1 text-xs font-medium transition-colors ${
                    searchScope === opt.key
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Results Area */}
          <div className="max-h-[60vh] overflow-y-auto p-2">
            {!searchQuery ? (
              <div className="flex flex-col items-center justify-center py-10 text-muted-foreground">
                <Search className="h-8 w-8 opacity-25 mb-2.5" />
                <span className="text-sm font-medium">
                  {searchScope === "notes"
                    ? "Type to search your notes"
                    : searchScope === "all"
                      ? "Type to search tasks and notes"
                      : "Type to search your tasks"}
                </span>
                <span className="text-[11px] opacity-75 mt-0.5">Searching description and details...</span>
              </div>
            ) : filteredResults.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-muted-foreground">
                <AlertCircle className="h-8 w-8 opacity-25 mb-2.5 text-destructive" />
                <span className="text-sm font-medium">No results found matching your search</span>
                <span className="text-[11px] opacity-75 mt-0.5">Check for typos or try different terms</span>
              </div>
            ) : (
              <div className="space-y-1">
                {filteredResults.map((t, idx) => {
                  const isNote = t.type === "note"
                  const project = projects.find((p) => p.id === t.project_id)
                  const taskContexts = contexts.filter((c) => t.context_ids.includes(c.id))
                  const noteTags = tags.filter((tg) => (t.tag_ids || []).includes(tg.id))
                  const isDone = t.status === "Done"
                  const isHighlighted = idx === highlightedIdx
                  const detailsPreview = t.details
                    ? markdownToPlainText(t.details)
                    : ""

                  return (
                    <div
                      key={t.id}
                      ref={(el) => {
                        resultRefs.current[idx] = el
                      }}
                      onMouseEnter={() => setHighlightedIdx(idx)}
                      onClick={() => openSearchResult(t)}
                      className={cn(
                        "group flex cursor-pointer items-start gap-3 rounded-lg p-3 transition-colors hover:bg-muted/70 active:bg-muted/90",
                        isHighlighted && "bg-muted ring-1 ring-inset ring-primary/30",
                      )}
                    >
                      {/* Leading icon */}
                      <div className="mt-0.5 shrink-0">
                        {isNote ? (
                          <FileText className="h-4.5 w-4.5 text-muted-foreground" />
                        ) : isDone ? (
                          <CheckCircle2 className="h-4.5 w-4.5 text-primary" />
                        ) : (
                          <Circle className="h-4.5 w-4.5 text-muted-foreground" />
                        )}
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0 text-left">
                        {/* Description */}
                        <div className={`text-sm font-medium leading-normal tracking-tight truncate ${!isNote && isDone ? "text-muted-foreground line-through" : "text-foreground"}`}>
                          {t.description}
                        </div>

                        {/* Details snippet */}
                        {detailsPreview && (
                          <div className="mt-0.5 text-xs text-muted-foreground/80 line-clamp-1 truncate">
                            {detailsPreview}
                          </div>
                        )}

                        {/* Tags / Badges */}
                        <div className="mt-2 flex flex-wrap items-center gap-1.5">
                          {/* Note vs Task indicator */}
                          <span className="rounded bg-muted px-1.5 py-0.5 font-sans text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                            {isNote ? "Note" : "Task"}
                          </span>

                          {/* Project Badge */}
                          {project && (
                            <span className="rounded bg-secondary/80 px-1.5 py-0.5 font-sans text-[10px] font-semibold text-secondary-foreground uppercase tracking-wider">
                              {project.name}
                            </span>
                          )}

                          {/* Contexts (tasks) or Tags (notes) */}
                          {isNote
                            ? noteTags.map((tg) => (
                                <span
                                  key={tg.id}
                                  className="rounded px-1.5 py-0.5 font-sans text-[10px] font-semibold uppercase tracking-wider"
                                  style={{
                                    backgroundColor: `color-mix(in oklch, ${tg.color} 12%, transparent)`,
                                    color: tg.color,
                                  }}
                                >
                                  {tg.name}
                                </span>
                              ))
                            : taskContexts.map((c) => (
                                <span
                                  key={c.id}
                                  className="rounded px-1.5 py-0.5 font-sans text-[10px] font-semibold uppercase tracking-wider"
                                  style={{
                                    backgroundColor: `color-mix(in oklch, ${c.color} 12%, transparent)`,
                                    color: c.color,
                                  }}
                                >
                                  {c.name}
                                </span>
                              ))}

                          {/* Action Date / Due Badge (tasks only) */}
                          {!isNote && t.action_date && (
                            <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground font-mono">
                              <Calendar className="h-3 w-3" />
                              {t.action_date}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Task Details Dialog (Search Results View/Edit Page) */}
      <TaskDetailDialog
        task={activeTask}
        open={activeTask !== null}
        onOpenChange={(o) => {
          if (!o) setActiveTask(null)
        }}
        projects={projects}
        persons={persons}
        contexts={contexts}
        tags={tags}
        urgencies={urgencies}
        onUpdate={onUpdateTask || (() => {})}
        mode={detailMode}
        onModeChange={setDetailMode}
        portalContainer={tabPortalContainer}
        onExpandFullScreen={onExpandFullScreen}
      />
    </header>
  )
}
