import { useState, useMemo } from "react"
import { Search } from "lucide-react"
import { ICON_OPTIONS } from "@/lib/constants"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"

export function IconPicker({
  value,
  onChange,
  className,
  inline = false,
}: {
  value: string
  onChange: (value: string) => void
  className?: string
  inline?: boolean
}) {
  const [expanded, setExpanded] = useState(inline)
  const [search, setSearch] = useState("")

  const filteredIcons = useMemo(() => {
    if (!search.trim()) return ICON_OPTIONS
    const lower = search.toLowerCase()
    return ICON_OPTIONS.filter((opt) => opt.name.toLowerCase().includes(lower))
  }, [search])

  const groupedIcons = useMemo(() => {
    const groups: { category: string; icons: typeof ICON_OPTIONS }[] = []
    const categoryMap = new Map<string, typeof ICON_OPTIONS>()

    filteredIcons.forEach((opt) => {
      const cat = opt.category || "General & Symbols"
      if (!categoryMap.has(cat)) {
        categoryMap.set(cat, [])
      }
      categoryMap.get(cat)!.push(opt)
    })

    categoryMap.forEach((icons, category) => {
      groups.push({ category, icons })
    })

    return groups
  }, [filteredIcons])

  const CurrentIcon = ICON_OPTIONS.find((o) => o.name === value)?.icon || ICON_OPTIONS[0].icon

  if (!expanded && !inline) {
    return (
      <div className={cn("flex items-center gap-3", className)}>
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-primary bg-primary/10 text-primary shadow-sm">
          <CurrentIcon className="h-5 w-5" />
        </div>
        <Button variant="outline" type="button" onClick={() => setExpanded(true)}>
          Change Icon
        </Button>
      </div>
    )
  }

  return (
    <div className={cn("flex flex-col gap-3", className)}>
      <div className="flex items-center gap-3">
        {!inline && (
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-primary bg-primary/10 text-primary shadow-sm">
            <CurrentIcon className="h-5 w-5" />
          </div>
        )}
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <input
            autoFocus
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search icons..."
            className="flex h-9 w-full rounded-md border border-input bg-transparent pl-8 pr-3 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          />
        </div>
        {!inline && (
          <Button variant="ghost" size="sm" type="button" onClick={() => setExpanded(false)}>
            Done
          </Button>
        )}
      </div>

      <div className="max-h-80 overflow-y-auto rounded-md border border-border bg-background/40 p-2.5 shadow-inner space-y-3">
        {groupedIcons.length === 0 ? (
          <div className="py-6 text-center text-sm text-muted-foreground">
            No icons found
          </div>
        ) : (
          groupedIcons.map((group) => (
            <div key={group.category} className="space-y-1.5">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground px-1 pt-1 flex items-center justify-between">
                <span>{group.category}</span>
                <span className="text-[10px] opacity-60 font-mono">{group.icons.length}</span>
              </div>
              <div className="grid grid-cols-7 sm:grid-cols-8 gap-1.5">
                {group.icons.map((opt) => {
                  const OptIcon = opt.icon
                  const isSelected = value === opt.name
                  return (
                    <button
                      key={opt.name}
                      type="button"
                      onClick={() => onChange(opt.name)}
                      className={cn(
                        "flex h-9 w-9 items-center justify-center rounded-lg border transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                        isSelected
                          ? "border-primary bg-primary/15 text-primary shadow-sm scale-110 z-10"
                          : "border-transparent text-muted-foreground hover:bg-muted hover:text-foreground hover:scale-105"
                      )}
                      title={opt.name}
                      aria-label={opt.name}
                    >
                      <OptIcon className="h-4.5 w-4.5" />
                    </button>
                  )
                })}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
