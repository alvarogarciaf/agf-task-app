import { Check } from "lucide-react"
import { cn } from "@/lib/utils"
import { ObjectIcon } from "@/components/ui/object-icon"

export function DropdownListItem({
  id,
  label,
  color,
  icon,
  isSelected,
  onClick,
  onMouseEnter,
  isHighlighted,
  isCreate = false,
  isNone = false,
  forceIcon = false, // If true, always use ObjectIcon. If false, use dot when icon is missing.
  className,
}: {
  id: string | null
  label: string
  color?: string | null
  icon?: string | null
  isSelected?: boolean
  onClick: () => void
  onMouseEnter?: () => void
  isHighlighted?: boolean
  isCreate?: boolean
  isNone?: boolean
  forceIcon?: boolean
  className?: string
}) {
  return (
    <button
      type="button"
      onMouseEnter={onMouseEnter}
      onClick={onClick}
      className={cn(
        "flex w-full items-center gap-2.5 rounded-md px-2.5 py-3 text-left text-base md:py-1.5 md:text-sm transition-colors",
        isHighlighted && "bg-muted ring-1 ring-inset ring-primary/40",
        !isHighlighted && "hover:bg-muted",
        isNone && "text-muted-foreground",
        className
      )}
    >
      {isCreate ? (
        <ObjectIcon icon="Folder" color="#64748b" />
      ) : isNone ? (
        <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded border border-dashed border-border" />
      ) : icon || forceIcon ? (
        <ObjectIcon icon={icon} color={color} />
      ) : color ? (
        <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: color }} />
      ) : (
        <span className="h-2 w-2 shrink-0 rounded-full bg-muted-foreground/40" />
      )}
      <span className={cn("flex-1 truncate", isCreate && "text-primary font-medium")}>{label}</span>
      {isSelected && (
        <Check className="h-4 w-4 shrink-0 text-primary" />
      )}
    </button>
  )
}
