"use client"

import { useState, useRef, useEffect } from "react"
import { Search, Command, Settings, LogOut, ChevronDown, Menu, Users, Tags, AlertCircle, Calendar, Trash2, Info } from "lucide-react"
import type { ViewKey } from "@/lib/types"
import type { SyncStatus } from "./db-provider"
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
}

export function AppHeader({ view, savedViewName, onNavigate, user, onSignOut, syncStatus }: AppHeaderProps) {
  const title = view === "saved-view" ? savedViewName || "Saved View" : TITLES[view]
  const [avatarOpen, setAvatarOpen] = useState(false)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

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
            disabled
            title="Search is not available yet"
            aria-disabled="true"
            className="flex h-10 cursor-not-allowed items-center gap-2 rounded-md border border-border bg-card px-3 text-sm text-muted-foreground opacity-60 md:h-8 md:text-xs"
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
    </header>
  )
}
