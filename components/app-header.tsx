"use client"

import { Search, Command, Bell, Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import type { ViewKey } from "@/lib/types"

const TITLES: Record<ViewKey, { title: string; subtitle: string }> = {
  home: {
    title: "Inbox",
    subtitle: "Capture new tasks and triage what's unprocessed.",
  },
  inbox: {
    title: "Inbox",
    subtitle: "Triage what you captured. Mark items as processed to move them into the system.",
  },
  all: {
    title: "All Tasks",
    subtitle: "Master archive. Filter by context, person, or project — instantly, offline.",
  },
  contexts: {
    title: "Contexts",
    subtitle: "Where, when, and how you do work. Click any tile to see related tasks.",
  },
  persons: {
    title: "People",
    subtitle: "Tasks grouped by who they involve.",
  },
  projects: {
    title: "Projects",
    subtitle: "Active workstreams. Open a project to drill into its tasks and details.",
  },
  settings: {
    title: "Settings",
    subtitle: "Manage your Contexts, People, and Urgencies.",
  },
}

interface AppHeaderProps {
  view: ViewKey
  onNavigate?: (view: ViewKey) => void
}

export function AppHeader({ view, onNavigate }: AppHeaderProps) {
  const meta = TITLES[view]
  return (
    <header className="border-b border-border bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      {/* Top utility bar */}
      <div className="flex h-12 items-center justify-between gap-3 px-6">
        <div className="flex items-center gap-2 font-mono text-[11px] text-muted-foreground">
          <span>tasker-agf</span>
          <span className="text-border">/</span>
          <span className="text-foreground">{view}</span>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            className="flex h-8 items-center gap-2 rounded-md border border-border bg-card px-3 text-xs text-muted-foreground transition-colors hover:bg-muted"
          >
            <Search className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Search tasks, projects…</span>
            <span className="ml-2 hidden items-center gap-1 font-mono text-[10px] sm:flex">
              <Command className="h-3 w-3" />K
            </span>
          </button>

          <Button
            size="icon"
            variant="ghost"
            className="h-8 w-8 text-muted-foreground hover:text-foreground hidden md:inline-flex"
            aria-label="Notifications"
          >
            <Bell className="h-4 w-4" />
          </Button>

          <Button
            size="sm"
            className="h-8 gap-1.5 bg-primary text-primary-foreground hover:bg-primary/90"
          >
            <Plus className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">New task</span>
          </Button>

          <div className="h-4 w-px bg-border mx-1 hidden md:block" />

          {/* User Profile / Settings */}
          <button
            onClick={() => onNavigate?.("settings")}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/20 text-[11px] font-semibold text-primary hover:bg-primary/30 transition-colors"
            title="Settings"
          >
            AP
          </button>
        </div>
      </div>

      {/* Page title */}
      <div className="px-6 pt-6 pb-5">
        <h1 className="text-2xl font-semibold tracking-tight text-balance">{meta.title}</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground text-pretty">{meta.subtitle}</p>
      </div>
    </header>
  )
}
