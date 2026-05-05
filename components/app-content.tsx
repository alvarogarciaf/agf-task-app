"use client"

import { useEffect, useState } from "react"
import { useDatabase, useSyncStatus } from "@/components/db-provider"
import { AppSidebar } from "@/components/app-sidebar"
import { AppHeader } from "@/components/app-header"
import { MobileNav } from "@/components/mobile-nav"
import { HomeView } from "@/components/views/home-view"
import { InboxView } from "@/components/views/inbox-view"
import { AllTasksView } from "@/components/views/all-tasks-view"
import { ProjectsView } from "@/components/views/projects-view"
import { ContextsView } from "@/components/views/contexts-view"
import { SettingsView } from "@/components/views/settings-view"
import { PersonsView } from "@/components/views/persons-view"
import type { Context, Person, Project, Task, UrgencyLevel, ViewKey } from "@/lib/types"
import type { User } from "firebase/auth"

interface AppContentProps {
  user: User
  onSignOut: () => void
}

export function AppContent({ user, onSignOut }: AppContentProps) {
  const db = useDatabase()
  const syncStatus = useSyncStatus()
  const [activeView, setActiveView] = useState<ViewKey>("home")

  const workspaceLabel =
    user.displayName?.trim() ||
    user.email?.split("@")[0]?.trim() ||
    "Your workspace"
  const workspaceInitial = (workspaceLabel[0] ?? "?").toUpperCase()

  // Initial filter states for drill-down
  const [initialContextId, setInitialContextId] = useState<string | undefined>()
  const [initialPersonId, setInitialPersonId] = useState<string | undefined>()

  // Data state
  const [tasks, setTasks] = useState<Task[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [persons, setPersons] = useState<Person[]>([])
  const [contexts, setContexts] = useState<Context[]>([])
  const [urgencies, setUrgencies] = useState<UrgencyLevel[]>([])

  // Subscriptions
  useEffect(() => {
    const subs = [
      db.tasks.find().$.subscribe(docs => setTasks(docs.map(d => d.toJSON()))),
      db.projects.find().$.subscribe(docs => setProjects(docs.map(d => d.toJSON()))),
      db.persons.find().$.subscribe(docs => setPersons(docs.map(d => d.toJSON()))),
      db.contexts.find().$.subscribe(docs => setContexts(docs.map(d => d.toJSON()))),
      db.urgencies.find().$.subscribe(docs => setUrgencies(docs.map(d => d.toJSON()))),
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
  }) => {
    const byOrder = [...urgencies].sort((a, b) => a.order - b.order)
    const defaultUrgency = byOrder[0]?.id ?? "u_low"
    
    await db.tasks.insert({
      id: crypto.randomUUID(),
      description: input.description,
      details: input.details ?? null,
      context_ids: input.contextIds,
      project_id: input.projectId,
      person_id: input.personId,
      urgency_id: input.urgencyId || defaultUrgency,
      processed: input.processed ?? false,
      status: "Open",
      date_created: new Date().toISOString(),
      archived: false,
    })
  }

  const handleUpdateTask = async (task: Task) => {
    const doc = await db.tasks.findOne(task.id).exec()
    if (doc) {
      await doc.patch(task)
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
    if (doc) await doc.patch(p)
  }

  const handleDeleteProject = async (id: string) => {
    const doc = await db.projects.findOne(id).exec()
    if (doc) await doc.remove()
  }

  const handleNavigate = (view: ViewKey) => {
    // Clear drill-down filters when navigating via sidebar/header
    setInitialContextId(undefined)
    setInitialPersonId(undefined)
    setActiveView(view)
  }

  // Keyboard shortcuts
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
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

  const inboxCount = tasks.filter((t) => !t.processed && !t.archived).length
  const totalCount = tasks.filter((t) => !t.archived).length

  const viewProps = {
    tasks,
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
  }

  const renderView = () => {
    switch (activeView) {
      case "home":
        return <HomeView {...viewProps} />
      case "inbox":
        return <InboxView {...viewProps} />
      case "all":
        return (
          <AllTasksView 
            {...viewProps} 
            initialContextId={initialContextId}
            initialPersonId={initialPersonId}
          />
        )
      case "projects":
        return (
          <ProjectsView 
            {...viewProps} 
            onAddProject={handleAddProject}
            onUpdateProject={handleUpdateProject}
            onDeleteProject={handleDeleteProject}
          />
        )
      case "contexts":
        return (
          <ContextsView 
            {...viewProps} 
            onSelect={(id) => {
              setInitialContextId(id)
              setInitialPersonId(undefined)
              setActiveView("all")
            }}
            onUpdateContext={async (c) => {
              const doc = await db.contexts.findOne(c.id).exec()
              if (doc) await doc.patch(c)
            }}
            onDeleteContext={async (id) => {
              const doc = await db.contexts.findOne(id).exec()
              if (doc) await doc.remove()
            }}
          />
        )
      case "persons":
        return (
          <PersonsView 
            persons={persons}
            tasks={tasks}
            onSelect={(id) => {
              setInitialPersonId(id)
              setInitialContextId(undefined)
              setActiveView("all")
            }}
            onUpdatePerson={async (p) => {
              const doc = await db.persons.findOne(p.id).exec()
              if (doc) await doc.patch(p)
            }}
            onDeletePerson={async (id) => {
              const doc = await db.persons.findOne(id).exec()
              if (doc) await doc.remove()
            }}
          />
        )
      case "settings":
        return (
          <SettingsView 
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
          />
        )
      default:
        return <HomeView {...viewProps} />
    }
  }

  return (
    <div className="flex h-screen w-full bg-background overflow-hidden">
      <AppSidebar 
        active={activeView} 
        onChange={handleNavigate} 
        inboxCount={inboxCount}
        totalCount={totalCount}
        syncStatus={syncStatus}
        workspaceLabel={workspaceLabel}
        workspaceInitial={workspaceInitial}
      />
      
      <div className="flex flex-1 flex-col min-w-0 h-full overflow-hidden">
        <AppHeader 
          view={activeView} 
          onNavigate={handleNavigate} 
          user={user} 
          onSignOut={onSignOut} 
          syncStatus={syncStatus}
        />
        
        <main className="flex-1 overflow-y-auto pb-24 md:pb-6 px-4 md:px-6 py-6">
          <div className="w-full h-full">
            {renderView()}
          </div>
        </main>
      </div>

      <MobileNav 
        active={activeView} 
        onChange={handleNavigate} 
        inboxCount={inboxCount} 
      />
    </div>
  )
}