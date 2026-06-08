"use client"

import { HomeView } from "@/components/views/home-view"
import { InboxView } from "@/components/views/inbox-view"
import { AllTasksView } from "@/components/views/all-tasks-view"
import { ProjectsView } from "@/components/views/projects-view"
import { ContextsView } from "@/components/views/contexts-view"
import { TagsView } from "@/components/views/tags-view"
import { NotesView } from "@/components/views/notes-view"
import { SettingsView, type TabKey } from "@/components/views/settings-view"
import { PersonsView } from "@/components/views/persons-view"
import { TabEmptyState } from "@/components/tab-empty-state"
import type { Context, Person, Project, Task, Tag, UrgencyLevel, ViewKey, SavedView } from "@/lib/types"
import type { TabRoute, TabUiState } from "@/lib/workspace-tabs"
import type { SyncStatus } from "@/components/db-provider"

export type NavigateFn = (
  view: ViewKey,
  savedViewId?: string,
  settingsTab?: TabKey,
) => void

export type UpdateUiFn = (patch: Partial<TabUiState>) => void

interface WorkspaceViewContentProps {
  route: TabRoute
  ui: TabUiState
  onNavigate: NavigateFn
  onUpdateUi: UpdateUiFn
  inboxTasks: Task[]
  activeTasks: Task[]
  notes: Task[]
  projects: Project[]
  persons: Person[]
  contexts: Context[]
  tags: Tag[]
  urgencies: UrgencyLevel[]
  savedViews: SavedView[]
  syncStatus: SyncStatus
  userUid: string
  hideDesktopAdd?: boolean
  onSyncCalendar: (token: string) => Promise<void>
  onCreateTask: (input: {
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
  }) => Promise<string>
  onCreateNote: (input: {
    description: string
    contextIds: string[]
    projectId: string | null
    personId: string | null
    processed: boolean
  }) => Promise<string>
  onUpdateTask: (task: Task) => Promise<void>
  onToggleProcessed: (id: string) => Promise<void>
  onToggleStatus: (id: string) => Promise<void>
  onArchiveTask: (id: string) => Promise<void>
  onDeleteTask: (id: string) => Promise<void>
  onAddProject: (p: Omit<Project, "id">) => Promise<void>
  onUpdateProject: (p: Project) => Promise<void>
  onDeleteProject: (id: string) => Promise<void>
  onAddTag: (t: Omit<Tag, "id">) => Promise<void>
  onUpdateTag: (t: Tag) => Promise<void>
  onDeleteTag: (id: string) => Promise<void>
  onDeleteAllTasks: () => Promise<void>
  onResetDatabase: () => Promise<void>
  onInsertPerson: (p: Omit<Person, "id">) => Promise<void>
  onPatchPerson: (p: Person) => Promise<void>
  onRemovePerson: (id: string) => Promise<void>
  onInsertContext: (c: Omit<Context, "id">) => Promise<void>
  onPatchContext: (c: Context) => Promise<void>
  onRemoveContext: (id: string) => Promise<void>
  onInsertUrgency: (u: Omit<UrgencyLevel, "id">) => Promise<void>
  onPatchUrgency: (u: UrgencyLevel) => Promise<void>
  onRemoveUrgency: (id: string) => Promise<void>
}

