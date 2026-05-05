"use client"

import { useState } from "react"
import { Users, Tags, AlertCircle, Plus, Edit2, Trash2, Check, X, RefreshCw, Info, Database, Calendar, Copy, LogOut } from "lucide-react"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import { useGoogleCalendar } from "@/components/google-calendar-provider"
import type { Context, Person, UrgencyLevel } from "@/lib/types"
import type { SyncStatus } from "@/components/db-provider"

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
  onDeleteAllTasks?: () => void
  onResetDatabase?: () => void
  syncStatus?: SyncStatus
  userUid?: string
  onSyncCalendar?: (accessToken: string) => Promise<void>
}

type TabKey = "persons" | "contexts" | "urgencies" | "calendar" | "data" | "troubleshoot"

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
  onDeleteAllTasks,
  onResetDatabase,
  syncStatus,
  userUid,
  onSyncCalendar,
}: SettingsViewProps) {
  const [tab, setTab] = useState<TabKey>("persons")
  const { accessToken, isConnected, connect, disconnect } = useGoogleCalendar()
  const [isSyncing, setIsSyncing] = useState(false)

  const handleSync = async () => {
    if (!accessToken || !onSyncCalendar) return
    setIsSyncing(true)
    try {
      await onSyncCalendar(accessToken)
      toast.success("Calendar synced successfully!")
    } catch (err: any) {
      console.error("Sync failed:", err)
      toast.error(err.message || "Failed to sync calendar.")
    } finally {
      setIsSyncing(false)
    }
  }

  const handleConnect = async () => {
    try {
      await connect()
      toast.success("Google Calendar connected!")
    } catch (err) {
      toast.error("Failed to connect Google Calendar.")
    }
  }

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
        <TabButton active={tab === "calendar"} onClick={() => setTab("calendar")} icon={Calendar}>
          Calendar
        </TabButton>
        <TabButton active={tab === "data"} onClick={() => setTab("data")} icon={Trash2}>
          Data
        </TabButton>
        <TabButton active={tab === "troubleshoot"} onClick={() => setTab("troubleshoot")} icon={Info}>
          Sync & Debug
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
              { key: "color", label: "Color", type: "color", width: "w-24" },
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
              { key: "color", label: "Color", type: "color", width: "w-24" },
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
              { key: "color", label: "Color", type: "color", width: "w-24" },
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

        {tab === "calendar" && (
          <div className="p-8">
            <h3 className="text-lg font-semibold mb-2">Google Calendar Push</h3>
            <p className="text-sm text-muted-foreground mb-6">
              Automatically push tasks with an <strong>Action Date</strong> directly to your Google Calendar as events.
            </p>

            <div className="space-y-6">
              <div className="rounded-lg border border-border bg-muted/30 p-6 flex flex-col items-center text-center">
                <div className={cn(
                  "h-12 w-12 rounded-full flex items-center justify-center mb-4",
                  isConnected ? "bg-green-500/10 text-green-500" : "bg-primary/10 text-primary"
                )}>
                  <Calendar className="h-6 w-6" />
                </div>
                
                <h4 className="font-medium mb-1">
                  {isConnected ? "Connected to Google Calendar" : "Not Connected"}
                </h4>
                <p className="text-xs text-muted-foreground mb-6 max-w-xs">
                  {isConnected 
                    ? "Your tasks will now be pushed directly to your primary calendar." 
                    : "Connect your Google account to start pushing tasks to your calendar."}
                </p>

                <div className="flex gap-3">
                  {isConnected ? (
                    <>
                      <button
                        type="button"
                        onClick={handleSync}
                        disabled={isSyncing}
                        className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                      >
                        <RefreshCw className={cn("h-4 w-4", isSyncing && "animate-spin")} />
                        {isSyncing ? "Syncing..." : "Push All Tasks"}
                      </button>
                      <button
                        type="button"
                        onClick={disconnect}
                        className="inline-flex items-center gap-2 rounded-md bg-secondary px-4 py-2 text-sm font-medium hover:bg-secondary/80 text-destructive"
                      >
                        <LogOut className="h-4 w-4" />
                        Disconnect
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      onClick={handleConnect}
                      className="inline-flex items-center gap-2 rounded-md bg-primary px-6 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
                    >
                      Connect Google Calendar
                    </button>
                  )}
                </div>
              </div>

              <div className="p-4 rounded-lg border border-primary/20 bg-primary/5">
                <div className="flex gap-3">
                  <Info className="h-5 w-5 text-primary shrink-0" />
                  <div className="text-xs text-muted-foreground space-y-2">
                    <p className="font-semibold text-foreground">How Direct Push Works</p>
                    <p>
                      Unlike the previous sync method, this <strong>directly creates events</strong> in your calendar. 
                      Changes you make to a task's description or date will be updated instantly in Google Calendar.
                    </p>
                    <p>
                      <strong>Note:</strong> You may need to grant "Calendar" permissions when connecting.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {tab === "data" && (
          <div className="p-8">
            <h3 className="text-lg font-semibold mb-2">Data Management</h3>
            <p className="text-sm text-muted-foreground mb-6">
              Use these tools to clear your account data. These actions are permanent.
            </p>

            <div className="space-y-4">
              <div className="p-4 border border-destructive/20 bg-destructive/5 rounded-lg flex items-center justify-between">
                <div>
                  <h4 className="font-medium text-destructive">Clear All Tasks</h4>
                  <p className="text-xs text-muted-foreground mt-1">
                    Permanently delete every task in your account.
                  </p>
                </div>
                <button
                  onClick={() => {
                    if (confirm("Are you sure you want to delete ALL tasks? This cannot be undone.")) {
                      onDeleteAllTasks?.()
                    }
                  }}
                  className="px-4 py-2 bg-destructive text-destructive-foreground text-xs font-medium rounded-md hover:bg-destructive/90 transition-colors"
                >
                  Delete Everything
                </button>
              </div>
            </div>
          </div>
        )}

        {tab === "troubleshoot" && (
          <div className="p-8">
            <h3 className="text-lg font-semibold mb-2 flex items-center gap-2">
              <Info className="h-5 w-5 text-primary" />
              Sync & Debug
            </h3>
            <p className="text-sm text-muted-foreground mb-6">
              Tools for diagnosing synchronization issues and managing your local state.
            </p>

            <div className="space-y-6">
              {/* Sync Status Cards */}
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="p-4 rounded-lg border border-border bg-muted/30">
                  <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground mb-1">User ID</div>
                  <div className="text-sm font-mono truncate select-all" title={userUid}>
                    {userUid || "Not authenticated"}
                  </div>
                </div>
                <div className="p-4 rounded-lg border border-border bg-muted/30">
                  <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground mb-1">Online Status</div>
                  <div className="flex items-center gap-2 text-sm font-medium">
                    {syncStatus?.browserOnline ? (
                      <>
                        <div className="h-2 w-2 rounded-full bg-primary" />
                        Online
                      </>
                    ) : (
                      <>
                        <div className="h-2 w-2 rounded-full bg-muted-foreground" />
                        Offline
                      </>
                    )}
                  </div>
                </div>
              </div>

              {/* Replication Info */}
              <div className="p-4 rounded-lg border border-border">
                <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
                  <Database className="h-4 w-4 text-muted-foreground" />
                  Cloud Replication
                </h4>
                
                <div className="space-y-3">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">Status</span>
                    <span className={cn(
                      "font-medium",
                      syncStatus?.replicationError ? "text-destructive" : "text-primary"
                    )}>
                      {syncStatus?.replicationError ? "Error" : syncStatus?.replicationActive ? "Active" : "Idle"}
                    </span>
                  </div>
                  
                  {syncStatus?.replicationError && (
                    <div className="p-3 rounded bg-destructive/10 border border-destructive/20 text-xs text-destructive flex items-start gap-2">
                      <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                      <div className="break-all">{syncStatus.replicationError}</div>
                    </div>
                  )}

                  <div className="pt-2 border-t border-border flex items-center justify-between">
                    <span className="text-[10px] text-muted-foreground italic">
                      Live sync is enabled for all collections.
                    </span>
                  </div>
                </div>
              </div>

              {/* Reset Database Section */}
              <div className="p-4 border border-orange-200 bg-orange-50 dark:bg-orange-950/20 dark:border-orange-900/30 rounded-lg">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h4 className="font-medium text-orange-800 dark:text-orange-400">Reset Local Database</h4>
                    <p className="text-xs text-orange-700/70 dark:text-orange-500/70 mt-1 leading-relaxed">
                      If your data looks inconsistent (e.g. projects differ between devices), resetting will wipe your local 
                      IndexedDB and re-download everything from Firestore. No cloud data will be lost.
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      if (confirm("This will clear your local database and reload the page. Your cloud data is safe. Continue?")) {
                        onResetDatabase?.()
                      }
                    }}
                    className="shrink-0 inline-flex items-center gap-2 px-4 py-2 bg-orange-600 text-white text-xs font-medium rounded-md hover:bg-orange-700 transition-colors"
                  >
                    <RefreshCw className="h-3 w-3" />
                    Reset & Reload
                  </button>
                </div>
              </div>
            </div>
          </div>
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
  fields: { key: keyof T; label: string; type: "text" | "number" | "color"; width?: string }[]
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
                  <div className="flex items-center gap-2">
                    {f.type === "color" && (
                      <div 
                        className="h-8 w-8 rounded border border-border shrink-0" 
                        style={{ backgroundColor: (draft[f.key] as any) || "#000000" }} 
                      />
                    )}
                    <input
                      type={f.type}
                      value={(draft[f.key] as any) || (f.type === "color" ? "#000000" : "")}
                      onChange={(e) =>
                        setDraft((prev) => ({
                          ...prev,
                          [f.key]: f.type === "number" ? Number(e.target.value) : e.target.value,
                        }))
                      }
                      className={cn(
                        "h-8 px-2 text-sm rounded border border-border bg-background focus:outline-none focus:ring-1 focus:ring-primary",
                        f.type === "color" ? "w-12 p-0 border-none bg-transparent cursor-pointer" : "w-full"
                      )}
                    />
                    {f.type === "color" && (
                      <span className="text-[10px] font-mono text-muted-foreground truncate max-w-[80px]">
                        {String(draft[f.key] || "#000000")}
                      </span>
                    )}
                  </div>
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
