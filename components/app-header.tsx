"use client"

import { useState, useRef, useEffect, useMemo } from "react"
import { Search, Command, Settings, LogOut, ChevronDown, Menu, Users, Tags, AlertCircle, Calendar, Trash2, Info, Bell, Circle, CheckCircle2 } from "lucide-react"
import type { ViewKey, Task, Project, Person, Context, UrgencyLevel } from "@/lib/types"
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

const TITLES: Record<ViewKey, string> = {
  home: "Inbox",
  inbox: "Inbox",
  all: "All Tasks",
  contexts: "Contexts",
  persons: "People",
  projects: "Projects",
  settings: "Settings",
  "saved-view": "Saved View",
}

interface AppHeaderProps {
  view: ViewKey
  savedViewName?: string | null
  onNavigate?: (view: ViewKey, savedViewId?: string, settingsTab?: TabKey) => void
  user?: { uid: string; displayName: string | null; email: string | null; photoURL?: string | null } | null
  onSignOut?: () => void
  syncStatus?: SyncStatus
  tasks?: Task[]
  projects?: Project[]
  persons?: Person[]
  contexts?: Context[]
  urgencies?: UrgencyLevel[]
  onUpdateTask?: (task: Task) => void
}

export function AppHeader({
  view,
  savedViewName,
  onNavigate,
  user,
  onSignOut,
  syncStatus,
  tasks = [],
  projects = [],
  persons = [],
  contexts = [],
  urgencies = [],
  onUpdateTask,
}: AppHeaderProps) {
  const title = view === "saved-view" ? savedViewName || "Saved View" : TITLES[view]
  const [avatarOpen, setAvatarOpen] = useState(false)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  const [searchOpen, setSearchOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [activeTask, setActiveTask] = useState<Task | null>(null)
  const [detailMode, setDetailMode] = useState<"view" | "edit">("view")

  const searchInputRef = useRef<HTMLInputElement>(null)

  // Listen for global keyboard shortcut (Cmd+K / Ctrl+K)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault()
        setSearchOpen((o) => !o)
      }
    }
    document.addEventListener("keydown", handleKeyDown)
    return () => document.removeEventListener("keydown", handleKeyDown)
  }, [])

  // Focus input when modal opens, clear query when it closes
  useEffect(() => {
    if (searchOpen) {
      setTimeout(() => {
        searchInputRef.current?.focus()
      }, 80)
    } else {
      setSearchQuery("")
    }
  }, [searchOpen])

  // Filter tasks by case-insensitive query matches in description or details
  const filteredTasks = useMemo(() => {
    const q = searchQuery.toLowerCase().trim()
    if (!q) return []
    return tasks.filter((t) => {
      const desc = t.description?.toLowerCase() || ""
      const det = t.details?.toLowerCase() || ""
      return desc.includes(q) || det.includes(q)
    })
  }, [searchQuery, tasks])

  // Close dropdown on outside click
  useEffect(() => {
    if (!avatarOpen) return
    function handleClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setAvatarOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClick)
    return () => document.removeEventListener("mousedown", handleClick)
  }, [avatarOpen])

  // User initials from display name or email
  const initials = user
    ? (user.displayName || user.email || "U")
        .split(/[\s@]+/)
        .slice(0, 2)
        .map((w) => w[0]?.toUpperCase() || "")
        .join("")
    : "?"

  const settingsOptions: { key: TabKey; label: string; icon: any }[] = [
    { key: "persons", label: "People", icon: Users },
    { key: "contexts", label: "Contexts", icon: Tags },
    { key: "urgencies", label: "Urgencies", icon: AlertCircle },
    { key: "calendar", label: "Calendar", icon: Calendar },
    { key: "data", label: "Data Management", icon: Trash2 },
    { key: "notifications", label: "Notifications", icon: Bell },
    { key: "troubleshoot", label: "Sync & Debug", icon: Info },
  ]

  return (
    <header className="pt-safe border-b border-border bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="flex h-14 items-center justify-between gap-3 px-3 md:px-6">
        <div className="flex items-center gap-2">
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
                    Settings & Configuration
                  </DrawerTitle>
                </DrawerHeader>
                <div className="flex flex-col py-2">
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

          {/* Section title */}
          <h1 className="text-lg font-semibold tracking-tight md:text-xl">{title}</h1>
        </div>

        {/* Right side controls */}
        <div className="flex items-center gap-2">
          {/* Search */}
          <button
            type="button"
            onClick={() => setSearchOpen(true)}
            className="flex h-10 items-center gap-2 rounded-md border border-border bg-card px-3 text-sm text-muted-foreground transition-all hover:bg-muted active:scale-[0.98] md:h-8 md:text-xs"
          >
            <Search className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Search…</span>
            <span className="ml-2 hidden items-center gap-1 font-mono text-[10px] sm:flex">
              <Command className="h-3 w-3" />K
            </span>
          </button>



          {/* Avatar dropdown */}
          <div className="relative" ref={dropdownRef}>
            <button
              type="button"
              onClick={() => setAvatarOpen((o) => !o)}
              className="flex h-10 items-center gap-1.5 rounded-full pl-1 pr-2 transition-colors hover:bg-muted md:h-8"
              aria-label="Account menu"
            >
              {user?.photoURL ? (
                <img
                  src={user.photoURL}
                  alt=""
                  className="h-8 w-8 rounded-full md:h-6 md:w-6"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/20 text-xs font-semibold text-primary md:h-6 md:w-6 md:text-[10px]">
                  {initials}
                </span>
              )}
              <ChevronDown className="h-3 w-3 text-muted-foreground" />
              
              {/* Sync Status Dot overlay on avatar */}
              {syncStatus && (
                <div className="absolute -right-0.5 -top-0.5 flex h-3 w-3 items-center justify-center rounded-full bg-background p-0.5">
                  {syncStatus.replicationError ? (
                    <div className="h-full w-full rounded-full bg-destructive" title={syncStatus.replicationError} />
                  ) : !syncStatus.browserOnline ? (
                    <div className="h-full w-full rounded-full bg-muted-foreground" title="Offline" />
                  ) : syncStatus.replicationActive ? (
                    <div className="h-full w-full rounded-full bg-primary" title="Sync active">
                       <span className="absolute inset-0 animate-ping rounded-full bg-primary opacity-40" />
                    </div>
                  ) : (
                    <div className="h-full w-full rounded-full bg-orange-400" title="Sync idle" />
                  )}
                </div>
              )}
            </button>

            {avatarOpen && (
              <div className="absolute right-0 top-full z-50 mt-1 w-64 overflow-hidden rounded-lg border border-border bg-popover shadow-lg animate-in fade-in zoom-in-95 duration-100">
                {/* User info */}
                <div className="border-b border-border px-4 py-3">
                  <div className="text-sm font-medium truncate">
                    {user?.displayName || "User"}
                  </div>
                  <div className="text-xs text-muted-foreground truncate">
                    {user?.email || ""}
                  </div>
                </div>

                {/* Actions */}
                <div className="p-1">
                  <button
                    type="button"
                    onClick={() => {
                      setAvatarOpen(false)
                      onSignOut?.()
                    }}
                    className="flex w-full items-center gap-2 rounded-md px-3 py-2.5 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground md:py-1.5"
                  >
                    <LogOut className="h-4 w-4" />
                    Sign out
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Search Modal */}
      <Dialog open={searchOpen} onOpenChange={setSearchOpen}>
        <DialogContent className="max-w-xl gap-0 overflow-hidden p-0 bg-card sm:rounded-xl border border-border shadow-2xl">
          <DialogTitle className="sr-only">Search Tasks</DialogTitle>
          
          {/* Search Input Box */}
          <div className="flex items-center gap-3 border-b border-border px-4 py-3 bg-muted/20">
            <Search className="h-4 w-4 text-muted-foreground shrink-0" />
            <input
              ref={searchInputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
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

          {/* Results Area */}
          <div className="max-h-[60vh] overflow-y-auto p-2">
            {!searchQuery ? (
              <div className="flex flex-col items-center justify-center py-10 text-muted-foreground">
                <Search className="h-8 w-8 opacity-25 mb-2.5" />
                <span className="text-sm font-medium">Type to search across the whole database</span>
                <span className="text-[11px] opacity-75 mt-0.5">Searching description and details...</span>
              </div>
            ) : filteredTasks.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-muted-foreground">
                <AlertCircle className="h-8 w-8 opacity-25 mb-2.5 text-destructive" />
                <span className="text-sm font-medium">No results found matching your search</span>
                <span className="text-[11px] opacity-75 mt-0.5">Check for typos or try different terms</span>
              </div>
            ) : (
              <div className="space-y-1">
                {filteredTasks.map((t) => {
                  const project = projects.find((p) => p.id === t.project_id)
                  const taskContexts = contexts.filter((c) => t.context_ids.includes(c.id))
                  const isDone = t.status === "Done"
                  
                  return (
                    <div
                      key={t.id}
                      onClick={() => {
                        setActiveTask(t)
                        setDetailMode("view")
                        setSearchOpen(false)
                      }}
                      className="group flex cursor-pointer items-start gap-3 rounded-lg p-3 transition-colors hover:bg-muted/70 active:bg-muted/90"
                    >
                      {/* Status Icon */}
                      <div className="mt-0.5 shrink-0">
                        {isDone ? (
                          <CheckCircle2 className="h-4.5 w-4.5 text-primary" />
                        ) : (
                          <Circle className="h-4.5 w-4.5 text-muted-foreground" />
                        )}
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0 text-left">
                        {/* Description */}
                        <div className={`text-sm font-medium leading-normal tracking-tight truncate ${isDone ? "text-muted-foreground line-through" : "text-foreground"}`}>
                          {t.description}
                        </div>

                        {/* Details snippet */}
                        {t.details && (
                          <div className="mt-0.5 text-xs text-muted-foreground/80 line-clamp-1 truncate">
                            {t.details}
                          </div>
                        )}

                        {/* Tags / Badges */}
                        <div className="mt-2 flex flex-wrap items-center gap-1.5">
                          {/* Project Badge */}
                          {project && (
                            <span className="rounded bg-secondary/80 px-1.5 py-0.5 font-sans text-[10px] font-semibold text-secondary-foreground uppercase tracking-wider">
                              {project.name}
                            </span>
                          )}

                          {/* Context Tags */}
                          {taskContexts.map((c) => (
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
                          
                          {/* Action Date / Due Badge */}
                          {t.action_date && (
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
        urgencies={urgencies}
        onUpdate={onUpdateTask || (() => {})}
        mode={detailMode}
        onModeChange={setDetailMode}
      />
    </header>
  )
}
