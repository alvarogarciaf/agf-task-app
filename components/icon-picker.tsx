import { useState, useMemo } from "react"
import { Search } from "lucide-react"
import { ICON_OPTIONS } from "@/lib/constants"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"

export function IconPicker({
  value,
  onChange,
  className,
}: {
  value: string
  onChange: (value: string) => void
  className?: string
}) {
  const [expanded, setExpanded] = useState(false)
  const [search, setSearch] = useState("")

  const filteredIcons = useMemo(() => {
    if (!search.trim()) return ICON_OPTIONS
    const lower = search.toLowerCase()
    return ICON_OPTIONS.filter((opt) => opt.name.toLowerCase().includes(lower))
  }, [search])

  const CurrentIcon = ICON_OPTIONS.find((o) => o.name === value)?.icon || ICON_OPTIONS[0].icon

  if (!expanded) {
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
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-primary bg-primary/10 text-primary shadow-sm">
          <CurrentIcon className="h-5 w-5" />
        </div>
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
        <Button variant="ghost" size="sm" type="button" onClick={() => setExpanded(false)}>
          Done
        </Button>
      </div>

      <div className="grid grid-cols-7 sm:grid-cols-9 gap-1.5 max-h-48 overflow-y-auto rounded-md border border-border bg-background/40 p-2 shadow-inner">
        {filteredIcons.length === 0 ? (
          <div className="col-span-full py-4 text-center text-sm text-muted-foreground">
            No icons found
          </div>
        ) : (
          filteredIcons.map((opt) => {
            const OptIcon = opt.icon
            const isSelected = value === opt.name
            return (
              <button
                key={opt.name}
                type="button"
                onClick={() => onChange(opt.name)}
                className={cn(
                  "flex h-10 w-10 items-center justify-center rounded-lg border transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  isSelected
                    ? "border-primary bg-primary/15 text-primary shadow-sm scale-110 z-10"
                    : "border-transparent text-muted-foreground hover:bg-muted hover:text-foreground hover:scale-105"
                )}
                title={opt.name}
                aria-label={opt.name}
              >
                <OptIcon className="h-5 w-5" />
              </button>
            )
          })
        )}
      </div>
    </div>
  )
}
