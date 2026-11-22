import type {
  ListCategory,
  ListField,
  ListItem,
  ObjectType,
} from "@/lib/types"

export interface PublicEmbeddedTask {
  id: string
  type: ObjectType
  description: string
  status: "Open" | "Done"
  icon?: string | null
  color?: string | null
  urgency?: { name: string; color: string } | null
}

export interface PublicPageData {
  id: string
  public_id: string
  type: ObjectType
  description: string
  details: string | null
  date_created: string
  updated_at: number | null
  action_date: string | null
  status: "Open" | "Done"
  icon: string | null
  color: string | null
  urgency: { name: string; color: string } | null
  is_list: boolean
  list_items: ListItem[] | null
  list_categories: ListCategory[] | null
  list_fields: ListField[] | null
  embedded_tasks: Record<string, PublicEmbeddedTask>
}
