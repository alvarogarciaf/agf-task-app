"use client"

import { useMemo, useState } from "react"
import { AppSidebar } from "@/components/app-sidebar"
import { AppHeader } from "@/components/app-header"
import { MobileNav } from "@/components/mobile-nav"
import { HomeView } from "@/components/views/home-view"
import { InboxView } from "@/components/views/inbox-view"
import { AllTasksView } from "@/components/views/all-tasks-view"
import { ContextsView } from "@/components/views/contexts-view"
import { PersonsView } from "@/components/views/persons-view"
import { ProjectsView } from "@/components/views/projects-view"
import { SettingsView } from "@/components/views/settings-view"
import { useDatabase } from "@/components/db-provider"
import { useRxQuery } from "@/hooks/useRxQuery"
import { v4 as uuidv4 } from "uuid"
import type { Task, ViewKey, Project, Person, Context, UrgencyLevel } from "@/lib/types"

export default function Page() {
  const [view, setView] = useState<ViewKey>("home")
  const db = useDatabase()
  
  const { result: tasks } = useRxQuery<Task>(db.tasks.find({ sort: [{ date_created: 'desc' }] }))
  const { result: projects } = useRxQuery<Project>(db.projects.find())
  const { result: persons } = useRxQuery<Person>(db.persons.find())
  const { result: contexts } = useRxQuery<Context>(db.contexts.find())
  const { result: urgencies } = useRxQuery<UrgencyLevel>(db.urgencies.find())

  const [online, setOnline] = useState(true)
  const [allTasksContextFilter, setAllTasksContextFilter] = useState<string | undefined>()
  const [allTasksPersonFilter, setAllTasksPersonFilter] = useState<string | undefined>()

  const inboxCount = useMemo(() => tasks.filter((t) => !t.processed).length, [tasks])

  async function toggleProcessed(id: string) {
    const taskDoc = await db.tasks.findOne(id).exec()
    if (taskDoc) {
      await taskDoc.incrementalPatch({ processed: !taskDoc.processed })
    }
  }

  async function updateTask(updated: Task) {
    const taskDoc = await db.tasks.findOne(updated.id).exec()
    if (taskDoc) {
      await taskDoc.incrementalPatch(updated)
    }
  }

  async function createTask(input: {
    description: string
    contextIds: string[]
    projectId: string | null
    personId: string | null
  }) {
    const newTask: Task = {
      id: uuidv4(),
      description: input.description,
      date_created: new Date().toISOString(),
      project_id: input.projectId,
      person_id: input.personId,
      context_ids: input.contextIds,
      processed: false,
      urgency_id: "u_medium", // default medium urgency
    }
    await db.tasks.insert(newTask)
  }

  // --- CRUD for Settings ---
  const crud = {
    onAddPerson: async (p: Omit<Person, "id">) => db.persons.insert({ id: uuidv4(), ...p }),
    onUpdatePerson: async (p: Person) => { const doc = await db.persons.findOne(p.id).exec(); if (doc) await doc.incrementalPatch(p); },
    onDeletePerson: async (id: string) => { const doc = await db.persons.findOne(id).exec(); if (doc) await doc.remove(); },
    
    onAddContext: async (c: Omit<Context, "id">) => db.contexts.insert({ id: uuidv4(), ...c }),
    onUpdateContext: async (c: Context) => { const doc = await db.contexts.findOne(c.id).exec(); if (doc) await doc.incrementalPatch(c); },
    onDeleteContext: async (id: string) => { const doc = await db.contexts.findOne(id).exec(); if (doc) await doc.remove(); },

    onAddUrgency: async (u: Omit<UrgencyLevel, "id">) => db.urgencies.insert({ id: uuidv4(), ...u }),
    onUpdateUrgency: async (u: UrgencyLevel) => { const doc = await db.urgencies.findOne(u.id).exec(); if (doc) await doc.incrementalPatch(u); },
    onDeleteUrgency: async (id: string) => { const doc = await db.urgencies.findOne(id).exec(); if (doc) await doc.remove(); },
  }

  return (
    <div className="flex h-screen w-full overflow-hidden bg-background">
      <AppSidebar
        active={view}
        onChange={(v) => {
          // Reset cross-view filters when navigating manually
          if (v !== "all") {
            setAllTasksContextFilter(undefined)
            setAllTasksPersonFilter(undefined)
          }
          setView(v)
        }}
        inboxCount={inboxCount}
        totalCount={tasks.length}
        online={online}
        onToggleOnline={() => setOnline((o) => !o)}
      />

      <main className="flex h-screen flex-1 flex-col overflow-hidden pb-[64px] md:pb-0">
        <AppHeader view={view} onNavigate={setView} />

        <div className="flex-1 overflow-y-auto">
          {view === "home" ? (
            <HomeView
              projects={projects}
              persons={persons}
              contexts={contexts}
              urgencies={urgencies}
              recent={tasks.slice(0, 6)}
              onCreate={createTask}
              onUpdate={updateTask}
            />
          ) : null}

          {view === "inbox" ? (
            <InboxView
              tasks={tasks}
              projects={projects}
              persons={persons}
              contexts={contexts}
              urgencies={urgencies}
              onToggleProcessed={toggleProcessed}
              onUpdate={updateTask}
            />
          ) : null}

          {view === "all" ? (
            <AllTasksView
              tasks={tasks}
              projects={projects}
              persons={persons}
              contexts={contexts}
              urgencies={urgencies}
              onToggleProcessed={toggleProcessed}
              onUpdate={updateTask}
              initialContextId={allTasksContextFilter}
              initialPersonId={allTasksPersonFilter}
            />
          ) : null}

          {view === "contexts" ? (
            <ContextsView
              contexts={contexts}
              tasks={tasks}
              onSelect={(id) => {
                setAllTasksContextFilter(id)
                setAllTasksPersonFilter(undefined)
                setView("all")
              }}
            />
          ) : null}

          {view === "persons" ? (
            <PersonsView
              persons={persons}
              tasks={tasks}
              onSelect={(id) => {
                setAllTasksPersonFilter(id)
                setAllTasksContextFilter(undefined)
                setView("all")
              }}
            />
          ) : null}

          {view === "projects" ? (
            <ProjectsView
              projects={projects}
              tasks={tasks}
              persons={persons}
              contexts={contexts}
              urgencies={urgencies}
              onToggleProcessed={toggleProcessed}
              onUpdate={updateTask}
            />
          ) : view === "settings" ? (
            <SettingsView
              persons={persons}
              contexts={contexts}
              urgencies={urgencies}
              {...crud}
            />
          ) : (
            <div className="p-6 text-center text-sm text-muted-foreground">
              View &quot;{view}&quot; not found
            </div>
          )}
        </div>
      </main>

      <MobileNav
        active={view}
        onChange={(v) => {
          if (v !== "all") {
            setAllTasksContextFilter(undefined)
            setAllTasksPersonFilter(undefined)
          }
          setView(v)
        }}
        inboxCount={inboxCount}
      />
    </div>
  )
}
