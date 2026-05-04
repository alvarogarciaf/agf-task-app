"use client"

import { useState } from "react"
import { Users, Tags, AlertCircle, Plus, Edit2, Trash2, Check, X } from "lucide-react"
import { cn } from "@/lib/utils"
import type { Context, Person, UrgencyLevel } from "@/lib/types"

interface SettingsViewProps {
  persons: Person[]
  contexts: Context[]
  urgencies: UrgencyLevel[]
  onAddPerson: (person: Omit<Person, "id">) => void
  onUpdatePerson: (person: Person) => void
  onDeletePerson: (id: string) => void
  onAddContext: (context: Omit<Context, "id">) => void
  onUpdateContext: (context: Context) => void
  onDeleteContext: (id: string) => void
  onAddUrgency: (urgency: Omit<UrgencyLevel, "id">) => void
  onUpdateUrgency: (urgency: UrgencyLevel) => void
  onDeleteUrgency: (id: string) => void
}

type TabKey = "persons" | "contexts" | "urgencies"

export function SettingsView({
  persons,
  contexts,
  urgencies,
  onAddPerson,
  onUpdatePerson,
  onDeletePerson,
  onAddContext,
  onUpdateContext,
  onDeleteContext,
  onAddUrgency,
  onUpdateUrgency,
  onDeleteUrgency,
}: SettingsViewProps) {
  const [tab, setTab] = useState<TabKey>("persons")

  return (
    <div className="max-w-4xl mx-auto">
      {/* Tabs */}
      <div className="flex items-center gap-1 border-b border-border mb-6">
        <TabButton active={tab === "persons"} onClick={() => setTab("persons")} icon={Users}>
          People
        </TabButton>
        <TabButton active={tab === "contexts"} onClick={() => setTab("contexts")} icon={Tags}>
          Contexts
        </TabButton>
        <TabButton active={tab === "urgencies"} onClick={() => setTab("urgencies")} icon={AlertCircle}>
          Urgencies
        </TabButton>
      </div>

      {/* Content */}
      <div className="bg-card border border-border rounded-lg overflow-hidden">
        {tab === "persons" && (
          <EntityManager
            title="People"
            description="Manage the people you assign tasks to."
            items={persons}
            onAdd={onAddPerson}
            onUpdate={onUpdatePerson}
            onDelete={onDeletePerson}
            fields={[
              { key: "name", label: "Name", type: "text" },
              { key: "initials", label: "Initials", type: "text", width: "w-20" },
              { key: "color", label: "Color (oklch, hex, etc)", type: "text", width: "w-48" },
            ]}
            renderAvatar={(item) => (
              <div
                className="flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-semibold text-foreground mr-3 shrink-0"
                style={{ backgroundColor: `color-mix(in oklch, ${item.color} 30%, transparent)` }}
              >
                {item.initials}
              </div>
            )}
          />
        )}

        {tab === "contexts" && (
          <EntityManager
            title="Contexts"
            description="Manage the contexts/tags you assign to tasks."
            items={contexts}
            onAdd={onAddContext}
            onUpdate={onUpdateContext}
            onDelete={onDeleteContext}
            fields={[
              { key: "name", label: "Name", type: "text" },
              { key: "icon", label: "Icon Name", type: "text", width: "w-32" },
              { key: "color", label: "Color", type: "text", width: "w-48" },
            ]}
            renderAvatar={(item) => (
              <span
                className="h-2 w-2 rounded-full mr-3 shrink-0"
                style={{ backgroundColor: item.color }}
              />
            )}
          />
        )}

        {tab === "urgencies" && (
          <EntityManager
            title="Urgencies"
            description="Manage urgency levels. They will be sorted by Order."
            items={[...urgencies].sort((a, b) => a.order - b.order)}
            onAdd={onAddUrgency}
            onUpdate={onUpdateUrgency}
            onDelete={onDeleteUrgency}
            fields={[
              { key: "name", label: "Name", type: "text" },
              { key: "color", label: "Color", type: "text", width: "w-48" },
              { key: "order", label: "Order", type: "number", width: "w-24" },
            ]}
            renderAvatar={(item) => (
              <span
                className="h-2 w-2 rounded-full mr-3 shrink-0"
                style={{ backgroundColor: item.color }}
              />
            )}
          />
        )}
      </div>
    </div>
  )
}

function TabButton({
  active,
  onClick,
  icon: Icon,
  children,
}: {
  active: boolean
  onClick: () => void
  icon: React.ComponentType<{ className?: string }>
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "relative inline-flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium transition-colors",
        active ? "text-primary" : "text-muted-foreground hover:text-foreground"
      )}
    >
      <Icon className="h-4 w-4" />
      {children}
      {active && (
        <span className="absolute inset-x-0 -bottom-px h-0.5 bg-primary rounded-t-full" />
      )}
    </button>
  )
}

interface EntityManagerProps<T> {
  title: string
  description: string
  items: T[]
  onAdd: (item: Omit<T, "id">) => void
  onUpdate: (item: T) => void
  onDelete: (id: string) => void
  fields: { key: keyof T; label: string; type: "text" | "number"; width?: string }[]
  renderAvatar: (item: T) => React.ReactNode
}