export function WorkspaceViewContent({
  route,
  ui,
  onNavigate,
  onUpdateUi,
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
  userUid,
  hideDesktopAdd,
  onSyncCalendar,
  onCreateTask,
  onCreateNote,
  onUpdateTask,
  onToggleProcessed,
  onToggleStatus,
  onArchiveTask,
  onDeleteTask,
  onAddProject,
  onUpdateProject,
  onDeleteProject,
  onAddTag,
  onUpdateTag,
  onDeleteTag,
  onDeleteAllTasks,
  onResetDatabase,
  onInsertPerson,
  onPatchPerson,
  onRemovePerson,
  onInsertContext,
  onPatchContext,
  onRemoveContext,
  onInsertUrgency,
  onPatchUrgency,
  onRemoveUrgency,
}: WorkspaceViewContentProps) {
  if (route.kind === "empty") {
    return <TabEmptyState />
  }

  const view = route.view
  const savedViewId = route.savedViewId ?? null
  const settingsTab = route.settingsTab ?? "contexts"

  const activeViewProps = {
    tasks: activeTasks,
    projects,
    persons,
    contexts,
    urgencies,
    onUpdate: onUpdateTask,
    onToggleProcessed,
    onToggleStatus,
    onArchiveTask,
    onDeleteTask,
    onCreate: onCreateTask,
    onAddPerson: onInsertPerson,
    hideDesktopAdd,
  }

  switch (view) {
    case "home":
      return <HomeView {...activeViewProps} tasks={inboxTasks} />
    case "inbox":
      return (
        <InboxView
          {...activeViewProps}
          tasks={inboxTasks}
          onAddPerson={onInsertPerson}
        />
      )
    case "saved-view": {
      const sv = savedViews.find((v) => v.id === savedViewId)
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
    case "today": {
      const todayStr = new Date().toLocaleDateString("en-CA")
      const todayTasks = activeTasks.filter((t) => {
        if (t.status === "Done" || !t.action_date) return false
        const taskDateStr = t.action_date.slice(0, 10)
        return taskDateStr === todayStr
      })

      return (
        <AllTasksView
          {...activeViewProps}
          tasks={todayTasks}
          allowUnprocessed={true}
          fullWidthOnMobile={true}
          onCreate={async (input) => {
            const todayIsoString = new Date().toISOString()
            return await onCreateTask({
              ...input,
              actionDate: todayIsoString,
              showOn: null,
            })
          }}
        />
      )
    }
    case "all":
      return (
        <AllTasksView
          {...activeViewProps}
          initialContextId={ui.initialContextId}
          initialPersonId={ui.initialPersonId}
          fullWidthOnMobile={true}
        />
      )
    case "projects":
      return (
        <ProjectsView
          {...activeViewProps}
          notes={notes}
          tags={tags}
          onCreateNote={onCreateNote}
          onAddProject={onAddProject}
          onUpdateProject={onUpdateProject}
          onDeleteProject={onDeleteProject}
        />
      )
    case "contexts":
      return (
        <ContextsView
          tasks={activeTasks}
          contexts={contexts}
          onSelect={(id) => {
            onUpdateUi({
              initialContextId: id,
              initialPersonId: undefined,
              initialTagId: undefined,
            })
            onNavigate("all")
          }}
          onUpdateContext={onPatchContext}
          onDeleteContext={onRemoveContext}
          onAddContext={onInsertContext}
        />
      )
    case "notes":
      return (
        <NotesView
          tasks={notes}
          projects={projects}
          persons={persons}
          tags={tags}
          urgencies={urgencies}
          onUpdate={onUpdateTask}
          onToggleProcessed={onToggleProcessed}
          onToggleStatus={onToggleStatus}
          onArchiveTask={onArchiveTask}
          onDeleteTask={onDeleteTask}
          onCreate={onCreateNote}
          initialTagId={ui.initialTagId}
          fullWidthOnMobile={true}
          hideDesktopAdd={hideDesktopAdd}
        />
      )
    case "tags":
      return (
        <TagsView
          tags={tags}
          notes={notes}
          onSelect={(id) => {
            onUpdateUi({ initialTagId: id })
            onNavigate("notes")
          }}
          onUpdateTag={onUpdateTag}
          onDeleteTag={onDeleteTag}
          onAddTag={onAddTag}
        />
      )
    case "persons":
      return (
        <PersonsView
          tasks={activeTasks}
          persons={persons}
          onSelect={(id) => {
            onUpdateUi({
              initialPersonId: id,
              initialContextId: undefined,
              initialTagId: undefined,
            })
            onNavigate("all")
          }}
          onUpdatePerson={onPatchPerson}
          onDeletePerson={onRemovePerson}
          onAddPerson={onInsertPerson}
        />
      )
    case "settings":
      return (
        <SettingsView
          activeTab={settingsTab}
          onTabChange={(tab) => onNavigate("settings", undefined, tab)}
          persons={persons}
          contexts={contexts}
          tags={tags}
          urgencies={urgencies}
          onAddPerson={onInsertPerson}
          onUpdatePerson={onPatchPerson}
          onDeletePerson={onRemovePerson}
          onAddContext={onInsertContext}
          onUpdateContext={onPatchContext}
          onDeleteContext={onRemoveContext}
          onAddTag={onAddTag}
          onUpdateTag={onUpdateTag}
          onDeleteTag={onDeleteTag}
          onAddUrgency={onInsertUrgency}
          onUpdateUrgency={onPatchUrgency}
          onDeleteUrgency={onRemoveUrgency}
          onDeleteAllTasks={onDeleteAllTasks}
          onResetDatabase={onResetDatabase}
          syncStatus={syncStatus}
          userUid={userUid}
          onSyncCalendar={onSyncCalendar}
        />
      )
    default:
      return <HomeView {...activeViewProps} tasks={inboxTasks} />
  }
}
