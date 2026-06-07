"use client"

import { Home, ListChecks, FileText, Star, Calendar } from "lucide-react"
import { cn } from "@/lib/utils"
import type { ViewKey, SavedView } from "@/lib/types"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { ICONS } from "@/lib/constants"

interface MobileNavProps {
  active: ViewKey
  activeSavedViewId?: string | null
  onChange: (key: ViewKey, savedViewId?: string) => void
  inboxCount: number
  todayCount: number
  savedViews: SavedView[]
}

export function MobileNav({ 
  active, 
  activeSavedViewId,
  onChange, 
  inboxCount,
  todayCount,
  savedViews 
}: MobileNavProps) {
  const items = [
    { key: "home" as ViewKey, label: "Inbox", icon: Home, badge: inboxCount },
    { key: "today" as ViewKey, label: "Today", icon: Calendar, badge: todayCount },
    { key: "all" as ViewKey, label: "Tasks", icon: ListChecks },
    { key: "notes" as ViewKey, label: "Notes", icon: FileText },
  ]

  const isSavedViewActive = active === "saved-view"

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 flex h-[72px] items-center justify-around border-t border-border bg-background/90 backdrop-blur pb-safe px-2">
      {items.map((item) => {
        const Icon = item.icon
        const isActive = active === item.key
        return (
          <button
            key={item.key}
            onClick={() => onChange(item.key)}
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

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            className={cn(
              "relative flex flex-col items-center justify-center w-full h-full gap-1 text-[11px] font-medium transition-colors",
              isSavedViewActive ? "text-primary" : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Star className="h-6 w-6" />
            <span>Views</span>
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" side="top" sideOffset={12} className="w-64">
          {savedViews.length === 0 ? (
            <div className="px-4 py-6 text-[15px] text-muted-foreground italic text-center">
              No saved views yet
            </div>
          ) : (
            savedViews.map((sv) => {
              const Icon = ICONS[sv.icon] || Star
              const isActive = active === "saved-view" && activeSavedViewId === sv.id
              return (
                <DropdownMenuItem 
                  key={sv.id}
                  onClick={() => onChange("saved-view", sv.id)}
                  className={cn(
                    "py-3 px-3",
                    isActive && "bg-accent text-accent-foreground"
                  )}
                >
                  <Icon className="mr-3 h-5 w-5" style={{ color: sv.color }} />
                  <span className="flex-1 truncate text-[15px] font-medium">{sv.name}</span>
                </DropdownMenuItem>
              )
            })
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </nav>
  )
}
