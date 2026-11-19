import type { ListCategory, ListField, ListFieldType, ListItem } from "@/lib/types"

export interface ListFieldTypeMeta {
  type: ListFieldType
  label: string
  description: string
  placeholder: string
}

export const LIST_FIELD_TYPES: ListFieldTypeMeta[] = [
  {
    type: "text",
    label: "Text",
    description: "Short notes, labels, or comments",
    placeholder: "Enter text...",
  },
  {
    type: "number",
    label: "Number",
    description: "Quantities, prices, ratings, or counts",
    placeholder: "0",
  },
  {
    type: "link",
    label: "Link",
    description: "Clickable website or reference URL",
    placeholder: "https://example.com",
  },
  {
    type: "image",
    label: "Image",
    description: "Upload a photo or paste an image URL",
    placeholder: "https://...",
  },
]

const CUSTOM_COLUMN_PREFIX = "custom:"

export function makeCustomColumnKey(fieldId: string): string {
  return `${CUSTOM_COLUMN_PREFIX}${fieldId}`
}

export function isCustomColumnKey(key: string): boolean {
  return key.startsWith(CUSTOM_COLUMN_PREFIX)
}

export function getCustomFieldId(key: string): string {
  return key.slice(CUSTOM_COLUMN_PREFIX.length)
}

/**
 * Normalizes a user-supplied URL and ensures only http(s) links are allowed,
 * preventing javascript: or data: URL injection.
 */
export function getSafeHref(raw: string | null | undefined): string | null {
  const trimmed = (raw ?? "").trim()
  if (!trimmed) return null

  let candidate = trimmed
  if (trimmed.startsWith("//")) {
    candidate = `https:${trimmed}`
  } else if (!/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(trimmed)) {
    candidate = `https://${trimmed}`
  }

  try {
    const parsed = new URL(candidate)
    if (parsed.protocol === "http:" || parsed.protocol === "https:") {
      return parsed.href
    }
    return null
  } catch {
    return null
  }
}

export function formatLinkLabel(raw: string): string {
  return raw
    .trim()
    .replace(/^https?:\/\//i, "")
    .replace(/^www\./i, "")
    .replace(/\/+$/, "")
}

export function formatNumberValue(val: number | string | null | undefined): string {
  if (val === null || val === undefined || val === "") return ""
  const num = typeof val === "number" ? val : Number(val)
  if (!Number.isFinite(num)) return ""
  return new Intl.NumberFormat(undefined, { maximumFractionDigits: 6 }).format(num)
}

export function sanitizeCustomFieldValue(
  type: ListFieldType,
  raw: unknown,
): string | number | null {
  if (raw === null || raw === undefined) return null

  if (type === "number") {
    if (typeof raw === "number") {
      return Number.isFinite(raw) ? raw : null
    }
    if (typeof raw === "string") {
      const trimmed = raw.trim()
      if (!trimmed) return null
      const num = Number(trimmed)
      return Number.isFinite(num) ? num : null
    }
    return null
  }

  if (typeof raw !== "string" && typeof raw !== "number") return null
  const str = String(raw).trim()
  return str.length > 0 ? str : null
}

export function cleanCustomFields(
  map: Record<string, string | number | null> | null | undefined,
  allowedFieldIds?: Set<string>,
): Record<string, string | number | null> | null {
  if (!map || typeof map !== "object") return null
  const result: Record<string, string | number | null> = {}
  let count = 0

  for (const [key, value] of Object.entries(map)) {
    if (allowedFieldIds && !allowedFieldIds.has(key)) continue
    if (value === null || value === undefined) continue
    if (typeof value === "number") {
      if (!Number.isFinite(value)) continue
      result[key] = value
      count++
    } else if (typeof value === "string") {
      const trimmed = value.trim()
      if (!trimmed) continue
      result[key] = trimmed
      count++
    }
  }

  return count > 0 ? result : null
}

function getCategoryName(item: ListItem, categories: ListCategory[]): string | null {
  if (item.category_id) {
    const found = categories.find((c) => c.id === item.category_id)
    if (found) return found.name
  }
  if (item.category) {
    const found = categories.find((c) => c.name === item.category || c.id === item.category)
    return found ? found.name : item.category
  }
  return null
}

export function compareListItems(
  a: ListItem,
  b: ListItem,
  sortKey: string,
  direction: "asc" | "desc",
  categories: ListCategory[],
  fields: ListField[],
): number {
  const dir = direction === "asc" ? 1 : -1

  if (sortKey === "order") {
    return (a.order - b.order) * dir
  }

  if (sortKey === "status") {
    const rankA = a.status === "Done" ? 1 : 0
    const rankB = b.status === "Done" ? 1 : 0
    if (rankA !== rankB) return (rankA - rankB) * dir
    return a.order - b.order
  }

  if (sortKey === "description") {
    const cmp = a.description.localeCompare(b.description, undefined, { sensitivity: "base" })
    if (cmp !== 0) return cmp * dir
    return a.order - b.order
  }

  if (sortKey === "details") {
    const valA = a.details?.trim() || null
    const valB = b.details?.trim() || null
    if (valA === null && valB === null) return a.order - b.order
    if (valA === null) return 1
    if (valB === null) return -1
    const cmp = valA.localeCompare(valB, undefined, { sensitivity: "base" })
    if (cmp !== 0) return cmp * dir
    return a.order - b.order
  }

  if (sortKey === "category") {
    const catA = getCategoryName(a, categories)
    const catB = getCategoryName(b, categories)
    if (catA === null && catB === null) return a.order - b.order
    if (catA === null) return 1
    if (catB === null) return -1
    const cmp = catA.localeCompare(catB, undefined, { sensitivity: "base" })
    if (cmp !== 0) return cmp * dir
    return a.order - b.order
  }

  if (sortKey === "date_created") {
    const timeA = new Date(a.date_created).getTime()
    const timeB = new Date(b.date_created).getTime()
    if (timeA !== timeB) return (timeA - timeB) * dir
    return a.order - b.order
  }

  if (isCustomColumnKey(sortKey)) {
    const fieldId = getCustomFieldId(sortKey)
    const field = fields.find((f) => f.id === fieldId)
    if (!field) return a.order - b.order

    const valA = sanitizeCustomFieldValue(field.type, a.custom_fields?.[fieldId])
    const valB = sanitizeCustomFieldValue(field.type, b.custom_fields?.[fieldId])

    if (valA === null && valB === null) return a.order - b.order
    if (valA === null) return 1
    if (valB === null) return -1

    if (field.type === "number") {
      const numA = typeof valA === "number" ? valA : Number(valA)
      const numB = typeof valB === "number" ? valB : Number(valB)
      if (numA !== numB) return (numA - numB) * dir
      return a.order - b.order
    }

    if (field.type === "image") {
      // Both items have an image when reaching here
      const cmp = String(valA).localeCompare(String(valB), undefined, { sensitivity: "base" })
      if (cmp !== 0) return cmp * dir
      return a.order - b.order
    }

    const cmp = String(valA).localeCompare(String(valB), undefined, { sensitivity: "base" })
    if (cmp !== 0) return cmp * dir
    return a.order - b.order
  }

  return a.order - b.order
}
