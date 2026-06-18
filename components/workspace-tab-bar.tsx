"use client"

import { useState } from "react"
import {
  Plus,
  X,
  Home,
  ListChecks,
  Tags,
  Tag as TagIcon,
  Users,
  FolderKanban,
  FileText,
  Settings,
  Calendar,
  Star,
  Layout,
} from "lucide-react"
import { cn } from "@/lib/utils"
import type { WorkspaceTab, TabRoute } from "@/lib/workspace-tabs"
import { getTabTitle } from "@/lib/workspace-tabs"
import type { SavedView, ViewKey } from "@/lib/types"

const VIEW_ICONS: Record<ViewKey, React.ComponentType<{ className?: string }>> = {
  home: Home,
  inbox: Home,
  all: ListChecks,
  contexts: Tags,
  persons: Users,
  projects: FolderKanban,
  settings: Settings,
  "saved-view": Star,
  today: Calendar,
  notes: FileText,
  tags: TagIcon,
}

function getTabIcon(route: TabRoute): React.ComponentType<{ className?: string }> {
  if (route.kind !== "view") return Layout
  return VIEW_ICONS[route.view] ?? Layout
}

interface WorkspaceTabBarProps {
  tabs: WorkspaceTab[]
  activeTabId: string
  savedViews: SavedView[]
  onSelect: (tabId: string) => void
  onClose: (tabId: string) => void
  onAdd: () => void
  onReorder?: (sourceTabId: string, targetTabId: string) => void
  resolveObjectTitle?: (id: string) => string | undefined
}

export function WorkspaceTabBar({
  tabs,
  activeTabId,
  savedViews,
  onSelect,
  onClose,
  onAdd,
  onReorder,
  resolveObjectTitle,
}: WorkspaceTabBarProps) {
  const [dragTabId, setDragTabId] = useState<string | null>(null)
  const [dropTargetId, setDropTargetId] = useState<string | null>(null)

  return (
    <div className="flex min-w-0 flex-1 items-stretch gap-0 overflow-x-auto no-scrollbar">
      {tabs.map((tab) => {
        const isActive = tab.id === activeTabId
        const objectTitle = tab.ui.objectId ? resolveObjectTitle?.(tab.ui.objectId) : undefined
        const title = getTabTitle(tab, savedViews, objectTitle)
        const Icon = getTabIcon(tab.route)
        return (
          <div
            key={tab.id}
            draggable={tabs.length > 1}
            onDragStart={(e) => {
              setDragTabId(tab.id)
              e.dataTransfer.effectAllowed = "move"
              e.dataTransfer.setData("text/plain", tab.id)
            }}
            onDragOver={(e) => {
              if (!dragTabId || dragTabId === tab.id) return
              e.preventDefault()
              e.dataTransfer.dropEffect = "move"
              if (dropTargetId !== tab.id) setDropTargetId(tab.id)
            }}
            onDragLeave={() => {
              if (dropTargetId === tab.id) setDropTargetId(null)
            }}
            onDrop={(e) => {
              e.preventDefault()
              if (dragTabId && dragTabId !== tab.id) {
                onReorder?.(dragTabId, tab.id)
              }
              setDragTabId(null)
              setDropTargetId(null)
            }}
            onDragEnd={() => {
              setDragTabId(null)
              setDropTargetId(null)
            }}
            className={cn(
              "group relative flex shrink-0 items-center text-sm transition-colors",
              isActive
                ? "text-foreground"
                : "text-muted-foreground hover:text-foreground",
              dragTabId === tab.id && "opacity-40",
              dropTargetId === tab.id && dragTabId !== tab.id && "bg-primary/5",
            )}
          >
            {/* Drop indicator */}
            {dropTargetId === tab.id && dragTabId !== tab.id && (
              <span
                aria-hidden
                className="pointer-events-none absolute inset-y-0 left-0 w-0.5 bg-primary"
              />
            )}

            {/* Active underline indicator */}
            {isActive && (
              <span className="absolute inset-x-0 bottom-0 h-[2px] bg-primary" />
            )}

            <button
              type="button"
              onClick={() => onSelect(tab.id)}
              className={cn(
                "relative inline-flex items-center gap-1.5 px-3 py-2",
                isActive && "font-semibold",
              )}
              title={title}
              aria-current={isActive ? "page" : undefined}
            >
              <Icon className="h-3.5 w-3.5" />
              <span className="truncate max-w-[140px]">{title}</span>
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
        className="ml-1 flex h-7 w-7 self-center shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        aria-label="New tab"
        title="New tab (Ctrl+T)"
      >
        <Plus className="h-4 w-4" />
      </button>
    </div>
  )
}
