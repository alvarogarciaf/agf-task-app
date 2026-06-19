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
  ChevronRight,
  ChevronDown,
} from "lucide-react"
import { cn } from "@/lib/utils"
import type { ViewKey, SavedView, Project, Context, Tag, Person } from "@/lib/types"
import type { SyncStatus } from "@/components/db-provider"
import { Star, MoreVertical, Edit2, Trash2 } from "lucide-react"
import { ICONS } from "@/lib/constants"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { UserMenu } from "@/components/user-menu"

interface NavItemSub {
  id: string
  name: string
  color?: string
}

interface NavItem {
  key: ViewKey
  label: string
  icon: React.ComponentType<{ className?: string }>
  badge?: number
  shortcut?: string
  subItems?: NavItemSub[]
}

interface AppSidebarProps {
  active: ViewKey
  activeSavedViewId?: string | null
  /** When false (e.g. blank desktop tab), no nav item is highlighted. */
  sidebarSelectionActive?: boolean
  onChange: (key: ViewKey, savedViewId?: string, settingsTab?: any, objectId?: string) => void
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
  projects?: Project[]
  contexts?: Context[]
  tags?: Tag[]
  persons?: Person[]
  user?: {
    displayName: string | null
    email: string | null
    photoURL?: string | null
  } | null
  onSignOut?: () => void
  showUserMenu?: boolean
}

