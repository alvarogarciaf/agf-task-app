"use client"

import { Home, Calendar, Briefcase, FolderClosed, Star, FileText, Tags, ListTodo } from "lucide-react"
import { cn } from "@/lib/utils"
import type { ViewKey, SavedView } from "@/lib/types"

interface TasksMobileNavProps {
  active: string
  activeSavedViewId?: string | null
  onChange: (key: ViewKey, savedViewId?: string) => void
  onOpenSelector: (type: "contexts" | "projects" | "views") => void
  inboxCount: number
  todayCount: number
}

export function TasksMobileNav({ 
  active, 
  activeSavedViewId,
  onChange, 
  onOpenSelector,
  inboxCount,
  todayCount,
}: TasksMobileNavProps) {
  const items = [
    { key: "home", label: "Inbox", icon: Home, badge: inboxCount, isSelector: false },
    { key: "today", label: "Today", icon: Calendar, badge: todayCount, isSelector: false },
    { key: "all", label: "All Tasks", icon: ListTodo, isSelector: false },
    { key: "contexts", label: "Contexts", icon: Briefcase, isSelector: true },
    { key: "projects", label: "Projects", icon: FolderClosed, isSelector: true },
    { key: "views", label: "Views", icon: Star, isSelector: true },
  ]

  const isSavedViewActive = active === "saved-view"

  return (
    <nav className="md:hidden absolute bottom-0 w-full z-10 flex h-[72px] items-center justify-around border-t border-border bg-background/90 backdrop-blur pb-safe px-2">
      {items.map((item) => {
        const Icon = item.icon
        const isActive = item.key === "views" ? isSavedViewActive : active === item.key

        return (
          <button
            key={item.key}
            onClick={() => {
              if (item.isSelector) {
                onOpenSelector(item.key as "contexts" | "projects" | "views")
              } else {
                onChange(item.key as ViewKey)
              }
            }}
            className={cn(
              "relative flex flex-col items-center justify-center w-full h-full gap-1 text-[11px] font-medium transition-colors",
              isActive ? "text-primary" : "text-muted-foreground hover:text-foreground"
            )}
          >
            <div className="relative">
              <Icon className="h-6 w-6" />
              {item.badge !== undefined && item.badge > 0 && (
                <span className="absolute -top-1.5 -right-2.5 flex h-[18px] w-[18px] items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">
                  {item.badge}
                </span>
              )}
            </div>
            <span>{item.label}</span>
          </button>
        )
      })}
    </nav>
  )
}

interface NotesMobileNavProps {
  active: string
  onChange: (key: ViewKey) => void
  onOpenSelector: (type: "tags" | "projects") => void
}

export function NotesMobileNav({
  active,
  onChange,
  onOpenSelector,
}: NotesMobileNavProps) {
  const items = [
    { key: "notes", label: "All Notes", icon: FileText, isSelector: false },
    { key: "tags", label: "Tags", icon: Tags, isSelector: true },
    { key: "projects", label: "Projects", icon: FolderClosed, isSelector: true },
  ]

  return (
    <nav className="md:hidden absolute bottom-0 w-full z-10 flex h-[72px] items-center justify-around border-t border-border bg-background/90 backdrop-blur pb-safe px-2">
      {items.map((item) => {
        const Icon = item.icon
        const isActive = active === item.key

        return (
          <button
            key={item.key}
            onClick={() => {
              if (item.isSelector) {
                onOpenSelector(item.key as "tags" | "projects")
              } else {
                onChange(item.key as ViewKey)
              }
            }}
            className={cn(
              "relative flex flex-col items-center justify-center w-full h-full gap-1 text-[11px] font-medium transition-colors",
              isActive ? "text-primary" : "text-muted-foreground hover:text-foreground"
            )}
          >
            <div className="relative">
              <Icon className="h-6 w-6" />
            </div>
            <span>{item.label}</span>
          </button>
        )
      })}
    </nav>
  )
}
