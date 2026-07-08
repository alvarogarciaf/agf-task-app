"use client"

import { X, FolderClosed, Briefcase, TagIcon, Star } from "lucide-react"
import { cn } from "@/lib/utils"
import type { Context, Project, Tag, SavedView } from "@/lib/types"
import { ICONS } from "@/lib/constants"

interface MobileSelectorProps {
  isOpen: boolean
  type: "contexts" | "projects" | "tags" | "views" | null
  onClose: () => void
  onSelectContext: (id: string) => void
  onSelectProject: (id: string) => void
  onSelectTag: (id: string) => void
  onSelectView: (id: string) => void
  contexts: Context[]
  projects: Project[]
  tags: Tag[]
  savedViews: SavedView[]
}

export function MobileSelector({
  isOpen,
  type,
  onClose,
  onSelectContext,
  onSelectProject,
  onSelectTag,
  onSelectView,
  contexts,
  projects,
  tags,
  savedViews,
}: MobileSelectorProps) {
  if (!isOpen || !type) return null

  const getTitle = () => {
    switch (type) {
      case "contexts": return "Select Context"
      case "projects": return "Select Project"
      case "tags": return "Select Tag"
      case "views": return "Select View"
      default: return ""
    }
  }

  const renderContent = () => {
    if (type === "contexts") {
      if (contexts.length === 0) return <div className="p-8 text-center text-muted-foreground italic text-sm">No contexts found</div>
      return (
        <div className="flex flex-col">
          {contexts.map(c => {
            const Icon = ICONS[c.icon] || Briefcase
            return (
              <button key={c.id} onClick={() => { onSelectContext(c.id); onClose() }} className="flex items-center gap-3 p-4 border-b border-border hover:bg-accent transition-colors text-left">
                <Icon className="w-5 h-5 shrink-0" style={{ color: c.color }} />
                <span className="text-[15px] font-medium flex-1 truncate">{c.name}</span>
              </button>
            )
          })}
        </div>
      )
    }

    if (type === "projects") {
      if (projects.length === 0) return <div className="p-8 text-center text-muted-foreground italic text-sm">No projects found</div>
      return (
        <div className="flex flex-col">
          {projects.map(p => {
            const Icon = ICONS[p.icon || ""] || FolderClosed
            return (
              <button key={p.id} onClick={() => { onSelectProject(p.id); onClose() }} className="flex items-center gap-3 p-4 border-b border-border hover:bg-accent transition-colors text-left">
                <Icon className="w-5 h-5 shrink-0" style={{ color: p.color || undefined }} />
                <span className="text-[15px] font-medium flex-1 truncate">{p.name}</span>
              </button>
            )
          })}
        </div>
      )
    }

    if (type === "tags") {
      if (tags.length === 0) return <div className="p-8 text-center text-muted-foreground italic text-sm">No tags found</div>
      return (
        <div className="flex flex-col">
          {tags.map(t => {
            const Icon = ICONS[t.icon] || TagIcon
            return (
              <button key={t.id} onClick={() => { onSelectTag(t.id); onClose() }} className="flex items-center gap-3 p-4 border-b border-border hover:bg-accent transition-colors text-left">
                <Icon className="w-5 h-5 shrink-0" style={{ color: t.color || undefined }} />
                <span className="text-[15px] font-medium flex-1 truncate">{t.name}</span>
              </button>
            )
          })}
        </div>
      )
    }

    if (type === "views") {
      if (savedViews.length === 0) return <div className="p-8 text-center text-muted-foreground italic text-sm">No saved views found</div>
      return (
        <div className="flex flex-col">
          {savedViews.map(sv => {
            const Icon = ICONS[sv.icon] || Star
            return (
              <button key={sv.id} onClick={() => { onSelectView(sv.id); onClose() }} className="flex items-center gap-3 p-4 border-b border-border hover:bg-accent transition-colors text-left">
                <Icon className="w-5 h-5 shrink-0" style={{ color: sv.color }} />
                <span className="text-[15px] font-medium flex-1 truncate">{sv.name}</span>
              </button>
            )
          })}
        </div>
      )
    }
  }

  return (
    <>
      <div 
        className="fixed inset-0 bottom-[72px] z-[40] bg-black/50 animate-in fade-in duration-200"
        onClick={onClose}
      />
      <div className="fixed inset-x-0 bottom-[72px] top-0 z-[40] overflow-hidden pointer-events-none">
        <div className="absolute bottom-0 left-0 right-0 max-h-[85vh] bg-background flex flex-col rounded-t-xl border-t border-border animate-in slide-in-from-bottom duration-200 shadow-2xl pointer-events-auto">
          <header className="flex h-[60px] shrink-0 items-center justify-between border-b border-border px-4 pt-4 rounded-t-xl bg-background">
            <h2 className="text-[17px] font-semibold">{getTitle()}</h2>
            <button onClick={onClose} className="p-2 -mr-2 text-muted-foreground hover:text-foreground rounded-full transition-colors bg-secondary/50 hover:bg-secondary">
              <X className="w-5 h-5" />
            </button>
          </header>
          <div className="flex-1 overflow-y-auto overscroll-contain touch-pan-y" style={{ WebkitOverflowScrolling: "touch" }}>
            {renderContent()}
          </div>
        </div>
      </div>
    </>
  )
}
