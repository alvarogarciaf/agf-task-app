"use client"

import { Home, Inbox, ListChecks, FolderKanban, Tags, Users } from "lucide-react"
import { cn } from "@/lib/utils"
import type { ViewKey } from "@/lib/types"

interface MobileNavProps {
  active: ViewKey
  onChange: (key: ViewKey) => void
  inboxCount: number
}

export function MobileNav({ active, onChange, inboxCount }: MobileNavProps) {
  const items = [
    { key: "home" as ViewKey, label: "Inbox", icon: Home, badge: inboxCount },
    { key: "all" as ViewKey, label: "Tasks", icon: ListChecks },
    { key: "projects" as ViewKey, label: "Projects", icon: FolderKanban },
    { key: "contexts" as ViewKey, label: "Contexts", icon: Tags },
    { key: "persons" as ViewKey, label: "People", icon: Users },
  ]

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 flex h-16 items-center justify-around border-t border-border bg-background/90 backdrop-blur pb-safe px-2">
      {items.map((item) => {
        const Icon = item.icon
        const isActive = active === item.key
        return (
          <button
            key={item.key}
            onClick={() => onChange(item.key)}
            className={cn(
              "relative flex flex-col items-center justify-center w-full h-full gap-1 text-[10px] font-medium transition-colors",
              isActive ? "text-primary" : "text-muted-foreground hover:text-foreground"
            )}
          >
            <div className="relative">
              <Icon className="h-5 w-5" />
              {item.badge !== undefined && item.badge > 0 && (
                <span className="absolute -top-1.5 -right-2 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[9px] font-bold text-primary-foreground">
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
