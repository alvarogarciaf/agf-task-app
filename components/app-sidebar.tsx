"use client"
 
import { useState } from "react"
import {
  Home,
  ListChecks,
  Tags,
  Tag as TagIcon,
  Users,
  FolderKanban,
  FileText,
  Cloud,
  CloudOff,
  AlertCircle,
  Settings,
  Calendar,
} from "lucide-react"
import { cn } from "@/lib/utils"
import type { ViewKey, SavedView } from "@/lib/types"
import type { SyncStatus } from "@/components/db-provider"
import { Star, MoreVertical, Edit2, Trash2 } from "lucide-react"
import { ICONS } from "@/lib/constants"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

interface NavItem {
  key: ViewKey
  label: string
  icon: React.ComponentType<{ className?: string }>
  badge?: number
  shortcut?: string
}

interface AppSidebarProps {
  active: ViewKey
  activeSavedViewId?: string | null
  onChange: (key: ViewKey, savedViewId?: string) => void
  onEditSavedView?: (view: SavedView) => void
  onDeleteSavedView?: (id: string) => void
  onReorderSavedViews?: (views: SavedView[]) => void
  inboxCount: number
  totalCount: number
  todayCount: number
  syncStatus: SyncStatus
  workspaceLabel: string
  workspaceInitial: string
  savedViews: SavedView[]
}

