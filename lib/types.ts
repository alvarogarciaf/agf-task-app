export interface UrgencyLevel {
  id: string
  name: string
  color: string
  order: number
}

export type ProjectStatus = "Ongoing" | "Closed"

export interface Task {
  id: string
  description: string
  details?: string | null
  date_created: string
  show_on?: string | null
  action_date?: string | null
  project_id?: string | null
  person_id?: string | null
  context_ids: string[]
  processed: boolean
  status: "Open" | "Done"
  urgency_id: string
  archived?: boolean
  google_event_id?: string | null
}

export interface Project {
  id: string
  name: string
  details?: string | null
  status: ProjectStatus
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
