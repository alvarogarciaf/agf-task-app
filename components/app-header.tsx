"use client"

import { useState, useRef, useEffect } from "react"
import { Search, Command, Settings, LogOut, ChevronDown } from "lucide-react"
import type { ViewKey } from "@/lib/types"
import type { User } from "firebase/auth"
import type { SyncStatus } from "./db-provider"
import { Cloud, CloudOff, AlertCircle } from "lucide-react"

const TITLES: Record<ViewKey, string> = {
  home: "Inbox",
  inbox: "Inbox",
  all: "All Tasks",
  contexts: "Contexts",
  persons: "People",
  projects: "Projects",
  settings: "Settings",
}

interface AppHeaderProps {
  view: ViewKey
  onNavigate?: (view: ViewKey) => void
  user?: User | null
  onSignOut?: () => void
  syncStatus?: SyncStatus
}

export function AppHeader({ view, onNavigate, user, onSignOut, syncStatus }: AppHeaderProps) {
  const title = TITLES[view]
  const [avatarOpen, setAvatarOpen] = useState(false)
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

  return (
    <header className="border-b border-border bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="flex h-14 items-center justify-between gap-3 px-3 md:px-6">
        {/* Section title */}
        <h1 className="text-lg font-semibold tracking-tight md:text-xl">{title}</h1>

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

          {/* Settings gear */}
          <button
            type="button"
            onClick={() => onNavigate?.("settings")}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground md:h-8 md:w-8"
            aria-label="Settings"
          >
            <Settings className="h-4.5 w-4.5 md:h-4 md:w-4" />
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
