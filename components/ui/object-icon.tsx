import { cn } from "@/lib/utils"
import { ICONS } from "@/lib/constants"
import { FolderKanban } from "lucide-react"

export function ObjectIcon({
  icon,
  color,
  size = "sm",
  plain = false,
  defaultIcon = "Layers",
}: {
  icon?: string | null
  color?: string | null
  size?: "sm" | "md"
  plain?: boolean
  defaultIcon?: string
}) {
  const Icon = icon && ICONS[icon] ? ICONS[icon] : (ICONS[defaultIcon] || FolderKanban)
  const box = size === "sm" ? "h-5 w-5 rounded" : "h-6 w-6 rounded-md"
  const glyph = size === "sm" ? "h-3 w-3" : "h-3.5 w-3.5"

  if (plain) {
    return <Icon className={cn("shrink-0", glyph, !color && "text-muted-foreground")} style={color ? { color } : undefined} />
  }

  return (
    <div
      className={cn("flex shrink-0 items-center justify-center", box)}
      style={
        color
          ? {
              backgroundColor: `color-mix(in oklch, ${color} 15%, transparent)`,
              color: color,
              boxShadow: `inset 0 0 0 1px color-mix(in oklch, ${color} 30%, transparent)`,
            }
          : {
              backgroundColor: "var(--muted)",
              color: "var(--muted-foreground)",
            }
      }
    >
      <Icon className={cn(glyph, !color && "text-primary")} />
    </div>
  )
}