export function AppSidebar({
  active,
  activeSavedViewId,
  sidebarSelectionActive = true,
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
  projects = [],
  contexts = [],
  tags = [],
  persons = [],
  user,
  onSignOut,
  showUserMenu = false,
}: AppSidebarProps) {
  const showActive = sidebarSelectionActive
  const items: NavItem[] = [
    { key: "home", label: "Inbox", icon: Home, shortcut: "I" },
    { key: "all", label: "All Tasks", icon: ListChecks, badge: totalCount, shortcut: "A" },
    { 
      key: "contexts", 
      label: "Contexts", 
      icon: Tags, 
      shortcut: "C",
      subItems: contexts.map(c => ({ id: c.id, name: c.name, color: c.color })) 
    },
  ]
  const notesItems: NavItem[] = [
    { key: "notes", label: "Notes", icon: FileText, shortcut: "N" },
    { 
      key: "tags", 
      label: "Tags", 
      icon: TagIcon,
      subItems: tags.map(t => ({ id: t.id, name: t.name, color: t.color })) 
    },
  ]
  const browse: NavItem[] = [
    { 
      key: "projects", 
      label: "Projects", 
      icon: FolderKanban, 
      shortcut: "P",
      subItems: projects.map(p => ({ id: p.id, name: p.name })) 
    },
    { 
      key: "persons", 
      label: "People", 
      icon: Users, 
      shortcut: "U",
      subItems: persons.map(p => ({ id: p.id, name: p.name })) 
    },
    { key: "today", label: "Today", icon: Calendar, badge: todayCount, shortcut: "T" },
  ]

  const [draggedId, setDraggedId] = useState<string | null>(null)
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({})

  const toggleGroup = (key: string) => {
    setExpandedGroups(prev => ({ ...prev, [key]: !prev[key] }))
  }

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
    <aside className="hidden md:flex pt-safe pb-safe h-screen w-64 max-w-[16rem] shrink-0 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground overflow-hidden">

      {/* App Branding */}
      <div className="mx-3 my-4 flex items-center gap-2.5 px-3 py-2">
        <img src="/logo.svg" alt="Logo" className="h-8 w-8 shrink-0" />
        <span className="text-lg font-light tracking-tight text-primary">Tasks</span>
      </div>

      {/* Primary nav */}
      <nav className="px-2 overflow-y-auto overflow-x-hidden min-h-0 flex-1">
        <NavGroup label="Tasks">
          {items.map((item) => (
            <NavLink
              key={item.key}
              item={item}
              active={showActive && active === item.key}
              onClick={() => onChange(item.key)}
              isExpanded={!!expandedGroups[item.key]}
              onExpandToggle={() => toggleGroup(item.key)}
              onSubItemClick={(objectId) => onChange(item.key, undefined, undefined, objectId)}
            />
          ))}
        </NavGroup>

        <NavGroup label="Notes" divider>
          {notesItems.map((item) => (
            <NavLink
              key={item.key}
              item={item}
              active={showActive && active === item.key}
              onClick={() => onChange(item.key)}
              isExpanded={!!expandedGroups[item.key]}
              onExpandToggle={() => toggleGroup(item.key)}
              onSubItemClick={(objectId) => onChange(item.key, undefined, undefined, objectId)}
            />
          ))}
        </NavGroup>

        <NavGroup label="Browse" divider>
          {browse.map((item) => (
            <NavLink
              key={item.key}
              item={item}
              active={showActive && active === item.key}
              onClick={() => onChange(item.key)}
              isExpanded={!!expandedGroups[item.key]}
              onExpandToggle={() => toggleGroup(item.key)}
              onSubItemClick={(objectId) => onChange(item.key, undefined, undefined, objectId)}
            />
          ))}
        </NavGroup>

        {savedViews.length > 0 && (
          <NavGroup label="Saved Views" divider>
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
                  active={showActive && active === "saved-view" && activeSavedViewId === sv.id}
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
            showActive && active === "settings"
              ? "bg-sidebar-accent text-sidebar-accent-foreground"
              : "text-muted-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-foreground"
          )}
        >
          <Settings className="h-4 w-4" />
          <span className="flex-1 text-left">Settings</span>
        </button>
        <SyncStatusRow syncStatus={syncStatus} />
        {showUserMenu && (
          <UserMenu
            user={user}
            onSignOut={onSignOut}
            syncStatus={syncStatus}
            variant="sidebar"
          />
        )}
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
  divider,
}: {
  label: string
  children: React.ReactNode
  divider?: boolean
}) {
  return (
    <div className={cn("mb-4", divider && "mt-4 border-t border-sidebar-border pt-4")}>
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
  isExpanded,
  onExpandToggle,
  onSubItemClick,
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
  isExpanded?: boolean
  onExpandToggle?: () => void
  onSubItemClick?: (id: string) => void
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
      <div className="group relative flex w-full flex-col">
        <div
          onClick={item.subItems ? onExpandToggle : onClick}
          className={cn(
            "group/row relative flex w-full items-center rounded-md transition-colors",
            item.subItems ? "cursor-pointer" : "",
            active && !item.subItems ? "bg-sidebar-accent text-sidebar-accent-foreground" : "text-muted-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-foreground"
          )}
        >
          {active && (
            <span className="absolute left-0 top-1/2 h-4 w-0.5 -translate-y-1/2 rounded-r bg-primary" />
          )}
          
          <div className="flex flex-1 min-w-0 items-center gap-2.5 px-2 py-1.5 text-sm">
            <span 
              className={cn(
                "flex h-4 w-4 shrink-0 items-center justify-center",
                active ? "text-foreground" : "text-muted-foreground group-hover/row:text-foreground",
              )}
              style={color ? { color } : undefined}
            >
              <Icon className="h-4 w-4" />
            </span>
            
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                onClick()
              }}
              className="truncate text-left hover:underline focus:underline focus:outline-none"
            >
              {item.label}
            </button>
            
            {item.badge !== undefined && item.badge > 0 ? (
              <span
                className={cn(
                  "ml-auto rounded px-1.5 py-0.5 font-mono text-[10px]",
                  active
                    ? "bg-primary/20 text-primary"
                    : "bg-muted text-muted-foreground group-hover/row:bg-background",
                )}
              >
                {item.badge}
              </span>
            ) : item.shortcut ? (
              <span className="ml-auto font-mono text-[10px] text-muted-foreground opacity-0 transition-opacity group-hover/row:opacity-100">
                {item.shortcut}
              </span>
            ) : null}
          </div>

          {item.subItems && (
            <div className="mr-2 flex h-6 w-6 shrink-0 items-center justify-center rounded-md hover:bg-sidebar-accent-foreground/10 text-muted-foreground">
              {isExpanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
            </div>
          )}

          {(onEdit || onDelete) && (
            <div className="mr-1 opacity-0 group-hover/row:opacity-100 transition-opacity">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    onClick={(e) => e.stopPropagation()}
                    className="flex h-6 w-6 items-center justify-center rounded-md hover:bg-sidebar-accent-foreground/10"
                  >
                    <MoreVertical className="h-3.5 w-3.5" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-32">
                  {onEdit && (
                    <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onEdit(); }}>
                      <Edit2 className="mr-2 h-3.5 w-3.5" />
                      Edit
                    </DropdownMenuItem>
                  )}
                  {onDelete && (
                    <DropdownMenuItem 
                      onClick={(e) => { e.stopPropagation(); onDelete(); }}
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

        {/* Expanded SubItems */}
        {isExpanded && item.subItems && item.subItems.length > 0 && (
          <ul className="mt-0.5 flex flex-col gap-0.5 pl-7 pb-1">
            {item.subItems.map((sub) => (
              <li key={sub.id}>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    onSubItemClick?.(sub.id)
                  }}
                  className="flex w-full items-center gap-2 rounded-md px-2 py-1 text-[13px] text-muted-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-foreground transition-colors"
                >
                  <span 
                    className="h-1.5 w-1.5 shrink-0 rounded-full" 
                    style={{ backgroundColor: sub.color || "currentColor", opacity: sub.color ? 1 : 0.6 }} 
                  />
                  <span className="truncate text-left">{sub.name}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </li>
  )
}