function EntityManager<T extends { id: string }>({
  title,
  description,
  items,
  onAdd,
  onUpdate,
  onDelete,
  fields,
  renderAvatar,
}: EntityManagerProps<T>) {
  const [editingId, setEditingId] = useState<string | null>(null)
  const [draft, setDraft] = useState<Partial<T>>({})
  const [isAdding, setIsAdding] = useState(false)

  const startEditing = (item: T) => {
    setEditingId(item.id)
    setDraft({ ...item })
    setIsAdding(false)
  }

  const startAdding = () => {
    setEditingId(null)
    setDraft({})
    setIsAdding(true)
  }

  const cancel = () => {
    setEditingId(null)
    setIsAdding(false)
    setDraft({})
  }

  const save = () => {
    if (isAdding) {
      onAdd(draft as Omit<T, "id">)
      setIsAdding(false)
    } else if (editingId) {
      onUpdate(draft as T)
      setEditingId(null)
    }
    setDraft({})
  }

  return (
    <div>
      <div className="flex items-center justify-between p-4 border-b border-border bg-muted/20">
        <div>
          <h3 className="font-semibold text-sm">{title}</h3>
          <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
        </div>
        <button
          type="button"
          onClick={startAdding}
          disabled={isAdding}
          className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          <Plus className="h-3 w-3" />
          Add New
        </button>
      </div>

      <div className="divide-y divide-border">
        {isAdding && (
          <div className="p-4 bg-primary/5 animate-in fade-in slide-in-from-top-2">
            <div className="flex flex-wrap items-end gap-3">
              {fields.map((f) => (
                <div key={f.key as string} className={f.width || "flex-1 min-w-[120px]"}>
                  <label className="block text-[10px] font-mono uppercase tracking-wider text-muted-foreground mb-1">
                    {f.label}
                  </label>
                  <input
                    type={f.type}
                    value={(draft[f.key] as any) || ""}
                    onChange={(e) =>
                      setDraft((prev) => ({
                        ...prev,
                        [f.key]: f.type === "number" ? Number(e.target.value) : e.target.value,
                      }))
                    }
                    className="w-full h-8 px-2 text-sm rounded border border-border bg-background focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>
              ))}
              <div className="flex gap-2 pb-0.5">
                <button
                  type="button"
                  onClick={cancel}
                  className="p-1.5 text-muted-foreground hover:text-foreground rounded border border-transparent hover:border-border hover:bg-muted"
                >
                  <X className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={save}
                  className="p-1.5 text-primary hover:text-primary-foreground rounded border border-transparent hover:bg-primary"
                >
                  <Check className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        )}

        {items.length === 0 && !isAdding ? (
          <div className="p-8 text-center text-sm text-muted-foreground">No {title.toLowerCase()} found.</div>
        ) : (
          items.map((item) => {
            const isEditing = editingId === item.id

            if (isEditing) {
              return (
                <div key={item.id} className="p-4 bg-primary/5">
                  <div className="flex flex-wrap items-end gap-3">
                    {fields.map((f) => (
                      <div key={f.key as string} className={f.width || "flex-1 min-w-[120px]"}>
                        <label className="block text-[10px] font-mono uppercase tracking-wider text-muted-foreground mb-1">
                          {f.label}
                        </label>
                        <input
                          type={f.type}
                          value={(draft[f.key] as any) || ""}
                          onChange={(e) =>
                            setDraft((prev) => ({
                              ...prev,
                              [f.key]: f.type === "number" ? Number(e.target.value) : e.target.value,
                            }))
                          }
                          className="w-full h-8 px-2 text-sm rounded border border-border bg-background focus:outline-none focus:ring-1 focus:ring-primary"
                        />
                      </div>
                    ))}
                    <div className="flex gap-2 pb-0.5">
                      <button
                        type="button"
                        onClick={cancel}
                        className="p-1.5 text-muted-foreground hover:text-foreground rounded border border-transparent hover:border-border hover:bg-muted"
                      >
                        <X className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={save}
                        className="p-1.5 text-primary hover:text-primary-foreground rounded border border-transparent hover:bg-primary"
                      >
                        <Check className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </div>
              )
            }

            return (
              <div
                key={item.id}
                className="group flex items-center justify-between p-4 hover:bg-muted/30 transition-colors"
              >
                <div className="flex items-center min-w-0 flex-1">
                  {renderAvatar(item)}
                  <div className="flex gap-4 min-w-0">
                    {fields.map((f) => (
                      <div key={f.key as string} className="truncate text-sm">
                        <span className="hidden lg:inline-block text-[10px] font-mono text-muted-foreground mr-2">
                          {f.key as string}:
                        </span>
                        {String(item[f.key])}
                      </div>
                    ))}
                  </div>
                </div>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity ml-4">
                  <button
                    type="button"
                    onClick={() => startEditing(item)}
                    className="p-1.5 text-muted-foreground hover:text-foreground rounded hover:bg-muted"
                  >
                    <Edit2 className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => onDelete(item.id)}
                    className="p-1.5 text-muted-foreground hover:text-destructive rounded hover:bg-destructive/10"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
