"use client"

import type { Person, Task } from "@/lib/types"

interface PersonsViewProps {
  persons: Person[]
  tasks: Task[]
  onSelect: (personId: string) => void
}

export function PersonsView({ persons, tasks, onSelect }: PersonsViewProps) {
  return (
    <div className="px-6 py-6">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
        {persons.map((p) => {
          const count = tasks.filter((t) => t.person_id === p.id).length
          const open = tasks.filter((t) => t.person_id === p.id && !t.processed).length
          return (
            <button
              key={p.id}
              type="button"
              onClick={() => onSelect(p.id)}
              className="group relative flex aspect-[4/3] flex-col justify-between overflow-hidden rounded-xl border border-border bg-card p-4 text-left transition-all hover:border-primary/40 hover:bg-card/80"
            >
              <div
                className="absolute -right-10 -top-10 h-28 w-28 rounded-full opacity-20 blur-2xl transition-opacity group-hover:opacity-40"
                style={{ backgroundColor: p.color }}
                aria-hidden
              />
              <div className="relative flex items-center justify-between">
                <div
                  className="flex h-10 w-10 items-center justify-center rounded-full text-sm font-semibold"
                  style={{
                    backgroundColor: `color-mix(in oklch, ${p.color} 25%, transparent)`,
                    color: p.color,
                  }}
                >
                  {p.initials}
                </div>
                {open > 0 ? (
                  <span className="rounded bg-primary/15 px-1.5 py-0.5 font-mono text-[10px] text-primary">
                    {open} open
                  </span>
                ) : null}
              </div>
              <div className="relative">
                <div className="text-base font-semibold tracking-tight">{p.name}</div>
                <div className="mt-0.5 flex items-baseline gap-1.5 font-mono text-[11px] text-muted-foreground">
                  <span className="text-base font-medium tabular-nums text-foreground">{count}</span>
                  <span>tasks linked</span>
                </div>
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}
