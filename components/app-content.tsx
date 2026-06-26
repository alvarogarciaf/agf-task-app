"use client"

import { useEffect, useState, Suspense, useRef, useCallback, useMemo } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import { useDatabase, useSyncStatus } from "@/components/db-provider"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import { AppSidebar } from "@/components/app-sidebar"
import { AppHeader } from "@/components/app-header"
import { TasksMobileNav, NotesMobileNav } from "@/components/mobile-nav"
import { MobileSelector } from "@/components/mobile-selectors"
import { WorkspaceViewContent } from "@/components/workspace-view-content"
import { WorkspaceTabBar } from "@/components/workspace-tab-bar"
import { ObjectFullScreenView } from "@/components/object-full-screen-view"
import useEmblaCarousel from "embla-carousel-react"
import { TabPortalProvider } from "@/components/tab-portal-context"
import { TabToolbarProvider, type TabToolbarState } from "@/components/tab-toolbar-context"
import { TabObjectProvider } from "@/components/tab-object-context"
import { useIsMobile } from "@/hooks/use-mobile"
import type { TabKey } from "@/components/views/settings-view"
import type { Context, Person, Project, Task, Tag, UrgencyLevel, ViewKey, SavedView } from "@/lib/types"
import {
  createEmptyTab,
  createTabFromRoute,
  getSidebarActive,
  routeFromSearchParams,
  syncUrlToRoute,
  VIEW_TITLES,
  type TabRoute,
  type TabUiState,
  type WorkspaceTab,
} from "@/lib/workspace-tabs"
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
  const [initialTagId, setInitialTagId] = useState<string | undefined>()
  const [initialProjectId, setInitialProjectId] = useState<string | undefined>()

  // Data state â€” split tasks into two efficient streams
  const [inboxTasks, setInboxTasks] = useState<Task[]>([])
  const [activeTasks, setActiveTasks] = useState<Task[]>([])
  const [notes, setNotes] = useState<Task[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [persons, setPersons] = useState<Person[]>([])
  const [contexts, setContexts] = useState<Context[]>([])
  const [tags, setTags] = useState<Tag[]>([])
  const [urgencies, setUrgencies] = useState<UrgencyLevel[]>([])
  const [savedViews, setSavedViews] = useState<SavedView[]>([])
  const [editingView, setEditingView] = useState<SavedView | null>(null)
  const [activeSettingsTab, setActiveSettingsTab] = useState<TabKey>(() => {
    if (typeof window === "undefined") return "contexts"
    const t = new URLSearchParams(window.location.search).get("tab") as TabKey
    return t || "contexts"
  })
  useEffect(() => {
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

  // Subscriptions â€” targeted queries so IndexedDB does the heavy filtering.
  // A unified object is a note when `type === 'note'`; everything else (including
  // legacy docs with a missing type) is treated as a task.
  useEffect(() => {
    const isNote = (t: Task) => t.type === "note"
    const subs = [
      // Inbox: only unprocessed, non-archived tasks (notes never appear in the inbox)
      db.tasks.find({ selector: { archived: false, processed: false } }).$.subscribe(
        docs => setInboxTasks(docs.map(d => d.toJSON()).filter(t => !isNote(t)))
      ),
      // Non-archived objects split into tasks (Active) and notes
      db.tasks.find({ selector: { archived: false } }).$.subscribe(
        docs => {
          const all = docs.map(d => d.toJSON())
          setActiveTasks(all.filter(t => !isNote(t)))
          setNotes(all.filter(isNote))
        }
      ),
      db.projects.find().$.subscribe(docs => setProjects(docs.map(d => d.toJSON()))),
      db.persons.find().$.subscribe(docs => setPersons(docs.map(d => d.toJSON()))),
      db.contexts.find().$.subscribe(docs => setContexts(docs.map(d => d.toJSON()))),
      db.tags.find().$.subscribe(docs => setTags(docs.map(d => d.toJSON()))),
      db.urgencies.find().$.subscribe(docs => setUrgencies(docs.map(d => d.toJSON()))),
      db.saved_views.find({ sort: [{ order: 'asc' }] }).$.subscribe(docs => setSavedViews(docs.map(d => d.toJSON()))),
    ]
    return () => subs.forEach((s) => s.unsubscribe())
  }, [db])

  // Handlers
  const handleCreateTask = async (input: {
    description: string
    details?: string | null
    contextIds: string[]
    projectId: string | null
    personId: string | null
    urgencyId?: string
    processed?: boolean
    showOn?: string | null
    actionDate?: string | null
    type?: "task" | "note"
    tagIds?: string[]
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

    const isNote = input.type === "note"

    const doc = await db.tasks.insert({
      id: crypto.randomUUID(),
      type: input.type ?? "task",
      description: input.description,
      details: input.details ?? null,
      context_ids: input.contextIds,
      tag_ids: input.tagIds ?? [],
      project_id: input.projectId,
      person_id: finalPersonId,
      // Notes carry no urgency semantics in the UI but the schema still expects a
      // value, so fall back to the default urgency to keep the insert valid.
      urgency_id: input.urgencyId || defaultUrgency,
      // Notes are not part of the inbox/triage flow, so they are created processed.
      processed: isNote ? true : (input.processed ?? false),
      status: "Open",
      date_created: new Date().toISOString(),
      archived: false,
      show_on: input.showOn ?? null,
      action_date: input.actionDate ?? null,
    })
    return doc.id
  }

  const handleCreateNote = async (input: {
    description: string
    contextIds: string[]
    projectId: string | null
    personId: string | null
    processed: boolean
  }) => {
    return handleCreateTask({
      description: input.description,
      contextIds: [],
      projectId: input.projectId,
      personId: input.personId,
      type: "note",
      tagIds: [],
    })
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

  const handleAddTag = async (t: Omit<Tag, "id">) => {
    await db.tags.insert({ id: crypto.randomUUID(), ...t })
  }

  const handleUpdateTag = async (t: Tag) => {
    const doc = await db.tags.findOne(t.id).exec()
    if (doc) await doc.patch(t)
  }

  const handleDeleteTag = async (id: string) => {
    const doc = await db.tags.findOne(id).exec()
    if (doc) await doc.remove()
  }

  const isMobile = useIsMobile()

  const [tabs, setTabs] = useState<WorkspaceTab[]>(() => {
    if (typeof window === "undefined") {
      return [createTabFromRoute({ kind: "view", view: "home" })]
    }
    return [createTabFromRoute(routeFromSearchParams(window.location.search))]
  })
  const [activeTabId, setActiveTabId] = useState(() => tabs[0]?.id ?? "")
  const [tabToolbar, setTabToolbar] = useState<TabToolbarState>({
    canAdd: false,
    addLabel: "",
    onAdd: null,
  })
  const [activePortalContainer, setActivePortalContainer] =
    useState<HTMLElement | null>(null)


  // Mobile specific state
  const [mobileSection, setMobileSection] = useState<"tasks" | "notes">("tasks")
  const [mobileSelectorType, setMobileSelectorType] = useState<"contexts" | "projects" | "tags" | "views" | null>(null)
  const [emblaRef, emblaApi] = useEmblaCarousel({ loop: false, watchDrag: isMobile })

  useEffect(() => {
    if (!emblaApi) return
    const onSelect = () => {
      setMobileSection(emblaApi.selectedScrollSnap() === 0 ? "tasks" : "notes")
    }
    emblaApi.on("select", onSelect)
    return () => { emblaApi.off("select", onSelect) }
  }, [emblaApi])

  // Synchronize state with URL search params (for browser back/forward and initial loads)
  useEffect(() => {
    const view = searchParams.get("view") as ViewKey
    if (view && view !== activeView) {
      setActiveView(view)
      if (isMobile && emblaApi) {
        if (view === "notes" && mobileSection !== "notes") emblaApi.scrollTo(1)
        else if (view !== "notes" && mobileSection !== "tasks") emblaApi.scrollTo(0)
      }
    }
  }, [searchParams])
  const handleActivePortalContainer = useCallback(
    (el: HTMLElement | null) => setActivePortalContainer(el),
    [],
  )

  const activeTab = useMemo(
    () => tabs.find((t) => t.id === activeTabId) ?? tabs[0],
    [tabs, activeTabId],
  )

  const tabsRef = useRef(tabs)
  tabsRef.current = tabs
  const activeTabIdRef = useRef(activeTabId)
  activeTabIdRef.current = activeTabId

  const resetToolbar = useCallback(() => {
    setTabToolbar({ canAdd: false, addLabel: "", onAdd: null })
  }, [])

  const handleNavigate = (view: ViewKey, savedViewId?: string, settingsTab?: TabKey, objectId?: string, uiPatch?: Partial<TabUiState>) => {
    setInitialContextId(uiPatch?.initialContextId ?? undefined)
    setInitialPersonId(uiPatch?.initialPersonId ?? undefined)
    setInitialTagId(uiPatch?.initialTagId ?? undefined)
    setInitialProjectId(uiPatch?.initialProjectId ?? undefined)
    setActiveView(view)
    setActiveSavedViewId(savedViewId || null)
    if (settingsTab) setActiveSettingsTab(settingsTab)
    setMobileSelectorType(null)

    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search)
      params.set("view", view)
      if (savedViewId) params.set("savedViewId", savedViewId)
      else params.delete("savedViewId")
      if (settingsTab) params.set("tab", settingsTab)
      else params.delete("tab")
      if (objectId) params.set("objectId", objectId)
      else params.delete("objectId")

      const newUrl = `${window.location.pathname}?${params.toString()}`
      window.history.pushState(null, "", newUrl)
    }
  }

  const navigateTab = useCallback(
    (
      tabId: string,
      view: ViewKey,
      savedViewId?: string,
      settingsTab?: TabKey,
      clearUi = true,
      objectId?: string,
      uiPatch?: Partial<TabUiState>
    ) => {
      setTabs((prev) =>
        prev.map((t) => {
          if (t.id !== tabId) return t
          return {
            ...t,
            route: {
              kind: "view",
              view,
              savedViewId: savedViewId ?? null,
              settingsTab,
            },
            ui: {
              ...(clearUi ? {} : t.ui),
              ...(objectId ? { objectId, objectEditing: false } : {}),
              ...uiPatch,
            },
          }
        }),
      )
    },
    [],
  )

  const navigateActiveTab = useCallback(
    (view: ViewKey, savedViewId?: string, settingsTab?: TabKey, objectId?: string, uiPatch?: Partial<TabUiState>) => {
      navigateTab(activeTabId, view, savedViewId, settingsTab, true, objectId, uiPatch)
      syncUrlToRoute({
        kind: "view",
        view,
        savedViewId: savedViewId ?? null,
        settingsTab,
      })
    },
    [activeTabId, navigateTab],
  )

  const updateTabUi = useCallback((tabId: string, patch: Partial<TabUiState>) => {
    setTabs((prev) =>
      prev.map((t) =>
        t.id === tabId ? { ...t, ui: { ...t.ui, ...patch } } : t,
      ),
    )
  }, [])

  const addTab = useCallback(() => {
    const tab = createEmptyTab()
    setTabs((prev) => [...prev, tab])
    setActiveTabId(tab.id)
    resetToolbar()
    syncUrlToRoute({ kind: "empty" })
  }, [resetToolbar])

  const closeTab = useCallback(
    (tabId: string) => {
      const prev = tabsRef.current
      const idx = prev.findIndex((t) => t.id === tabId)
      const wasActive = activeTabIdRef.current === tabId

      if (prev.length <= 1) {
        const empty = createEmptyTab()
        setTabs([empty])
        setActiveTabId(empty.id)
        resetToolbar()
        syncUrlToRoute({ kind: "empty" })
        return
      }

      const next = prev.filter((t) => t.id !== tabId)
      setTabs(next)
      if (wasActive) {
        const newActive = next[Math.max(0, idx - 1)]
        setActiveTabId(newActive.id)
        resetToolbar()
        syncUrlToRoute(newActive.route)
      }
    },
    [resetToolbar],
  )

  const selectTab = useCallback(
    (tabId: string) => {
      const tab = tabsRef.current.find((t) => t.id === tabId)
      setActiveTabId(tabId)
      resetToolbar()
      if (tab) syncUrlToRoute(tab.route)
    },
    [resetToolbar],
  )

  const handleDeleteSavedView = async (id: string) => {
    if (confirm("Are you sure you want to delete this saved view?")) {
      const doc = await db.saved_views.findOne(id).exec()
      if (doc) {
        await doc.remove()
        if (
          !isMobile &&
          activeTab.route.kind === "view" &&
          activeTab.route.savedViewId === id
        ) {
          navigateActiveTab("home")
        } else if (isMobile && activeSavedViewId === id) {
          handleNavigate("home")
        }
        setTabs((prev) =>
          prev.map((t) => {
            if (
              t.route.kind === "view" &&
              t.route.view === "saved-view" &&
              t.route.savedViewId === id
            ) {
              return {
                ...t,
                route: { kind: "view", view: "home" as ViewKey },
                ui: {},
              }
            }
            return t
          }),
        )
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

  // Auto-sync calendar to Google Calendar (uses activeTasks â€” already excludes archived)
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

  const handleSyncCalendar = useCallback(
    async (token: string) => {
      const actionTasks = activeTasks.filter(
        (t) => t.action_date && t.status !== "Done",
      )
      let successCount = 0
      let errorCount = 0

      for (const task of actionTasks) {
        await new Promise((resolve) => setTimeout(resolve, 250))

        try {
          const hash = `${task.description}|${task.action_date}`
          if (!task.google_event_id) {
            const eventId = await createGoogleEvent(
              task,
              token,
              selectedCalendarId,
            )
            const doc = await db.tasks.findOne(task.id).exec()
            if (doc) await doc.patch({ google_event_id: eventId })
            syncedHashesRef.current.set(task.id, hash)
            successCount++
          } else {
            try {
              await updateGoogleEvent(task, token, selectedCalendarId)
              syncedHashesRef.current.set(task.id, hash)
              successCount++
            } catch (err: unknown) {
              const message = err instanceof Error ? err.message : String(err)
              if (
                message.includes("Not Found") ||
                message.includes("404")
              ) {
                const eventId = await createGoogleEvent(
                  task,
                  token,
                  selectedCalendarId,
                )
                const doc = await db.tasks.findOne(task.id).exec()
                if (doc) await doc.patch({ google_event_id: eventId })
                syncedHashesRef.current.set(task.id, hash)
                successCount++
              } else {
                throw err
              }
            }
          }
        } catch (err) {
          console.error(`Manual sync failed for task ${task.id}:`, err)
          errorCount++
        }
      }

      if (errorCount > 0) {
        toast.warning(
          `Sync completed with some errors: ${successCount} successfully synced, ${errorCount} failed.`,
        )
      } else {
        toast.success(
          `All ${successCount} tasks successfully pushed and synced!`,
        )
      }
    },
    [activeTasks, selectedCalendarId, db],
  )

  // Keyboard shortcuts
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        (e.target instanceof HTMLElement &&
          (e.target.isContentEditable || e.target.closest("[contenteditable]")))
      ) {
        return
      }

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "t" && !isMobile) {
        e.preventDefault()
        addTab()
        return
      }

      if (e.ctrlKey || e.metaKey || e.altKey) return

      const navigate = isMobile ? handleNavigate : navigateActiveTab
      const key = e.key.toUpperCase()
      if (key === "I") navigate("home")
      if (key === "A") navigate("all")
      if (key === "P") navigate("projects")
      if (key === "C") navigate("contexts")
      if (key === "U") navigate("persons")
      if (key === "S") navigate("settings")
      if (key === "N") navigate("notes")
    }
    window.addEventListener("keydown", handleKey)
    return () => window.removeEventListener("keydown", handleKey)
  }, [isMobile, addTab, navigateActiveTab])

  useEffect(() => {
    const viewParam = searchParams.get("view")
    if (viewParam?.startsWith("slot-") && savedViews.length > 0) {
      const slotIndex = parseInt(viewParam.split("-")[1], 10) - 1
      if (slotIndex >= 0) {
        const sorted = [...savedViews].sort(
          (a, b) =>
            new Date(a.date_created).getTime() -
            new Date(b.date_created).getTime(),
        )
        const targetView = sorted[slotIndex]
        if (targetView) {
          if (!isMobile) navigateActiveTab("saved-view", targetView.id)
          else handleNavigate("saved-view", targetView.id)
        } else {
          if (!isMobile) navigateActiveTab("home")
          else handleNavigate("home")
        }
      }
    }
  }, [searchParams, savedViews.length, isMobile, navigateActiveTab])

  // Counts derived directly from pre-filtered streams â€” no re-filtering needed
  const inboxCount = inboxTasks.length
  const totalCount = activeTasks.length

  const todayStr = new Date().toLocaleDateString("en-CA")
  const todayCount = activeTasks.filter(t => {
    if (t.status === "Done" || !t.action_date) return false
    const taskDateStr = t.action_date.slice(0, 10)
    return taskDateStr === todayStr
  }).length

  const workspaceContentProps = {
    inboxTasks,
    activeTasks,
    notes,
    projects,
    persons,
    contexts,
    tags,
    urgencies,
    savedViews,
    syncStatus,
    userUid: user.uid,
    onSyncCalendar: handleSyncCalendar,
    onCreateTask: handleCreateTask,
    onCreateNote: handleCreateNote,
    onUpdateTask: handleUpdateTask,
    onToggleProcessed: handleToggleProcessed,
    onToggleStatus: handleToggleStatus,
    onArchiveTask: handleArchiveTask,
    onDeleteTask: handleDeleteTask,
    onAddProject: handleAddProject,
    onUpdateProject: handleUpdateProject,
    onDeleteProject: handleDeleteProject,
    onAddTag: handleAddTag,
    onUpdateTag: handleUpdateTag,
    onDeleteTag: handleDeleteTag,
    onDeleteAllTasks: handleDeleteAllTasks,
    onResetDatabase: async () => {
      await db.remove()
      window.location.reload()
    },
    onInsertPerson: async (p: Omit<Person, "id">) => {
      await db.persons.insert({ id: crypto.randomUUID(), ...p })
    },
    onPatchPerson: async (p: Person) => {
      const doc = await db.persons.findOne(p.id).exec()
      if (doc) await doc.patch(p)
    },
    onRemovePerson: async (id: string) => {
      const doc = await db.persons.findOne(id).exec()
      if (doc) await doc.remove()
    },
    onInsertContext: async (c: Omit<Context, "id">) => {
      await db.contexts.insert({ id: crypto.randomUUID(), ...c })
    },
    onPatchContext: async (c: Context) => {
      const doc = await db.contexts.findOne(c.id).exec()
      if (doc) await doc.patch(c)
    },
    onRemoveContext: async (id: string) => {
      const doc = await db.contexts.findOne(id).exec()
      if (doc) await doc.remove()
    },
    onInsertUrgency: async (u: Omit<UrgencyLevel, "id">) => {
      await db.urgencies.insert({ id: crypto.randomUUID(), ...u })
    },
    onPatchUrgency: async (u: UrgencyLevel) => {
      const doc = await db.urgencies.findOne(u.id).exec()
      if (doc) await doc.patch(u)
    },
    onRemoveUrgency: async (id: string) => {
      const doc = await db.urgencies.findOne(id).exec()
      if (doc) await doc.remove()
    },
  }

  const renderMobileTasksContent = () => (
    <WorkspaceViewContent
      {...workspaceContentProps}
      route={{
        kind: "view",
        view: activeView === "notes" ? "home" : activeView,
        savedViewId: activeSavedViewId,
        settingsTab: activeSettingsTab,
      }}
      ui={{
        initialContextId,
        initialPersonId,
        initialTagId: undefined,
        initialProjectId: mobileSection === "tasks" ? initialProjectId : undefined,
      }}
      onNavigate={handleNavigate}
      onUpdateUi={(patch) => {
        if (patch.initialContextId !== undefined) setInitialContextId(patch.initialContextId)
        if (patch.initialPersonId !== undefined) setInitialPersonId(patch.initialPersonId)
        if (patch.initialProjectId !== undefined) setInitialProjectId(patch.initialProjectId)
      }}
    />
  )

  const renderMobileNotesContent = () => (
    <WorkspaceViewContent
      {...workspaceContentProps}
      route={{ kind: "view", view: "notes" }}
      ui={{
        initialTagId,
        initialProjectId: mobileSection === "notes" ? initialProjectId : undefined,
      }}
      onNavigate={handleNavigate}
      onUpdateUi={(patch) => {
        if (patch.initialTagId !== undefined) setInitialTagId(patch.initialTagId)
        if (patch.initialProjectId !== undefined) setInitialProjectId(patch.initialProjectId)
      }}
    />
  )

  const findObjectById = useCallback(
    (id: string): Task | null =>
      activeTasks.find((t) => t.id === id) ??
      notes.find((t) => t.id === id) ??
      inboxTasks.find((t) => t.id === id) ??
      null,
    [activeTasks, notes, inboxTasks],
  )

  const routeLabel = useCallback(
    (route: TabRoute, task?: Task | null): string => {
      if (route.kind !== "view") return "previous"
      if (route.view === "saved-view") {
        return savedViews.find((v) => v.id === route.savedViewId)?.name || "Saved View"
      }
      // When inside a project detail and viewing a note/task, show the project name
      if (
        (route.view === "projects" || route.view === "notes") &&
        task?.project_id
      ) {
        const proj = projects.find((p) => p.id === task.project_id)
        if (proj) return proj.name
      }
      return VIEW_TITLES[route.view]
    },
    [savedViews, projects],
  )

  const sidebarActive = isMobile
    ? { view: activeView, savedViewId: activeSavedViewId }
    : getSidebarActive(activeTab.route)

  const desktopSavedViewId =
    activeTab.route.kind === "view" && activeTab.route.view === "saved-view"
      ? activeTab.route.savedViewId
      : null
  const desktopSavedViewName = desktopSavedViewId
    ? savedViews.find((v) => v.id === desktopSavedViewId)?.name
    : undefined

  const desktopMainPadding = (route: TabRoute) =>
    route.kind === "view" &&
    (route.view === "all" ||
      route.view === "saved-view" ||
      route.view === "notes")
      ? "px-0 md:px-6 pt-0 pb-28 md:py-6"
      : "px-4 md:px-6 pt-6 pb-28 md:py-6"

  return (
    <div className="flex h-screen w-full bg-background overflow-hidden">
      <AppSidebar
        active={sidebarActive.view ?? "home"}
        activeSavedViewId={sidebarActive.savedViewId}
        sidebarSelectionActive={sidebarActive.view !== null}
        onChange={isMobile ? handleNavigate : navigateActiveTab}
        onEditSavedView={setEditingView}
        onDeleteSavedView={handleDeleteSavedView}
        inboxCount={inboxCount}
        todayCount={todayCount}
        totalCount={totalCount}
        syncStatus={syncStatus}
        workspaceLabel={workspaceLabel}
        workspaceInitial={workspaceInitial}
        savedViews={savedViews}
        projects={projects}
        contexts={contexts}
        tags={tags}
        persons={persons}
        onReorderSavedViews={handleReorderSavedViews}
        user={user}
        onSignOut={onSignOut}
        showUserMenu={!isMobile}
      />

      <div className="flex min-w-0 h-full flex-1 flex-col overflow-hidden">
        <AppHeader
          view={
            isMobile
              ? (mobileSection === "tasks" 
                  ? (activeView === "all" && initialContextId ? "contexts" : activeView === "all" && initialProjectId ? "projects" : activeView)
                  : (initialTagId ? "tags" : initialProjectId ? "projects" : "notes")) as ViewKey
              : activeTab.route.kind === "view"
                ? activeTab.route.view
                : "home"
          }
          savedViewName={
            isMobile
              ? savedViews.find((v) => v.id === activeSavedViewId)?.name
              : desktopSavedViewName
          }
          onNavigate={isMobile ? handleNavigate : navigateActiveTab}
          user={user}
          onSignOut={onSignOut}
          syncStatus={syncStatus}
          tasks={activeTasks}
          notes={notes}
          projects={projects}
          persons={persons}
          contexts={contexts}
          tags={tags}
          urgencies={urgencies}
          onUpdateTask={handleUpdateTask}
          desktopTabs={!isMobile}
          tabBar={
            !isMobile ? (
              <WorkspaceTabBar
                tabs={tabs}
                activeTabId={activeTabId}
                savedViews={savedViews}
                onSelect={selectTab}
                onClose={closeTab}
                onAdd={addTab}
                onReorder={(sourceId, targetId) => {
                  setTabs((prev) => {
                    const arr = [...prev]
                    const srcIdx = arr.findIndex((t) => t.id === sourceId)
                    const tgtIdx = arr.findIndex((t) => t.id === targetId)
                    if (srcIdx === -1 || tgtIdx === -1) return prev
                    const [moved] = arr.splice(srcIdx, 1)
                    arr.splice(tgtIdx, 0, moved)
                    return arr
                  })
                }}
                resolveObjectTitle={(id) => findObjectById(id)?.description}
              />
            ) : undefined
          }
          tabToolbar={
            !isMobile && !activeTab.ui.objectId ? tabToolbar : undefined
          }
          tabPortalContainer={!isMobile ? activePortalContainer : null}
          onExpandFullScreen={
            !isMobile
              ? (taskId, objectMode) =>
                  updateTabUi(activeTabId, { objectId: taskId, objectMode })
              : undefined
          }
        />

        <main
          className={cn(
            "flex min-h-0 flex-1 flex-col overflow-hidden",
            isMobile && "relative bg-background",
          )}
        >
          {isMobile ? (
            <div className="flex flex-col h-full w-full">
              <div className="flex shrink-0 h-[38px] border-b border-border px-2">
                <button 
                  onClick={() => emblaApi?.scrollTo(0)}
                  className={cn("flex-1 flex items-center justify-center font-medium text-[13px] transition-colors relative", mobileSection === "tasks" ? "text-foreground" : "text-muted-foreground")}
                >
                  Tasks
                  {mobileSection === "tasks" && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary rounded-t-full" />}
                </button>
                <button 
                  onClick={() => emblaApi?.scrollTo(1)}
                  className={cn("flex-1 flex items-center justify-center font-medium text-[13px] transition-colors relative", mobileSection === "notes" ? "text-foreground" : "text-muted-foreground")}
                >
                  Notes
                  {mobileSection === "notes" && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary rounded-t-full" />}
                </button>
              </div>

              <div className="flex-1 overflow-hidden" ref={emblaRef}>
                <div className="flex h-full">
                  <div className="flex-[0_0_100%] min-w-0 flex flex-col relative h-full transform-gpu">
                    <div className="flex-1 overflow-y-auto px-0 pt-0 pb-28">
                      {renderMobileTasksContent()}
                    </div>
                    <TasksMobileNav
                      active={mobileSelectorType || (activeView === "saved-view" ? "views" : (activeView === "all" && initialContextId) ? "contexts" : (activeView === "all" && initialProjectId) ? "projects" : activeView)}
                      activeSavedViewId={activeSavedViewId}
                      onChange={handleNavigate}
                      onOpenSelector={setMobileSelectorType}
                      inboxCount={inboxCount}
                      todayCount={todayCount}
                    />
                  </div>

                  <div className="flex-[0_0_100%] min-w-0 flex flex-col relative h-full transform-gpu">
                    <div className="flex-1 overflow-y-auto px-0 pt-0 pb-28">
                      {renderMobileNotesContent()}
                    </div>
                    <NotesMobileNav
                      active={mobileSelectorType || (initialTagId ? "tags" : initialProjectId ? "projects" : "notes")}
                      onChange={(k) => { setInitialTagId(undefined); setInitialProjectId(undefined); handleNavigate(k) }}
                      onOpenSelector={setMobileSelectorType}
                    />
                  </div>
                </div>
              </div>
              
              <MobileSelector
                isOpen={mobileSelectorType !== null}
                type={mobileSelectorType}
                onClose={() => setMobileSelectorType(null)}
                contexts={contexts}
                projects={projects}
                tags={tags}
                savedViews={savedViews}
                onSelectContext={(id) => { handleNavigate("all"); setInitialContextId(id) }}
                onSelectProject={(id) => { 
                  if (mobileSection === "tasks") { handleNavigate("all"); setInitialProjectId(id) }
                  else { handleNavigate("notes"); setInitialProjectId(id) }
                }}
                onSelectTag={(id) => { handleNavigate("notes"); setInitialTagId(id) }}
                onSelectView={(id) => { handleNavigate("saved-view", id) }}
              />
            </div>
          ) : (
            tabs.map((tab) => {
              const isActive = tab.id === activeTabId
              return (
                <TabPortalProvider
                  key={tab.id}
                  hidden={!isActive}
                  isActive={isActive}
                  onContainer={handleActivePortalContainer}
                >
                  <TabToolbarProvider
                    isActive={isActive}
                    onChange={setTabToolbar}
                  >
                    <TabObjectProvider
                      value={{
                        openObjectFullScreen: (taskId, objectMode) =>
                          updateTabUi(tab.id, { objectId: taskId, objectMode }),
                        openObjectInNewTab: (taskId, objectMode) => {
                          const newTab = createTabFromRoute(tab.route)
                          newTab.ui = { objectId: taskId, objectMode }
                          setTabs((prev) => [...prev, newTab])
                          setActiveTabId(newTab.id)
                        },
                      }}
                    >
                      {tab.ui.objectId && (
                        <ObjectFullScreenView
                          task={findObjectById(tab.ui.objectId)}
                          previousLabel={routeLabel(tab.route, findObjectById(tab.ui.objectId))}
                          onBack={() =>
                            updateTabUi(tab.id, {
                              objectId: undefined,
                              objectMode: undefined,
                            })
                          }
                          projects={projects}
                          persons={persons}
                          contexts={contexts}
                          tags={tags}
                          urgencies={urgencies}
                          onUpdate={handleUpdateTask}
                          onDeleteTask={handleDeleteTask}
                        />
                      )}
                      <div
                        className={cn(
                          "flex min-h-0 flex-1 flex-col overflow-y-auto",
                          desktopMainPadding(tab.route),
                          tab.ui.objectId && "hidden",
                        )}
                      >
                        <div className="min-h-full w-full">
                          <WorkspaceViewContent
                            {...workspaceContentProps}
                            hideDesktopAdd
                            route={tab.route}
                            ui={tab.ui}
                            onNavigate={(view, savedViewId, settingsTab) => {
                              navigateTab(
                                tab.id,
                                view,
                                savedViewId,
                                settingsTab,
                                false,
                              )
                              if (isActive) {
                                syncUrlToRoute({
                                  kind: "view",
                                  view,
                                  savedViewId: savedViewId ?? null,
                                  settingsTab,
                                })
                              }
                            }}
                            onUpdateUi={(patch) => updateTabUi(tab.id, patch)}
                          />
                        </div>
                      </div>
                    </TabObjectProvider>
                  </TabToolbarProvider>
                </TabPortalProvider>
              )
            })
          )}
        </main>
      </div>

      <SaveViewDialog
        open={!!editingView}
        onOpenChange={(open) => !open && setEditingView(null)}
        onSave={handleUpdateSavedView}
        editingView={editingView}
      />
    </div>
  )
}
