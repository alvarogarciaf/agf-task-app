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
  details?: string
  date_created: string
  show_on?: string | null
  action_date?: string | null
  project_id?: string | null
  person_id?: string | null
  context_ids: string[]
  processed: boolean
  urgency_id: string
}

export interface Project {
  id: string
  name: string
  details?: string
  status: ProjectStatus
}

export interface Person {
  id: string
  name: string
  initials: string
  color: string
}

export interface Context {
  id: string
  name: string
  icon: string
  color: string
}

export type ViewKey =
  | "home"
  | "inbox"
  | "all"
  | "contexts"
  | "persons"
  | "projects"
  | "settings"
