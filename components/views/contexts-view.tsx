"use client"

import {
  Brain,
  Phone,
  ShoppingBag,
  Home,
  Eye,
  PenLine,
  WifiOff,
  Zap,
  type LucideIcon,
} from "lucide-react"
import type { Context, Task } from "@/lib/types"

const ICONS: Record<string, LucideIcon> = {
  Brain,
  Phone,
  ShoppingBag,
  Home,
  Eye,
  PenLine,
  WifiOff,
  Zap,
}

interface ContextsViewProps {
  contexts: Context[]
  tasks: Task[]
  onSelect: (contextId: string) => void
}

export function ContextsView({ contexts, tasks, onSelect }: ContextsViewProps) {
  return (
    <div className="px-6 py-6">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
        {contexts.map((c) => {
          const Icon = ICONS[c.icon] ?? Brain
          const count = tasks.filter((t) => t.context_ids.includes(c.id)).length
          const open = tasks.filter((t) => t.context_ids.includes(c.id) && !t.processed).length
          return (
            <button
              key={c.id}
              type="button"
              onClick={() => onSelect(c.id)}
              className="group relative flex aspect-[4/3] flex-col justify-between overflow-hidden rounded-xl border border-border bg-card p-4 text-left transition-all hover:border-primary/40 hover:bg-card/80"
            >
              <div
                className="absolute -right-8 -top-8 h-24 w-24 rounded-full opacity-20 blur-2xl transition-opacity group-hover:opacity-40"
                style={{ backgroundColor: c.color }}
                aria-hidden
              />

              <div className="relative flex items-center justify-between">
                <div
                  className="flex h-9 w-9 items-center justify-center rounded-md ring-1"
                  style={{
                    backgroundColor: `color-mix(in oklch, ${c.color} 15%, transparent)`,
                    color: c.color,
                    // ring color
                    boxShadow: `inset 0 0 0 1px color-mix(in oklch, ${c.color} 35%, transparent)`,
                  }}
                >
                  <Icon className="h-4 w-4" />
                </div>
                {open > 0 ? (
                  <span className="rounded bg-primary/15 px-1.5 py-0.5 font-mono text-[10px] text-primary">
                    {open} open
                  </span>
                ) : null}
              </div>

              <div className="relative">
                <div className="text-base font-semibold tracking-tight">{c.name}</div>
                <div className="mt-0.5 flex items-baseline gap-1.5 font-mono text-[11px] text-muted-foreground">
                  <span className="text-base font-medium tabular-nums text-foreground">{count}</span>
                  <span>tasks total</span>
                </div>
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}
