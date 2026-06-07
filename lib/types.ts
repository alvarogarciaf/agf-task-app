export interface UrgencyLevel {
  id: string
  name: string
  color: string
  order: number
}

export type ProjectStatus = "Ongoing" | "Closed"

// The unified object can be a task or a note. Both kinds always carry
// context_ids and tag_ids so conversion between them stays lossless.
export type ObjectType = "task" | "note"

export interface AppObject {
  id: string
  type?: ObjectType
  description: string
  details?: string | null
  date_created: string
  show_on?: string | null
  action_date?: string | null
  project_id?: string | null
  person_id?: string | null
  context_ids: string[]
  tag_ids?: string[]
  processed: boolean
  status: "Open" | "Done"
  urgency_id: string
  archived?: boolean
  google_event_id?: string | null
}

// `Task` remains the name used across the app; it is now an alias of the
// unified object type so existing imports keep working.
export type Task = AppObject

export interface Project {
  id: string
  name: string
  details?: string | null
  status: ProjectStatus
  linked_person_id?: string | null
  icon?: string | null
  color?: string | null
}

export interface Person {
  id: string
  name: string
  initials: string
  color: string
  linked_uid?: string | null
  linked_email?: string | null
  pending_invite_email?: string | null
}

export interface Context {
  id: string
  name: string
  icon: string
  color: string
}

export interface Tag {
  id: string
  name: string
  icon: string
  color: string
}

export interface SavedView {
  id: string
  name: string
  icon: string
  color: string
  // The configuration
  context_ids: string[]
  project_id?: string | null
  person_id?: string | null
  show_status: "all" | "open" | "done"
  is_grouped_by_project: boolean
  show_hidden_by_show_on: boolean
  sort_key: string
  sort_direction: "asc" | "desc"
  date_created: string
  order: number
}

export type ViewKey =
  | "home"
  | "inbox"
  | "all"
  | "contexts"
  | "persons"
  | "projects"
  | "settings"
  | "saved-view"
  | "today"
  | "notes"
  | "tags"
