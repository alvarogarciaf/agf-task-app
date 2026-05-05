"use client"

import { Home, ListChecks, FolderKanban, Tags, Users, Star } from "lucide-react"
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
  savedViews: SavedView[]
}

export function MobileNav({ 
  active, 
  activeSavedViewId,
  onChange, 
  inboxCount,
  savedViews 
}: MobileNavProps) {
  const items = [
    { key: "home" as ViewKey, label: "Inbox", icon: Home, badge: inboxCount },
    { key: "all" as ViewKey, label: "Tasks", icon: ListChecks },
    { key: "projects" as ViewKey, label: "Projects", icon: FolderKanban },
    { key: "contexts" as ViewKey, label: "Contexts", icon: Tags },
    { key: "persons" as ViewKey, label: "People", icon: Users },
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
        <DropdownMenuContent align="end" side="top" sideOffset={12} className="w-56">
          {savedViews.length === 0 ? (
            <div className="px-2 py-1.5 text-sm text-muted-foreground italic">
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
                  className={cn(isActive && "bg-accent text-accent-foreground")}
                >
                  <Icon className="mr-2 h-4 w-4" style={{ color: sv.color }} />
                  <span className="flex-1 truncate">{sv.name}</span>
                </DropdownMenuItem>
              )
            })
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </nav>
  )
}
