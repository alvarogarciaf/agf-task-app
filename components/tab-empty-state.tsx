"use client"

import { LayoutGrid, Search } from "lucide-react"

export function TabEmptyState() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center px-6 py-16 text-center">
      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-muted">
        <LayoutGrid className="h-6 w-6 text-muted-foreground" />
      </div>
      <h2 className="text-lg font-semibold tracking-tight">Choose a page</h2>
      <p className="mt-2 max-w-sm text-sm text-muted-foreground">
        Pick a destination in the sidebar, or press{" "}
        <kbd className="rounded border border-border bg-muted px-1.5 py-0.5 font-mono text-[10px]">
          Ctrl+K
        </kbd>{" "}
        to search and open something.
      </p>
      <div className="mt-6 flex items-center gap-2 text-xs text-muted-foreground">
        <Search className="h-3.5 w-3.5" />
        <span>Each tab keeps its own page and open dialogs</span>
      </div>
    </div>
  )
}
