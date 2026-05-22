"use client"

import { useEffect, useState, Suspense, useRef } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import { useDatabase, useSyncStatus } from "@/components/db-provider"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import { AppSidebar } from "@/components/app-sidebar"
import { AppHeader } from "@/components/app-header"
import { MobileNav } from "@/components/mobile-nav"
import { HomeView } from "@/components/views/home-view"
import { InboxView } from "@/components/views/inbox-view"
import { AllTasksView } from "@/components/views/all-tasks-view"
import { ProjectsView } from "@/components/views/projects-view"
import { ContextsView } from "@/components/views/contexts-view"
import { SettingsView, type TabKey } from "@/components/views/settings-view"
import { PersonsView } from "@/components/views/persons-view"
import type { Context, Person, Project, Task, UrgencyLevel, ViewKey, SavedView } from "@/lib/types"
import { syncCalendarToStorage } from "@/lib/calendar-sync-client"
import { createGoogleEvent, updateGoogleEvent, deleteGoogleEvent } from "@/lib/google-calendar"
import { useGoogleCalendar } from "@/components/google-calendar-provider"
import { SaveViewDialog } from "./save-view-dialog"

// Minimal user shape that works with both Firebase User and cached user
interface AppUser {
  uid: string
  displayName: string | null
  email: string | null
}

interface AppContentProps {
  user: AppUser
  onSignOut: () => void
}

