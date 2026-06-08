"use client"

import { useEffect, useRef, useState } from "react"
import { ChevronDown, LogOut } from "lucide-react"
import type { SyncStatus } from "@/components/db-provider"
import { cn } from "@/lib/utils"

interface UserMenuProps {
  user?: {
    displayName: string | null
    email: string | null
    photoURL?: string | null
  } | null
  onSignOut?: () => void
  syncStatus?: SyncStatus
  variant?: "header" | "sidebar"
  className?: string
}

export function UserMenu({
  user,
  onSignOut,
  syncStatus,
  variant = "header",
  className,
}: UserMenuProps) {
  const [open, setOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function handleClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClick)
    return () => document.removeEventListener("mousedown", handleClick)
  }, [open])

  const initials = user
    ? (user.displayName || user.email || "U")
        .split(/[\s@]+/)
        .slice(0, 2)
        .map((w) => w[0]?.toUpperCase() || "")
        .join("")
    : "?"

  const isSidebar = variant === "sidebar"

  return (
    <div className={cn("relative", className)} ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={cn(
          "flex items-center gap-1.5 rounded-full transition-colors hover:bg-muted",
          isSidebar
            ? "w-full rounded-md px-3 py-2"
            : "h-10 pl-1 pr-2 md:h-8",
        )}
        aria-label="Account menu"
      >
        {user?.photoURL ? (
          <img
            src={user.photoURL}
            alt=""
            className={cn(
              "rounded-full",
              isSidebar ? "h-8 w-8" : "h-8 w-8 md:h-6 md:w-6",
            )}
            referrerPolicy="no-referrer"
          />
        ) : (
          <span
            className={cn(
              "flex items-center justify-center rounded-full bg-primary/20 font-semibold text-primary",
              isSidebar ? "h-8 w-8 text-xs" : "h-8 w-8 text-xs md:h-6 md:w-6 md:text-[10px]",
            )}
          >
            {initials}
          </span>
        )}
        {isSidebar ? (
          <span className="flex min-w-0 flex-1 flex-col text-left">
            <span className="truncate text-sm font-medium">
              {user?.displayName || "User"}
            </span>
            <span className="truncate text-xs text-muted-foreground">
              {user?.email || ""}
            </span>
          </span>
        ) : null}
        <ChevronDown className="h-3 w-3 shrink-0 text-muted-foreground" />

        {syncStatus && (
          <div className="absolute -right-0.5 -top-0.5 flex h-3 w-3 items-center justify-center rounded-full bg-background p-0.5">
            {syncStatus.replicationError ? (
              <div
                className="h-full w-full rounded-full bg-destructive"
                title={syncStatus.replicationError}
              />
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

      {open && !isSidebar && (
        <div className="absolute right-0 top-full z-50 mt-1 w-64 overflow-hidden rounded-lg border border-border bg-popover shadow-lg animate-in fade-in zoom-in-95 duration-100">
          <div className="border-b border-border px-4 py-3">
            <div className="truncate text-sm font-medium">
              {user?.displayName || "User"}
            </div>
            <div className="truncate text-xs text-muted-foreground">
              {user?.email || ""}
            </div>
          </div>
          <div className="p-1">
            <button
              type="button"
              onClick={() => {
                setOpen(false)
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

      {open && isSidebar && (
        <div className="absolute bottom-full left-0 right-0 z-50 mb-1 overflow-hidden rounded-lg border border-border bg-popover shadow-lg animate-in fade-in zoom-in-95 duration-100">
          <div className="p-1">
            <button
              type="button"
              onClick={() => {
                setOpen(false)
                onSignOut?.()
              }}
              className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <LogOut className="h-4 w-4" />
              Sign out
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
