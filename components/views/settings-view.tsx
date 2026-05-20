"use client"

import React, { useState, useEffect, useRef } from "react"
import { Users, Tags, AlertCircle, Plus, Edit2, Trash2, Check, X, RefreshCw, Info, Database, Calendar, Copy, LogOut, Bell, BellOff, BellRing, CheckCircle2, XCircle, ShieldAlert } from "lucide-react"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import { useGoogleCalendar } from "@/components/google-calendar-provider"
import { listGoogleCalendars, type GoogleCalendar } from "@/lib/google-calendar"
import { useAuth } from "@/components/auth-provider"
import { collection, doc, setDoc, deleteDoc, getDocs } from "firebase/firestore"
import { firestoreDb } from "@/lib/firebase/config"
import type { Context, Person, UrgencyLevel } from "@/lib/types"
import type { SyncStatus } from "@/components/db-provider"

export type TabKey = "persons" | "contexts" | "urgencies" | "calendar" | "data" | "notifications" | "troubleshoot"

interface SettingsViewProps {
  activeTab?: TabKey
  onTabChange?: (tab: TabKey) => void
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
  userUid?: string
  onSyncCalendar?: (accessToken: string) => Promise<void>
  syncStatus?: SyncStatus
}

export function SettingsView({
  activeTab: controlledTab,
  onTabChange,
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
  const [internalTab, setInternalTab] = useState<TabKey>("persons")
  const tab = controlledTab || internalTab
  const setTab = onTabChange || setInternalTab
  const activeTabRef = useRef<HTMLButtonElement | null>(null)
  const { accessToken, isConnected, connect, disconnect, selectedCalendarId, selectCalendar } = useGoogleCalendar()
  const [isSyncing, setIsSyncing] = useState(false)
  const [calendars, setCalendars] = useState<GoogleCalendar[]>([])
  const [isLoadingCalendars, setIsLoadingCalendars] = useState(false)

  // Scroll active tab button into view on mobile when tab changes
  useEffect(() => {
    activeTabRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" })
  }, [tab])

  // Fetch calendars when tab is opened
  useEffect(() => {
    if (tab === "calendar" && accessToken) {
      const fetchCalendars = async () => {
        setIsLoadingCalendars(true)
        try {
          const list = await listGoogleCalendars(accessToken)
          setCalendars(list)
          
          // If no calendar is selected, default to primary
          if (!selectedCalendarId || selectedCalendarId === 'primary') {
            const primary = list.find(c => c.primary)?.id || 'primary'
            if (primary !== 'primary') selectCalendar(primary)
          }
        } catch (err) {
          console.error("Failed to fetch calendars:", err)
          toast.error("Could not load your calendars.")
        } finally {
          setIsLoadingCalendars(false)
        }
      }
      fetchCalendars()
    }
  }, [tab, accessToken, selectedCalendarId, selectCalendar])

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

  const handleDisconnect = async () => {
    try {
      await disconnect()
      toast.success("Google Calendar disconnected.")
    } catch (err) {
      toast.error("Failed to disconnect.")
    }
  }

  return (
    <div className="max-w-4xl mx-auto">
      {/* Tabs - Scrollable on mobile, full tabs on desktop */}
      <div className="flex items-center gap-1 border-b border-border mb-6 overflow-x-auto no-scrollbar">
        <TabButton ref={tab === "persons" ? activeTabRef : null} active={tab === "persons"} onClick={() => setTab("persons")} icon={Users}>
          People
        </TabButton>
        <TabButton ref={tab === "contexts" ? activeTabRef : null} active={tab === "contexts"} onClick={() => setTab("contexts")} icon={Tags}>
          Contexts
        </TabButton>
        <TabButton ref={tab === "urgencies" ? activeTabRef : null} active={tab === "urgencies"} onClick={() => setTab("urgencies")} icon={AlertCircle}>
          Urgencies
        </TabButton>
        <TabButton ref={tab === "calendar" ? activeTabRef : null} active={tab === "calendar"} onClick={() => setTab("calendar")} icon={Calendar}>
          Calendar
        </TabButton>
        <TabButton ref={tab === "data" ? activeTabRef : null} active={tab === "data"} onClick={() => setTab("data")} icon={Trash2}>
          Data
        </TabButton>
        <TabButton ref={tab === "notifications" ? activeTabRef : null} active={tab === "notifications"} onClick={() => setTab("notifications")} icon={Bell}>
          Notifications
        </TabButton>
        <TabButton ref={tab === "troubleshoot" ? activeTabRef : null} active={tab === "troubleshoot"} onClick={() => setTab("troubleshoot")} icon={Info}>
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
                        onClick={handleDisconnect}
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
                    <p className="font-semibold text-foreground">Calendar Selection</p>
                    <p>
                      Choose which calendar should receive your tasks. We recommend using your <strong>Primary</strong> calendar or a dedicated "Tasks" calendar.
                    </p>
                    
                    {isConnected && (
                      <div className="mt-4 pt-4 border-t border-primary/10">
                        <label className="block text-[10px] font-mono uppercase tracking-wider mb-2">Target Calendar</label>
                        <select
                          value={selectedCalendarId || 'primary'}
                          onChange={(e) => selectCalendar(e.target.value)}
                          disabled={isLoadingCalendars}
                          className="w-full h-9 rounded border border-primary/20 bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-50"
                        >
                          {isLoadingCalendars ? (
                            <option>Loading calendars...</option>
                          ) : (
                            calendars.map(c => (
                              <option key={c.id} value={c.id}>
                                {c.summary} {c.primary ? "(Primary)" : ""}
                              </option>
                            ))
                          )}
                        </select>
                      </div>
                    )}
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

        {tab === "notifications" && (
          <NotificationsPanel userUid={userUid} />
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

const TabButton = React.forwardRef<
  HTMLButtonElement,
  {
    active: boolean
    onClick: () => void
    icon: React.ComponentType<{ className?: string }>
    children: React.ReactNode
  }
>(function TabButton({ active, onClick, icon: Icon, children }, ref) {
  return (
    <button
      ref={ref}
      type="button"
      onClick={onClick}
      className={cn(
        "relative inline-flex shrink-0 items-center gap-1 md:gap-1.5 px-3 md:px-4 py-2 md:py-2.5 text-xs md:text-sm font-medium transition-colors whitespace-nowrap",
        active ? "text-primary" : "text-muted-foreground hover:text-foreground"
      )}
    >
      <Icon className="h-3.5 w-3.5 md:h-4 md:w-4" />
      {children}
      {active && (
        <span className="absolute inset-x-0 -bottom-px h-0.5 bg-primary rounded-t-full" />
      )}
    </button>
  )
})

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

// ──────────────────────────────────────────────
// Notifications Panel Component
// ──────────────────────────────────────────────

function NotificationsPanel({ userUid }: { userUid?: string }) {
  const [permissionStatus, setPermissionStatus] = useState<NotificationPermission | "unsupported">("default")
  const [isEnabled, setIsEnabled] = useState(false)
  const [isSubscribing, setIsSubscribing] = useState(false)
  const [isTesting, setIsTesting] = useState(false)

  // Check initial state
  useEffect(() => {
    if (typeof window === "undefined" || !("Notification" in window)) {
      setPermissionStatus("unsupported")
      return
    }
    setPermissionStatus(Notification.permission)
    setIsEnabled(localStorage.getItem("notifications_enabled") === "true")
  }, [])

  const handleEnableNotifications = async () => {
    if (!userUid) {
      toast.error("You must be signed in to enable notifications.")
      return
    }

    setIsSubscribing(true)
    try {
      const permission = await Notification.requestPermission()
      setPermissionStatus(permission)

      if (permission !== "granted") {
        toast.error("Notification permission was denied.")
        setIsSubscribing(false)
        return
      }

      // Get the service worker registration and subscribe
      const registration = await navigator.serviceWorker.ready
      const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY

      if (!vapidPublicKey) {
        toast.error("VAPID key not configured.")
        setIsSubscribing(false)
        return
      }

      // Convert VAPID key to Uint8Array
      const urlBase64ToUint8Array = (base64String: string) => {
        const padding = "=".repeat((4 - (base64String.length % 4)) % 4)
        const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/")
        const rawData = window.atob(base64)
        const outputArray = new Uint8Array(rawData.length)
        for (let i = 0; i < rawData.length; ++i) {
          outputArray[i] = rawData.charCodeAt(i)
        }
        return outputArray
      }

      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
      })

      // Save subscription to Firestore
      const subJson = subscription.toJSON()
      const subId = btoa(subJson.endpoint || "").replace(/[^a-zA-Z0-9]/g, "").slice(0, 40)
      await setDoc(doc(firestoreDb, `users/${userUid}/push_subscriptions/${subId}`), {
        ...subJson,
        createdAt: new Date().toISOString(),
        userAgent: navigator.userAgent,
      })

      localStorage.setItem("notifications_enabled", "true")
      setIsEnabled(true)
      toast.success("Notifications enabled successfully!")
    } catch (err: any) {
      console.error("[Notifications] Subscribe error:", err)
      toast.error(err.message || "Failed to enable notifications.")
    } finally {
      setIsSubscribing(false)
    }
  }

  const handleDisableNotifications = async () => {
    if (!userUid) return

    setIsSubscribing(true)
    try {
      // Unsubscribe from push manager
      const registration = await navigator.serviceWorker.ready
      const subscription = await registration.pushManager.getSubscription()
      if (subscription) {
        await subscription.unsubscribe()
      }

      // Remove all subscriptions from Firestore for this user
      const subsRef = collection(firestoreDb, `users/${userUid}/push_subscriptions`)
      const snapshot = await getDocs(subsRef)
      for (const docSnap of snapshot.docs) {
        await deleteDoc(docSnap.ref)
      }

      localStorage.setItem("notifications_enabled", "false")
      setIsEnabled(false)
      toast.success("Notifications disabled.")
    } catch (err: any) {
      console.error("[Notifications] Unsubscribe error:", err)
      toast.error(err.message || "Failed to disable notifications.")
    } finally {
      setIsSubscribing(false)
    }
  }

  const handleTestNotification = async () => {
    if (!userUid) return

    setIsTesting(true)
    try {
      // Get subscriptions from Firestore
      const subsRef = collection(firestoreDb, `users/${userUid}/push_subscriptions`)
      const snapshot = await getDocs(subsRef)
      const subscriptions = snapshot.docs.map((d) => d.data())

      if (subscriptions.length === 0) {
        toast.error("No active subscriptions found.")
        setIsTesting(false)
        return
      }

      const res = await fetch("/api/notifications/push", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subscriptions,
          title: "Test Notification 🔔",
          body: "If you see this, push notifications are working perfectly!",
        }),
      })

      if (res.ok) {
        toast.success("Test notification sent!")
      } else {
        const err = await res.json()
        toast.error(err.error || "Failed to send test notification.")
      }
    } catch (err: any) {
      console.error("[Notifications] Test error:", err)
      toast.error(err.message || "Failed to send test notification.")
    } finally {
      setIsTesting(false)
    }
  }

  const isSupported = permissionStatus !== "unsupported"
  const isGranted = permissionStatus === "granted"
  const isDenied = permissionStatus === "denied"

  return (
    <div className="p-8">
      <h3 className="text-lg font-semibold mb-2 flex items-center gap-2">
        <Bell className="h-5 w-5 text-primary" />
        Notifications
      </h3>
      <p className="text-sm text-muted-foreground mb-6">
        Receive instant push notifications when a linked user adds a task for you.
      </p>

      <div className="space-y-6">
        {/* Status Card */}
        <div className="rounded-lg border border-border bg-muted/30 p-6 flex flex-col items-center text-center">
          <div className={cn(
            "h-12 w-12 rounded-full flex items-center justify-center mb-4",
            !isSupported ? "bg-muted text-muted-foreground" :
            isDenied ? "bg-destructive/10 text-destructive" :
            isEnabled && isGranted ? "bg-green-500/10 text-green-500" :
            "bg-primary/10 text-primary"
          )}>
            {!isSupported ? <BellOff className="h-6 w-6" /> :
             isDenied ? <XCircle className="h-6 w-6" /> :
             isEnabled && isGranted ? <BellRing className="h-6 w-6" /> :
             <Bell className="h-6 w-6" />}
          </div>

          <h4 className="font-medium mb-1">
            {!isSupported ? "Not Supported" :
             isDenied ? "Notifications Blocked" :
             isEnabled && isGranted ? "Notifications Active" :
             "Notifications Disabled"}
          </h4>

          <p className="text-xs text-muted-foreground mb-6 max-w-xs">
            {!isSupported
              ? "Your browser does not support push notifications."
              : isDenied
              ? "You have blocked notifications for this site. To re-enable, click the lock/settings icon in your browser's address bar and allow notifications."
              : isEnabled && isGranted
              ? "You will receive push notifications when a linked user adds a task for you."
              : "Enable push notifications to stay informed about new tasks from linked users."}
          </p>

          <div className="flex gap-3">
            {isSupported && !isDenied && !isEnabled && (
              <button
                type="button"
                onClick={handleEnableNotifications}
                disabled={isSubscribing}
                className="inline-flex items-center gap-2 rounded-md bg-primary px-6 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
              >
                {isSubscribing ? (
                  <><RefreshCw className="h-4 w-4 animate-spin" /> Enabling...</>
                ) : (
                  <><Bell className="h-4 w-4" /> Enable Notifications</>
                )}
              </button>
            )}

            {isEnabled && isGranted && (
              <>
                <button
                  type="button"
                  onClick={handleTestNotification}
                  disabled={isTesting}
                  className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                >
                  {isTesting ? (
                    <><RefreshCw className="h-4 w-4 animate-spin" /> Sending...</>
                  ) : (
                    <><BellRing className="h-4 w-4" /> Send Test Notification</>
                  )}
                </button>
                <button
                  type="button"
                  onClick={handleDisableNotifications}
                  disabled={isSubscribing}
                  className="inline-flex items-center gap-2 rounded-md bg-secondary px-4 py-2 text-sm font-medium hover:bg-secondary/80 text-destructive"
                >
                  <BellOff className="h-4 w-4" />
                  Disable
                </button>
              </>
            )}
          </div>
        </div>

        {/* Denied warning */}
        {isDenied && (
          <div className="p-4 rounded-lg border border-destructive/20 bg-destructive/5">
            <div className="flex gap-3">
              <ShieldAlert className="h-5 w-5 text-destructive shrink-0" />
              <div className="text-xs text-muted-foreground space-y-2">
                <p className="font-semibold text-destructive">Permission Blocked</p>
                <p>
                  Your browser has blocked notifications for this site. To fix this:
                </p>
                <ol className="list-decimal list-inside space-y-1">
                  <li>Click the <strong>lock icon</strong> (or settings icon) in the address bar</li>
                  <li>Find <strong>Notifications</strong> in the permissions list</li>
                  <li>Change it from <strong>Block</strong> to <strong>Allow</strong></li>
                  <li>Reload the page and try again</li>
                </ol>
              </div>
            </div>
          </div>
        )}

        {/* Info card */}
        <div className="p-4 rounded-lg border border-primary/20 bg-primary/5">
          <div className="flex gap-3">
            <Info className="h-5 w-5 text-primary shrink-0" />
            <div className="text-xs text-muted-foreground space-y-2">
              <p className="font-semibold text-foreground">How it works</p>
              <p>
                When a linked user adds a task that is shared with you, you will receive an instant push notification — even if you don&apos;t have the app open. Notifications work on desktop, Android, and iOS (when added to Home Screen).
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
