"use client"

import { Home, Calendar, Briefcase, FolderClosed, Star, FileText, Tags, ListTodo, Bookmark } from "lucide-react"
import { cn } from "@/lib/utils"
import type { ViewKey, SavedView } from "@/lib/types"
import { useState, useEffect } from "react"

function useKeyboardOpen() {
  const [isOpen, setIsOpen] = useState(false)

  useEffect(() => {
    if (typeof window === "undefined" || !window.visualViewport) return

    let maxViewportHeight = window.visualViewport.height

    const handleResize = () => {
      if (!window.visualViewport) return
      const currentHeight = window.visualViewport.height
      if (currentHeight > maxViewportHeight) {
        maxViewportHeight = currentHeight
      }
      
      if (currentHeight < maxViewportHeight - 150) {
        setIsOpen(true)
      } else {
        setIsOpen(false)
      }
    }

    window.visualViewport.addEventListener("resize", handleResize)
    
    return () => window.visualViewport?.removeEventListener("resize", handleResize)
  }, [])

  return isOpen
}

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
    { key: "all", label: "All", icon: ListTodo, isSelector: false },
    { key: "contexts", label: "Context", icon: Briefcase, isSelector: true },
    { key: "projects", label: "Projects", icon: FolderClosed, isSelector: false },
    { key: "views", label: "Views", icon: Star, isSelector: true },
  ]

  const isSavedViewActive = active === "saved-view"
  const isKeyboardOpen = useKeyboardOpen()

  return (
    <nav className={cn(
      "md:hidden absolute bottom-0 w-full z-10 flex bottom-nav-safe items-center justify-around border-t border-border bg-background/95 backdrop-blur-md px-1 pt-1 transition-transform duration-200",
      isKeyboardOpen ? "translate-y-full opacity-0 pointer-events-none" : "translate-y-0 opacity-100"
    )}>
      {items.map((item) => {
        const Icon = item.icon
        const isActive = item.key === "views" ? isSavedViewActive : active === item.key

        return (
          <button
            key={item.key}
            type="button"
            onClick={() => {
              if (item.isSelector) {
                onOpenSelector(item.key as "contexts" | "projects" | "views")
              } else {
                onChange(item.key as ViewKey)
              }
            }}
            className={cn(
              "relative flex flex-col items-center justify-center flex-1 h-full py-0.5 gap-0.5 text-[10px] sm:text-[11px] font-medium tracking-tight transition-colors min-w-0 select-none active:scale-95",
              isActive ? "text-primary font-semibold" : "text-muted-foreground hover:text-foreground"
            )}
          >
            <div className="relative flex items-center justify-center h-5 w-5 shrink-0">
              <Icon className="h-5 w-5 shrink-0" />
              {item.badge !== undefined && item.badge > 0 && (
                <span className="absolute -top-1.5 -right-2.5 flex min-w-[15px] h-[15px] px-1 items-center justify-center rounded-full bg-primary text-[9px] font-bold text-primary-foreground leading-none shadow-sm pointer-events-none">
                  {item.badge > 99 ? "99+" : item.badge}
                </span>
              )}
            </div>
            <span className="truncate max-w-full text-center leading-tight px-0.5">{item.label}</span>
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
    { key: "notes", label: "Notes", icon: FileText, isSelector: false },
    { key: "bookmarks", label: "Saved", icon: Bookmark, isSelector: false },
    { key: "tags", label: "Tags", icon: Tags, isSelector: true },
    { key: "projects", label: "Projects", icon: FolderClosed, isSelector: false },
  ]

  const isKeyboardOpen = useKeyboardOpen()

  return (
    <nav className={cn(
      "md:hidden absolute bottom-0 w-full z-10 flex bottom-nav-safe items-center justify-around border-t border-border bg-background/95 backdrop-blur-md px-1 pt-1 transition-transform duration-200",
      isKeyboardOpen ? "translate-y-full opacity-0 pointer-events-none" : "translate-y-0 opacity-100"
    )}>
      {items.map((item) => {
        const Icon = item.icon
        const isActive = active === item.key

        return (
          <button
            key={item.key}
            type="button"
            onClick={() => {
              if (item.isSelector) {
                onOpenSelector(item.key as "tags" | "projects")
              } else {
                onChange(item.key as ViewKey)
              }
            }}
            className={cn(
              "relative flex flex-col items-center justify-center flex-1 h-full py-0.5 gap-0.5 text-[10px] sm:text-[11px] font-medium tracking-tight transition-colors min-w-0 select-none active:scale-95",
              isActive ? "text-primary font-semibold" : "text-muted-foreground hover:text-foreground"
            )}
          >
            <div className="relative flex items-center justify-center h-5 w-5 shrink-0">
              <Icon className="h-5 w-5 shrink-0" />
            </div>
            <span className="truncate max-w-full text-center leading-tight px-0.5">{item.label}</span>
          </button>
        )
      })}
    </nav>
  )
}
