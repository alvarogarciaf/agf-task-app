"use client"

import {
  Inbox,
  Home,
  ListChecks,
  Tags,
  Users,
  FolderKanban,
  Zap,
  Cloud,
  CloudOff,
  CheckCircle2,
  Settings,
} from "lucide-react"
import { cn } from "@/lib/utils"
import type { ViewKey } from "@/lib/types"

interface NavItem {
  key: ViewKey
  label: string
  icon: React.ComponentType<{ className?: string }>
  badge?: number
  shortcut?: string
}

interface AppSidebarProps {
  active: ViewKey
  onChange: (key: ViewKey) => void
  inboxCount: number
  totalCount: number
  online: boolean
  onToggleOnline: () => void
}

export function AppSidebar({
  active,
  onChange,
  inboxCount,
  totalCount,
  online,
  onToggleOnline,
}: AppSidebarProps) {
  const items: NavItem[] = [
    { key: "home", label: "Quick Capture", icon: Home, shortcut: "G" },
    { key: "inbox", label: "Inbox", icon: Inbox, badge: inboxCount, shortcut: "I" },
    { key: "all", label: "All Tasks", icon: ListChecks, badge: totalCount, shortcut: "A" },
  ]
  const browse: NavItem[] = [
    { key: "projects", label: "Projects", icon: FolderKanban, shortcut: "P" },
    { key: "contexts", label: "Contexts", icon: Tags, shortcut: "C" },
    { key: "persons", label: "People", icon: Users, shortcut: "U" },
  ]

  return (
    <aside className="hidden md:flex h-screen w-64 shrink-0 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground">
      {/* Brand */}
      <div className="flex items-center gap-2 px-4 pt-5 pb-4">
        <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary/15 text-primary ring-1 ring-primary/30">
          <Zap className="h-4 w-4" strokeWidth={2.5} />
        </div>
        <div className="flex flex-col leading-tight">
          <span className="text-sm font-semibold tracking-tight">Velocity</span>
          <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
            local-first
          </span>
        </div>
      </div>

      {/* Workspace switcher */}
      <button
        type="button"
        className="mx-3 mb-3 flex items-center justify-between rounded-md border border-sidebar-border bg-background/40 px-3 py-2 text-left text-sm hover:bg-background/70"
      >
        <div className="flex items-center gap-2">
          <div className="flex h-5 w-5 items-center justify-center rounded bg-primary/20 text-[10px] font-semibold text-primary">
            A
          </div>
          <span className="truncate">Anna&apos;s workspace</span>
        </div>
        <span className="font-mono text-[10px] text-muted-foreground">⌘K</span>
      </button>

      {/* Primary nav */}
      <nav className="px-2">
        <NavGroup label="Workflow">
          {items.map((item) => (
            <NavLink
              key={item.key}
              item={item}
              active={active === item.key}
              onClick={() => onChange(item.key)}
            />
          ))}
        </NavGroup>

        <NavGroup label="Browse">
          {browse.map((item) => (
            <NavLink
              key={item.key}
              item={item}
              active={active === item.key}
              onClick={() => onChange(item.key)}
            />
          ))}
        </NavGroup>
      </nav>

      <div className="mt-auto border-t border-sidebar-border p-3">
        {/* Sync status */}
        <button
          type="button"
          onClick={onToggleOnline}
          className={cn(
            "group flex w-full items-center justify-between rounded-md border border-sidebar-border bg-background/40 px-3 py-2 text-left text-xs transition-colors hover:bg-background/70",
          )}
          aria-label="Toggle sync status"
        >
          <div className="flex items-center gap-2">
            {online ? (
              <Cloud className="h-3.5 w-3.5 text-primary" />
            ) : (
              <CloudOff className="h-3.5 w-3.5 text-muted-foreground" />
            )}
            <span className="font-medium">{online ? "Synced" : "Offline"}</span>
          </div>
          <span className="flex items-center gap-1 font-mono text-[10px] text-muted-foreground">
            {online ? (
              <>
                <span className="relative flex h-1.5 w-1.5">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-60" />
                  <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-primary" />
                </span>
                live
              </>
            ) : (
              <>
                <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground" />
                queued
              </>
            )}
          </span>
        </button>
      </div>
    </aside>
  )
}

function NavGroup({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <div className="mb-4">
      <div className="px-2 pb-1.5 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
      <ul className="flex flex-col gap-0.5">{children}</ul>
    </div>
  )
}

function NavLink({
  item,
  active,
  onClick,
}: {
  item: NavItem
  active: boolean
  onClick: () => void
}) {
  const Icon = item.icon
  return (
    <li>
      <button
        type="button"
        onClick={onClick}
        className={cn(
          "group relative flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-sm transition-colors",
          active
            ? "bg-sidebar-accent text-sidebar-accent-foreground"
            : "text-muted-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-foreground",
        )}
        aria-current={active ? "page" : undefined}
      >
        {active && (
          <span className="absolute left-0 top-1/2 h-4 w-0.5 -translate-y-1/2 rounded-r bg-primary" />
        )}
        <Icon
          className={cn(
            "h-4 w-4 shrink-0",
            active ? "text-primary" : "text-muted-foreground group-hover:text-foreground",
          )}
        />
        <span className="flex-1 truncate text-left">{item.label}</span>
        {item.badge !== undefined && item.badge > 0 ? (
          <span
            className={cn(
              "rounded px-1.5 py-0.5 font-mono text-[10px]",
              active
                ? "bg-primary/20 text-primary"
                : "bg-muted text-muted-foreground group-hover:bg-background",
            )}
          >
            {item.badge}
          </span>
        ) : item.shortcut ? (
          <span className="font-mono text-[10px] text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100">
            {item.shortcut}
          </span>
        ) : null}
      </button>
    </li>
  )
}