export function AppContent({ user, onSignOut }: AppContentProps) {
  const db = useDatabase()
  const syncStatus = useSyncStatus()
  const searchParams = useSearchParams()
  const router = useRouter()

  const [activeView, setActiveView] = useState<ViewKey>(() => {
    if (typeof window === "undefined") return "home"
    const v = new URLSearchParams(window.location.search).get("view") as ViewKey
    return v || "home"
  })

  const [activeSavedViewId, setActiveSavedViewId] = useState<string | null>(() => {
    if (typeof window === "undefined") return null
    return new URLSearchParams(window.location.search).get("savedViewId")
  })

  const workspaceLabel =
    user.displayName?.trim() ||
    user.email?.split("@")[0]?.trim() ||
    "Your workspace"
  const workspaceInitial = (workspaceLabel[0] ?? "?").toUpperCase()

  // Initial filter states for drill-down
  const [initialContextId, setInitialContextId] = useState<string | undefined>()
  const [initialPersonId, setInitialPersonId] = useState<string | undefined>()

  // Data state — split tasks into two efficient streams
  const [inboxTasks, setInboxTasks] = useState<Task[]>([])
  const [activeTasks, setActiveTasks] = useState<Task[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [persons, setPersons] = useState<Person[]>([])
  const [contexts, setContexts] = useState<Context[]>([])
  const [urgencies, setUrgencies] = useState<UrgencyLevel[]>([])
  const [savedViews, setSavedViews] = useState<SavedView[]>([])
  const [editingView, setEditingView] = useState<SavedView | null>(null)
  const [activeSettingsTab, setActiveSettingsTab] = useState<TabKey>(() => {
    if (typeof window === "undefined") return "persons"
    const t = new URLSearchParams(window.location.search).get("tab") as TabKey
    return t || "persons"
  })

  // Synchronize state with URL search params (for browser back/forward and initial loads)
  useEffect(() => {
    const view = searchParams.get("view") as ViewKey
    if (view && view !== activeView) {
      setActiveView(view)
    }

    const savedViewId = searchParams.get("savedViewId")
    if (savedViewId !== activeSavedViewId) {
      setActiveSavedViewId(savedViewId || null)
    }

    const tab = searchParams.get("tab") as TabKey
    if (tab && tab !== activeSettingsTab) {
      setActiveSettingsTab(tab)
    }
  }, [searchParams, activeView, activeSavedViewId, activeSettingsTab])

  // Listen to popstate for browser back/forward navigation
  useEffect(() => {
    const handlePopState = () => {
      const params = new URLSearchParams(window.location.search)
      const view = params.get("view") as ViewKey
      if (view) {
        setActiveView(view)
      }
      setActiveSavedViewId(params.get("savedViewId") || null)
      const tab = params.get("tab") as TabKey
      if (tab) {
        setActiveSettingsTab(tab)
      }
    }
    window.addEventListener("popstate", handlePopState)
    return () => window.removeEventListener("popstate", handlePopState)
  }, [])

  // Subscriptions — targeted queries so IndexedDB does the heavy filtering
  useEffect(() => {
    const subs = [
      // Inbox: only unprocessed, non-archived tasks
      db.tasks.find({ selector: { archived: false, processed: false } }).$.subscribe(
        docs => setInboxTasks(docs.map(d => d.toJSON()))
      ),
      // Active: all non-archived tasks (for All Tasks, Projects, Contexts, etc.)
      db.tasks.find({ selector: { archived: false } }).$.subscribe(
        docs => setActiveTasks(docs.map(d => d.toJSON()))
      ),
      db.projects.find().$.subscribe(docs => setProjects(docs.map(d => d.toJSON()))),
      db.persons.find().$.subscribe(docs => setPersons(docs.map(d => d.toJSON()))),
      db.contexts.find().$.subscribe(docs => setContexts(docs.map(d => d.toJSON()))),
      db.urgencies.find().$.subscribe(docs => setUrgencies(docs.map(d => d.toJSON()))),
      db.saved_views.find({ sort: [{ order: 'asc' }] }).$.subscribe(docs => setSavedViews(docs.map(d => d.toJSON()))),
    ]
    return () => subs.forEach((s) => s.unsubscribe())
  }, [db])

  // Handle slot resolution (View 1, View 2, View 3 from PWA manifest)
  useEffect(() => {
    const viewParam = searchParams.get("view")
    if (viewParam?.startsWith("slot-") && savedViews.length > 0) {
      const slotIndex = parseInt(viewParam.split("-")[1], 10) - 1
      if (slotIndex >= 0) {
        // Resolve by creation order as requested
        const sorted = [...savedViews].sort((a, b) => 
          new Date(a.date_created).getTime() - new Date(b.date_created).getTime()
        )
        const targetView = sorted[slotIndex]
        if (targetView) {
          handleNavigate("saved-view", targetView.id)
        } else {
          // If slot empty, go home
          handleNavigate("home")
        }
      }
    }
  }, [searchParams, savedViews.length]) // Trigger when search params or savedViews count change

  // Handlers
  const handleCreateTask = async (input: {
    description: string
    details?: string | null
    contextIds: string[]
    projectId: string | null
    personId: string | null
    urgencyId?: string
    processed?: boolean
  }) => {
    const byOrder = [...urgencies].sort((a, b) => a.order - b.order)
    const defaultUrgency = byOrder[0]?.id ?? "u_low"
    
    // Resolve project shared status
    let finalPersonId = input.personId
    if (input.projectId) {
      const proj = projects.find(p => p.id === input.projectId)
      if (proj && proj.linked_person_id) {
        finalPersonId = proj.linked_person_id
      }
    }

    const doc = await db.tasks.insert({
      id: crypto.randomUUID(),
      description: input.description,
      details: input.details ?? null,
      context_ids: input.contextIds,
      project_id: input.projectId,
      person_id: finalPersonId,
      urgency_id: input.urgencyId || defaultUrgency,
      processed: input.processed ?? false,
      status: "Open",
      date_created: new Date().toISOString(),
      archived: false,
    })
    return doc.id
  }

  const handleUpdateTask = async (task: Task) => {
    const doc = await db.tasks.findOne(task.id).exec()
    if (doc) {
      // Resolve project_id using incoming or current database value
      const projectId = task.project_id !== undefined ? task.project_id : doc.get("project_id")
      
      // Resolve person_id using incoming or current database value
      let personId = task.person_id !== undefined ? task.person_id : doc.get("person_id")
      
      // Enforce shared project partner override
      if (projectId) {
        const proj = projects.find(p => p.id === projectId)
        if (proj && proj.linked_person_id) {
          personId = proj.linked_person_id
        }
      }

      // Construct clean patch object filtering out undefined fields
      const patchObj: Partial<Task> = {}
      for (const key of Object.keys(task) as Array<keyof Task>) {
        if (task[key] !== undefined) {
          (patchObj as any)[key] = task[key]
        }
      }
      
      // Set the resolved person_id
      patchObj.person_id = personId

      await doc.patch(patchObj)
    }
  }

  const handleToggleProcessed = async (id: string) => {
    const doc = await db.tasks.findOne(id).exec()
    if (doc) {
      await doc.patch({ processed: !doc.get("processed") })
    }
  }

  const handleToggleStatus = async (id: string) => {
    const doc = await db.tasks.findOne(id).exec()
    if (doc) {
      const current = doc.get("status")
      await doc.patch({ status: current === "Open" ? "Done" : "Open" })
    }
  }

  const handleArchiveTask = async (id: string) => {
    const doc = await db.tasks.findOne(id).exec()
    if (doc) {
      await doc.patch({ archived: true })
    }
  }

  const handleDeleteTask = async (id: string) => {
    const doc = await db.tasks.findOne(id).exec()
    if (doc) {
      await doc.remove()
    }
  }

  const handleDeleteAllTasks = async () => {
    const all = await db.tasks.find().exec()
    await Promise.all(all.map((doc) => doc.remove()))
  }

  const handleAddProject = async (p: Omit<Project, "id">) => {
    await db.projects.insert({ id: crypto.randomUUID(), ...p })
  }

  const handleUpdateProject = async (p: Project) => {
    const doc = await db.projects.findOne(p.id).exec()
    if (doc) {
      const prevLinkedPersonId = doc.get("linked_person_id")
      await doc.patch(p)
      
      // Enforce: if project linked to a person, batch update all tasks in this project
      if (p.linked_person_id && p.linked_person_id !== prevLinkedPersonId) {
        const tasksToUpdate = await db.tasks.find({ selector: { project_id: p.id } }).exec()
        await Promise.all(tasksToUpdate.map(tDoc => tDoc.patch({ person_id: p.linked_person_id })))
        toast.success(`Synced all tasks in "${p.name}" with shared partner.`)
      }
    }
  }

  const handleDeleteProject = async (id: string) => {
    const doc = await db.projects.findOne(id).exec()
    if (doc) await doc.remove()
  }

  const handleNavigate = (view: ViewKey, savedViewId?: string, settingsTab?: TabKey) => {
    // Clear drill-down filters when navigating via sidebar/header
    setInitialContextId(undefined)
    setInitialPersonId(undefined)
    setActiveView(view)
    setActiveSavedViewId(savedViewId || null)
    if (settingsTab) setActiveSettingsTab(settingsTab)

    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search)
      params.set("view", view)
      if (savedViewId) params.set("savedViewId", savedViewId)
      else params.delete("savedViewId")
      if (settingsTab) params.set("tab", settingsTab)
      else params.delete("tab")
      
      const newUrl = `${window.location.pathname}?${params.toString()}`
      window.history.pushState(null, "", newUrl)
    }
  }

  const handleDeleteSavedView = async (id: string) => {
    if (confirm("Are you sure you want to delete this saved view?")) {
      const doc = await db.saved_views.findOne(id).exec()
      if (doc) {
        await doc.remove()
        if (activeSavedViewId === id) {
          handleNavigate("home")
        }
      }
    }
  }

  const handleUpdateSavedView = async (data: { name: string; icon: string; color: string }) => {
    if (!editingView) return
    const doc = await db.saved_views.findOne(editingView.id).exec()
    if (doc) {
      await doc.patch(data)
    }
    setEditingView(null)
  }
  
  const handleReorderSavedViews = async (reordered: SavedView[]) => {
    // Update all views with their new order
    await Promise.all(reordered.map(async (v, index) => {
      const doc = await db.saved_views.findOne(v.id).exec()
      if (doc && doc.order !== index) {
        await doc.patch({ order: index })
      }
    }))
  }

  const { accessToken: contextToken, selectedCalendarId, selectCalendar, refreshToken } = useGoogleCalendar()

  const [syncTrigger, setSyncTrigger] = useState(0)
  const syncedHashesRef = useRef(new Map<string, string>())

  useEffect(() => {
    const handleOnline = () => setSyncTrigger(t => t + 1)
    window.addEventListener('online', handleOnline)
    return () => window.removeEventListener('online', handleOnline)
  }, [])

  // Auto-sync calendar to Google Calendar (uses activeTasks — already excludes archived)
  useEffect(() => {
    if (!user.uid || activeTasks.length === 0 || !contextToken) return
    
    const timeoutId = setTimeout(async () => {
      let token = contextToken;

      /** Helper: call a Google Calendar API fn, retry once with a refreshed token on 401. */
      const withRetry = async <T,>(fn: (t: string) => Promise<T>): Promise<T> => {
        try {
          return await fn(token);
        } catch (err: any) {
          if (err.message?.includes("401") || err.message?.includes("Unauthorized") || err.message?.includes("Invalid Credentials")) {
            const refreshed = await refreshToken();
            if (refreshed) {
              token = refreshed;
              return await fn(token);
            }
          }
          throw err;
        }
      };

      // Sync only tasks with action dates that are open
      const actionTasks = activeTasks.filter(t => t.action_date && t.status !== "Done");
      
      for (const task of actionTasks) {
        try {
          const hash = `${task.description}|${task.action_date}`;
          if (!task.google_event_id) {
            // Add a small sleep to avoid rate limits
            await new Promise((resolve) => setTimeout(resolve, 250));
            
            const eventId = await withRetry((t) => createGoogleEvent(task, t, selectedCalendarId));
            const doc = await db.tasks.findOne(task.id).exec();
            if (doc) await doc.patch({ google_event_id: eventId });
            syncedHashesRef.current.set(task.id, hash);
            console.log(`Calendar: Created "${task.description}"`);
          } else {
            // Smart sync: only update if the fields actually changed
            if (!syncedHashesRef.current.has(task.id)) {
              // First time seeing this task in this session.
              // It already has a google_event_id, so it was previously successfully synced.
              // Just cache the current hash to prevent a useless update storm on page load.
              syncedHashesRef.current.set(task.id, hash);
            } else if (syncedHashesRef.current.get(task.id) !== hash) {
              // Add a small sleep to avoid rate limits
              await new Promise((resolve) => setTimeout(resolve, 250));
              
              try {
                await withRetry((t) => updateGoogleEvent(task, t, selectedCalendarId));
                syncedHashesRef.current.set(task.id, hash);
                console.log(`Updated calendar event for: ${task.description}`);
              } catch (err: any) {
                // If the event was not found on Google Calendar, recreate it!
                if (err.message?.includes("Not Found") || err.message?.includes("404")) {
                  console.warn(`Event ${task.google_event_id} not found during auto-sync. Recreating...`);
                  const eventId = await withRetry((t) => createGoogleEvent(task, t, selectedCalendarId));
                  const doc = await db.tasks.findOne(task.id).exec();
                  if (doc) await doc.patch({ google_event_id: eventId });
                  syncedHashesRef.current.set(task.id, hash);
                  console.log(`Calendar: Recreated "${task.description}"`);
                } else {
                  throw err;
                }
              }
            }
          }
        } catch (err: any) {
          console.error(`Auto-sync failed for task ${task.id}:`, err);
          if (!err.message?.includes("Failed to fetch")) { // Ignore offline errors for toasts
            toast.error(`Calendar Error: ${err.message || "Unknown error"}`);
          }
        }
      }

      // Cleanup: tasks with google_event_id but NO action_date or are Done
      const staleTasks = activeTasks.filter(t => t.google_event_id && (!t.action_date || t.status === "Done"));
      for (const task of staleTasks) {
        try {
          // Add a small sleep to avoid rate limits
          await new Promise((resolve) => setTimeout(resolve, 250));
          
          await withRetry((t) => deleteGoogleEvent(task.google_event_id!, t, selectedCalendarId));
          const doc = await db.tasks.findOne(task.id).exec();
          if (doc) await doc.patch({ google_event_id: null });
          syncedHashesRef.current.delete(task.id);
        } catch (err) {
          console.error(`Auto-cleanup failed for task ${task.id}:`, err);
        }
      }
    }, 3000) // 3 second debounce

    return () => clearTimeout(timeoutId)
  }, [activeTasks, user.uid, db, contextToken, selectedCalendarId, refreshToken, syncTrigger])

  // Keyboard shortcuts
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        (e.target instanceof HTMLElement && (e.target.isContentEditable || e.target.closest("[contenteditable]")))
      ) {
        return
      }
      // Ignore shortcuts if a modifier key is pressed (e.g. Ctrl+C should not navigate to Contexts)
      if (e.ctrlKey || e.metaKey || e.altKey) return
      
      const key = e.key.toUpperCase()
      if (key === "I") handleNavigate("home")
      if (key === "A") handleNavigate("all")
      if (key === "P") handleNavigate("projects")
      if (key === "C") handleNavigate("contexts")
      if (key === "U") handleNavigate("persons")
      if (key === "S") handleNavigate("settings")
    }
    window.addEventListener("keydown", handleKey)
    return () => window.removeEventListener("keydown", handleKey)
  }, [])

  // Counts derived directly from pre-filtered streams — no re-filtering needed
  const inboxCount = inboxTasks.length
  const totalCount = activeTasks.length

  // Shared props for views that use activeTasks (All Tasks, Saved Views, Projects)
  const activeViewProps = {
    tasks: activeTasks,
    projects,
    persons,
    contexts,
    urgencies,
    onUpdate: handleUpdateTask,
    onToggleProcessed: handleToggleProcessed,
    onToggleStatus: handleToggleStatus,
    onArchiveTask: handleArchiveTask,
    onDeleteTask: handleDeleteTask,
    onCreate: handleCreateTask,
    onAddPerson: async (p: Omit<Person, "id">) => {
      await db.persons.insert({ id: crypto.randomUUID(), ...p })
    }
  }

  const renderView = () => {
    switch (activeView) {
      case "home":
        return <HomeView {...activeViewProps} tasks={inboxTasks} />
      case "inbox":
        return (
          <InboxView 
            {...activeViewProps} 
            tasks={inboxTasks} 
            onAddPerson={async (p) => {
              await db.persons.insert({ id: crypto.randomUUID(), ...p })
            }}
          />
        )
      case "saved-view": {
        const sv = savedViews.find(v => v.id === activeSavedViewId)
        if (!sv) return <HomeView {...activeViewProps} tasks={inboxTasks} />
        return (
          <AllTasksView
            {...activeViewProps}
            initialContextIds={sv.context_ids}
            initialPersonId={sv.person_id}
            initialProjectId={sv.project_id}
            initialShowStatus={sv.show_status}
            initialIsGroupedByProject={sv.is_grouped_by_project}
            initialShowHiddenByShowOn={sv.show_hidden_by_show_on}
            initialSortKey={sv.sort_key}
            initialSortDirection={sv.sort_direction}
            fullWidthOnMobile={true}
          />
        )
      }
      case "all":
        return (
          <AllTasksView 
            {...activeViewProps} 
            initialContextId={initialContextId}
            initialPersonId={initialPersonId}
            fullWidthOnMobile={true}
          />
        )
      case "projects":
        return (
          <ProjectsView 
            {...activeViewProps} 
            onAddProject={handleAddProject}
            onUpdateProject={handleUpdateProject}
            onDeleteProject={handleDeleteProject}
          />
        )
      case "contexts":
        return (
          <ContextsView 
            tasks={activeTasks}
            contexts={contexts}
            onSelect={(id) => {
              setInitialContextId(id)
              setInitialPersonId(undefined)
              setActiveView("all")
              if (typeof window !== "undefined") {
                const params = new URLSearchParams(window.location.search)
                params.set("view", "all")
                params.delete("savedViewId")
                params.delete("tab")
                const newUrl = `${window.location.pathname}?${params.toString()}`
                window.history.pushState(null, "", newUrl)
              }
            }}
            onUpdateContext={async (c) => {
              const doc = await db.contexts.findOne(c.id).exec()
              if (doc) await doc.patch(c)
            }}
            onDeleteContext={async (id) => {
              const doc = await db.contexts.findOne(id).exec()
              if (doc) await doc.remove()
            }}
            onAddContext={async (c) => {
              await db.contexts.insert({ id: crypto.randomUUID(), ...c })
            }}
          />
        )
      case "persons":
        return (
          <PersonsView 
            tasks={activeTasks}
            persons={persons}

            onSelect={(id) => {
              setInitialPersonId(id)
              setInitialContextId(undefined)
              setActiveView("all")
              if (typeof window !== "undefined") {
                const params = new URLSearchParams(window.location.search)
                params.set("view", "all")
                params.delete("savedViewId")
                params.delete("tab")
                const newUrl = `${window.location.pathname}?${params.toString()}`
                window.history.pushState(null, "", newUrl)
              }
            }}
            onUpdatePerson={async (p) => {
              const doc = await db.persons.findOne(p.id).exec()
              if (doc) await doc.patch(p)
            }}
            onDeletePerson={async (id) => {
              const doc = await db.persons.findOne(id).exec()
              if (doc) await doc.remove()
            }}
            onAddPerson={async (p) => {
              await db.persons.insert({ id: crypto.randomUUID(), ...p })
            }}
          />
        )
      case "settings":
        return (
          <SettingsView 
            activeTab={activeSettingsTab}
            onTabChange={(tab) => handleNavigate("settings", undefined, tab)}
            persons={persons}
            contexts={contexts}
            urgencies={urgencies}
            onAddPerson={async (p) => {
              await db.persons.insert({ id: crypto.randomUUID(), ...p })
            }}
            onUpdatePerson={async (p) => {
              const doc = await db.persons.findOne(p.id).exec()
              if (doc) await doc.patch(p)
            }}
            onDeletePerson={async (id) => {
              const doc = await db.persons.findOne(id).exec()
              if (doc) await doc.remove()
            }}
            onAddContext={async (c) => {
              await db.contexts.insert({ id: crypto.randomUUID(), ...c })
            }}
            onUpdateContext={async (c) => {
              const doc = await db.contexts.findOne(c.id).exec()
              if (doc) await doc.patch(c)
            }}
            onDeleteContext={async (id) => {
              const doc = await db.contexts.findOne(id).exec()
              if (doc) await doc.remove()
            }}
            onAddUrgency={async (u) => {
              await db.urgencies.insert({ id: crypto.randomUUID(), ...u })
            }}
            onUpdateUrgency={async (u) => {
              const doc = await db.urgencies.findOne(u.id).exec()
              if (doc) await doc.patch(u)
            }}
            onDeleteUrgency={async (id) => {
              const doc = await db.urgencies.findOne(id).exec()
              if (doc) await doc.remove()
            }}
            onDeleteAllTasks={handleDeleteAllTasks}
            onResetDatabase={async () => {
              await db.remove()
              window.location.reload()
            }}
            syncStatus={syncStatus}
            userUid={user.uid}
            onSyncCalendar={async (token) => {
              const actionTasks = activeTasks.filter(t => t.action_date && t.status !== "Done");
              let successCount = 0;
              let errorCount = 0;
              
              for (const task of actionTasks) {
                // Add a small sleep to avoid rate limits
                await new Promise((resolve) => setTimeout(resolve, 250));
                
                try {
                  const hash = `${task.description}|${task.action_date}`;
                  if (!task.google_event_id) {
                    const eventId = await createGoogleEvent(task, token, selectedCalendarId);
                    const doc = await db.tasks.findOne(task.id).exec();
                    if (doc) await doc.patch({ google_event_id: eventId });
                    syncedHashesRef.current.set(task.id, hash);
                    successCount++;
                  } else {
                    try {
                      await updateGoogleEvent(task, token, selectedCalendarId);
                      syncedHashesRef.current.set(task.id, hash);
                      successCount++;
                    } catch (err: any) {
                      if (err.message?.includes("Not Found") || err.message?.includes("404")) {
                        console.warn(`Event ${task.google_event_id} not found during manual sync. Recreating...`);
                        const eventId = await createGoogleEvent(task, token, selectedCalendarId);
                        const doc = await db.tasks.findOne(task.id).exec();
                        if (doc) await doc.patch({ google_event_id: eventId });
                        syncedHashesRef.current.set(task.id, hash);
                        successCount++;
                      } else {
                        throw err;
                      }
                    }
                  }
                } catch (err: any) {
                  console.error(`Manual sync failed for task ${task.id}:`, err);
                  errorCount++;
                }
              }
              
              if (errorCount > 0) {
                toast.warning(`Sync completed with some errors: ${successCount} successfully synced, ${errorCount} failed.`);
              } else {
                toast.success(`All ${successCount} tasks successfully pushed and synced!`);
              }
            }}
          />
        )
      default:
        return <HomeView {...activeViewProps} tasks={inboxTasks} />
    }
  }

  return (
    <div className="flex h-screen w-full bg-background overflow-hidden">
      <AppSidebar 
        active={activeView} 
        activeSavedViewId={activeSavedViewId}
        onChange={handleNavigate} 
        onEditSavedView={setEditingView}
        onDeleteSavedView={handleDeleteSavedView}
        inboxCount={inboxCount}
        totalCount={totalCount}
        syncStatus={syncStatus}
        workspaceLabel={workspaceLabel}
        workspaceInitial={workspaceInitial}
        savedViews={savedViews}
        onReorderSavedViews={handleReorderSavedViews}
      />
      
      <div className="flex flex-1 flex-col min-w-0 h-full overflow-hidden">
        <AppHeader 
          view={activeView} 
          savedViewName={savedViews.find(v => v.id === activeSavedViewId)?.name}
          onNavigate={handleNavigate} 
          user={user} 
          onSignOut={onSignOut} 
          syncStatus={syncStatus}
        />
        
        <main className={cn(
          "flex-1 overflow-y-auto",
          (activeView === "all" || activeView === "saved-view") 
            ? "px-0 md:px-6 pt-0 pb-28 md:py-6" 
            : "px-4 md:px-6 pt-6 pb-28 md:py-6"
        )}>
          <div className="w-full min-h-full">
            {renderView()}
          </div>
        </main>
      </div>

      <MobileNav 
        active={activeView} 
        activeSavedViewId={activeSavedViewId}
        onChange={handleNavigate} 
        inboxCount={inboxCount} 
        savedViews={savedViews}
      />

      <SaveViewDialog
        open={!!editingView}
        onOpenChange={(open) => !open && setEditingView(null)}
        onSave={handleUpdateSavedView}
        editingView={editingView}
      />
    </div>
  )
}