export function AppSidebar({
  active,
  activeSavedViewId,
  onChange,
  onEditSavedView,
  onDeleteSavedView,
  onReorderSavedViews,
  inboxCount,
  totalCount,
  todayCount,
  syncStatus,
  workspaceLabel,
  workspaceInitial,
  savedViews,
}: AppSidebarProps) {
  const items: NavItem[] = [
    { key: "home", label: "Inbox", icon: Home, shortcut: "I" },
    { key: "today", label: "Today", icon: Calendar, badge: todayCount, shortcut: "T" },
    { key: "all", label: "All Tasks", icon: ListChecks, badge: totalCount, shortcut: "A" },
  ]
  const notesItems: NavItem[] = [
    { key: "notes", label: "Notes", icon: FileText, shortcut: "N" },
  ]
  const browse: NavItem[] = [
    { key: "projects", label: "Projects", icon: FolderKanban, shortcut: "P" },
    { key: "contexts", label: "Contexts", icon: Tags, shortcut: "C" },
    { key: "tags", label: "Tags", icon: TagIcon },
    { key: "persons", label: "People", icon: Users, shortcut: "U" },
  ]

  const [draggedId, setDraggedId] = useState<string | null>(null)

  const handleDragStart = (e: React.DragEvent, id: string) => {
    setDraggedId(id)
    e.dataTransfer.effectAllowed = "move"
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = "move"
  }

  const handleDrop = (e: React.DragEvent, targetId: string) => {
    e.preventDefault()
    if (!draggedId || draggedId === targetId || !onReorderSavedViews) return

    const draggedIndex = savedViews.findIndex((v) => v.id === draggedId)
    const targetIndex = savedViews.findIndex((v) => v.id === targetId)

    if (draggedIndex === -1 || targetIndex === -1) return

    const newViews = [...savedViews]
    const [draggedItem] = newViews.splice(draggedIndex, 1)
    newViews.splice(targetIndex, 0, draggedItem)

    onReorderSavedViews(newViews)
    setDraggedId(null)
  }

  return (
    <aside className="hidden md:flex pt-safe pb-safe h-screen w-64 shrink-0 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground">

      {/* App Branding */}
      <div className="mx-3 my-4 flex items-center gap-2.5 px-3 py-2">
        <img src="/logo.svg" alt="Logo" className="h-8 w-8 shrink-0" />
        <span className="text-lg font-light tracking-tight text-primary">Tasks</span>
      </div>

      {/* Primary nav */}
      <nav className="px-2 overflow-y-auto">
        <NavGroup label="Tasks">
          {items.map((item) => (
            <NavLink
              key={item.key}
              item={item}
              active={active === item.key}
              onClick={() => onChange(item.key)}
            />
          ))}
        </NavGroup>

        <NavGroup label="Notes">
          {notesItems.map((item) => (
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

        {savedViews.length > 0 && (
          <NavGroup label="Saved Views">
            {savedViews.map((sv) => {
              const Icon = ICONS[sv.icon] || Star
              return (
                <NavLink
                  key={sv.id}
                  item={{
                    key: "saved-view",
                    label: sv.name,
                    icon: Icon,
                  }}
                  color={sv.color}
                  active={active === "saved-view" && activeSavedViewId === sv.id}
                  onClick={() => onChange("saved-view", sv.id)}
                  onEdit={() => onEditSavedView?.(sv)}
                  onDelete={() => onDeleteSavedView?.(sv.id)}
                  draggable
                  onDragStart={(e) => handleDragStart(e, sv.id)}
                  onDragOver={handleDragOver}
                  onDrop={(e) => handleDrop(e, sv.id)}
                  isDragged={draggedId === sv.id}
                />
              )
            })}
          </NavGroup>
        )}
      </nav>

      <div className="mt-auto border-t border-sidebar-border p-3 flex flex-col gap-2">
        <button
          type="button"
          onClick={() => onChange("settings")}
          className={cn(
            "flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium transition-colors",
            active === "settings"
              ? "bg-sidebar-accent text-sidebar-accent-foreground"
              : "text-muted-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-foreground"
          )}
        >
          <Settings className="h-4 w-4" />
          <span className="flex-1 text-left">Settings</span>
        </button>
        <SyncStatusRow syncStatus={syncStatus} />
      </div>
    </aside>
  )
}

function SyncStatusRow({ syncStatus }: { syncStatus: SyncStatus }) {
  const { browserOnline, replicationActive, replicationError } = syncStatus

  const hasError = Boolean(replicationError)
  const showLive =
    browserOnline && !hasError && replicationActive
  const showIdle = browserOnline && !hasError && !replicationActive

  const title = replicationError
    ? replicationError
    : !browserOnline
      ? "No network. Edits stay on this device until you are back online."
      : showLive
        ? "Connected. Firestore sync is active."
        : "Connected. Sync may be idle between rounds."

  const label = hasError
    ? "Sync error"
    : !browserOnline
      ? "Offline"
      : "Online"

  return (
    <div
      className={cn(
        "flex w-full items-center justify-between rounded-md border border-sidebar-border bg-background/40 px-3 py-2 text-left text-xs",
        hasError && "border-destructive/40 bg-destructive/5",
      )}
      role="status"
      aria-live="polite"
      title={title}
    >
      <div className="flex min-w-0 items-center gap-2">
        {hasError ? (
          <AlertCircle className="h-3.5 w-3.5 shrink-0 text-destructive" />
        ) : browserOnline ? (
          <Cloud className="h-3.5 w-3.5 shrink-0 text-primary" />
        ) : (
          <CloudOff className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        )}
        <span className="truncate font-medium">{label}</span>
      </div>
      <span className="flex shrink-0 items-center gap-1 font-mono text-[10px] text-muted-foreground">
        {showLive ? (
          <>
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-60" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-primary" />
            </span>
            live
          </>
        ) : hasError ? (
          <>
            <span className="h-1.5 w-1.5 rounded-full bg-destructive" />
            retry
          </>
        ) : !browserOnline ? (
          <>
            <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground" />
            local
          </>
        ) : showIdle ? (
          <>
            <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground" />
            idle
          </>
        ) : null}
      </span>
    </div>
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
  onEdit,
  onDelete,
  color,
  draggable,
  onDragStart,
  onDragOver,
  onDrop,
  isDragged,
}: {
  item: NavItem
  active: boolean
  onClick: () => void
  onEdit?: () => void
  onDelete?: () => void
  color?: string
  draggable?: boolean
  onDragStart?: (e: React.DragEvent) => void
  onDragOver?: (e: React.DragEvent) => void
  onDrop?: (e: React.DragEvent) => void
  isDragged?: boolean
}) {
  const Icon = item.icon
  return (
    <li
      draggable={draggable}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDrop={onDrop}
      className={cn(
        "list-none transition-opacity",
        isDragged ? "opacity-40" : "opacity-100"
      )}
    >
      <div className={cn(
        "group relative flex w-full items-center rounded-md transition-colors",
        active ? "bg-sidebar-accent text-sidebar-accent-foreground" : "text-muted-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-foreground"
      )}>
        <button
          type="button"
          onClick={onClick}
          className="flex flex-1 items-center gap-2.5 px-2 py-1.5 text-sm"
          aria-current={active ? "page" : undefined}
        >
          {active && (
            <span className="absolute left-0 top-1/2 h-4 w-0.5 -translate-y-1/2 rounded-r bg-primary" />
          )}
          <span 
            className={cn(
              "flex h-4 w-4 shrink-0 items-center justify-center",
              active ? "text-foreground" : "text-muted-foreground group-hover:text-foreground",
            )}
            style={color ? { color } : undefined}
          >
            <Icon className="h-4 w-4" />
          </span>
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

        {(onEdit || onDelete) && (
          <div className="mr-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="flex h-6 w-6 items-center justify-center rounded-md hover:bg-sidebar-accent-foreground/10"
                >
                  <MoreVertical className="h-3.5 w-3.5" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-32">
                {onEdit && (
                  <DropdownMenuItem onClick={onEdit}>
                    <Edit2 className="mr-2 h-3.5 w-3.5" />
                    Edit
                  </DropdownMenuItem>
                )}
                {onDelete && (
                  <DropdownMenuItem 
                    onClick={onDelete}
                    className="text-destructive focus:text-destructive"
                  >
                    <Trash2 className="mr-2 h-3.5 w-3.5" />
                    Delete
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        )}
      </div>
    </li>
  )
}
