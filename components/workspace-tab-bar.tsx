"use client"

import { Plus, X } from "lucide-react"
import { cn } from "@/lib/utils"
import type { WorkspaceTab } from "@/lib/workspace-tabs"
import { getTabTitle } from "@/lib/workspace-tabs"
import type { SavedView } from "@/lib/types"

interface WorkspaceTabBarProps {
  tabs: WorkspaceTab[]
  activeTabId: string
  savedViews: SavedView[]
  onSelect: (tabId: string) => void
  onClose: (tabId: string) => void
  onAdd: () => void
}

export function WorkspaceTabBar({
  tabs,
  activeTabId,
  savedViews,
  onSelect,
  onClose,
  onAdd,
}: WorkspaceTabBarProps) {
  return (
    <div className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto">
      {tabs.map((tab) => {
        const isActive = tab.id === activeTabId
        const title = getTabTitle(tab, savedViews)
        return (
          <div
            key={tab.id}
            className={cn(
              "group relative flex h-8 max-w-[200px] shrink-0 items-center rounded-md text-xs transition-all",
              isActive
                ? "bg-card text-foreground shadow-sm ring-1 ring-border/80"
                : "text-foreground/55 hover:bg-muted/80 hover:text-foreground/90",
            )}
          >
            {isActive && (
              <span
                className="absolute inset-x-2 bottom-0 h-0.5 rounded-full bg-primary"
                aria-hidden
              />
            )}
            <button
              type="button"
              onClick={() => onSelect(tab.id)}
              className={cn(
                "flex min-w-0 flex-1 items-center px-2.5 py-1.5",
                isActive && "font-semibold",
              )}
              title={title}
              aria-current={isActive ? "page" : undefined}
            >
              <span className="truncate">{title}</span>
            </button>
            {tabs.length > 1 && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  onClose(tab.id)
                }}
                className={cn(
                  "mr-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-sm transition-colors",
                  isActive
                    ? "text-foreground/60 hover:bg-muted hover:text-foreground"
                    : "text-foreground/40 opacity-0 hover:bg-muted/80 hover:text-foreground group-hover:opacity-100",
                )}
                aria-label={`Close ${title}`}
              >
                <X className="h-3 w-3" />
              </button>
            )}
          </div>
        )
      })}
      <button
        type="button"
        onClick={onAdd}
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        aria-label="New tab"
        title="New tab (Ctrl+T)"
      >
        <Plus className="h-4 w-4" />
      </button>
    </div>
  )
}
