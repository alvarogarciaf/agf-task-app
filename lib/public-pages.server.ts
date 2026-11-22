import "server-only"
import { randomUUID } from "crypto"
import {
  firestoreDelete,
  firestoreGet,
  firestoreList,
  firestoreSet,
  type FirestoreDoc,
} from "@/lib/firebase/admin-rest"
import type {
  LinkFieldPreview,
  ListCategory,
  ListField,
  ListFieldType,
  ListItem,
  ObjectType,
} from "@/lib/types"
import type {
  PublicEmbeddedTask,
  PublicPageData,
} from "@/lib/public-page-types"

const SAFE_ID_RE = /^[a-zA-Z0-9_-]{1,128}$/
const ALLOWED_FIELD_TYPES = new Set<ListFieldType>([
  "text",
  "number",
  "link",
  "image",
  "date",
])
const INITIAL_PUSH_GRACE_MS = 15_000
const MAX_EMBEDDED_TASKS = 25

export function isSafeId(val: unknown): val is string {
  return typeof val === "string" && SAFE_ID_RE.test(val)
}

function toIsoString(val: unknown): string | null {
  if (val instanceof Date) {
    return Number.isNaN(val.getTime()) ? null : val.toISOString()
  }
  if (typeof val === "string") {
    return val
  }
  return null
}

function toEpochMs(val: unknown): number | null {
  if (typeof val === "number" && Number.isFinite(val)) {
    return val
  }
  if (val instanceof Date) {
    return Number.isNaN(val.getTime()) ? null : val.getTime()
  }
  return null
}

function normalizeLinkPreviews(
  raw: unknown,
): Record<string, LinkFieldPreview | null> | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null
  const out: Record<string, LinkFieldPreview | null> = {}
  let count = 0

  for (const [key, val] of Object.entries(raw)) {
    if (!val || typeof val !== "object" || Array.isArray(val)) continue
    const obj = val as Record<string, unknown>
    if (typeof obj.url !== "string" || !obj.url.trim()) continue
    out[key] = {
      url: obj.url,
      title: typeof obj.title === "string" ? obj.title : null,
      description: typeof obj.description === "string" ? obj.description : null,
      domain: typeof obj.domain === "string" ? obj.domain : null,
      imageUrl: typeof obj.imageUrl === "string" ? obj.imageUrl : null,
      fetched_at: toEpochMs(obj.fetched_at),
    }
    count++
  }

  return count > 0 ? out : null
}

function normalizeCustomFields(
  raw: unknown,
): Record<string, string | number | null> | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null
  const out: Record<string, string | number | null> = {}
  let count = 0

  for (const [key, val] of Object.entries(raw)) {
    if (val === null) {
      out[key] = null
      count++
    } else if (typeof val === "string") {
      out[key] = val
      count++
    } else if (typeof val === "number" && Number.isFinite(val)) {
      out[key] = val
      count++
    } else if (val instanceof Date && !Number.isNaN(val.getTime())) {
      out[key] = val.toISOString()
      count++
    }
  }

  return count > 0 ? out : null
}

function normalizeListItems(raw: unknown): ListItem[] | null {
  if (!Array.isArray(raw)) return null
  const items: ListItem[] = []
  for (const entry of raw) {
    if (!entry || typeof entry !== "object") continue
    const item = entry as Record<string, unknown>
    if (typeof item.id !== "string" || typeof item.description !== "string") {
      continue
    }
    items.push({
      id: item.id,
      description: item.description,
      status: item.status === "Done" ? "Done" : "Open",
      order:
        typeof item.order === "number" && Number.isFinite(item.order)
          ? item.order
          : items.length,
      date_created: toIsoString(item.date_created) ?? new Date(0).toISOString(),
      category_id:
        typeof item.category_id === "string" ? item.category_id : null,
      category: typeof item.category === "string" ? item.category : null,
      details: typeof item.details === "string" ? item.details : null,
      custom_fields: normalizeCustomFields(item.custom_fields),
      link_previews: normalizeLinkPreviews(item.link_previews),
    })
  }
  return items
}

function normalizeListCategories(raw: unknown): ListCategory[] | null {
  if (!Array.isArray(raw)) return null
  const categories: ListCategory[] = []
  for (const entry of raw) {
    if (!entry || typeof entry !== "object") continue
    const cat = entry as Record<string, unknown>
    if (typeof cat.id !== "string" || typeof cat.name !== "string") continue
    categories.push({
      id: cat.id,
      name: cat.name,
      color: typeof cat.color === "string" ? cat.color : undefined,
      icon: typeof cat.icon === "string" ? cat.icon : undefined,
    })
  }
  return categories
}

function normalizeListFields(raw: unknown): ListField[] | null {
  if (!Array.isArray(raw)) return null
  const fields: ListField[] = []
  for (const entry of raw) {
    if (!entry || typeof entry !== "object") continue
    const f = entry as Record<string, unknown>
    if (
      typeof f.id !== "string" ||
      typeof f.name !== "string" ||
      typeof f.type !== "string" ||
      !ALLOWED_FIELD_TYPES.has(f.type as ListFieldType)
    ) {
      continue
    }
    fields.push({
      id: f.id,
      name: f.name,
      type: f.type as ListFieldType,
      order:
        typeof f.order === "number" && Number.isFinite(f.order)
          ? f.order
          : fields.length,
    })
  }
  return fields
}

function extractEmbeddedTaskIds(details: string, ownerTaskId: string): string[] {
  const ids: string[] = []
  const seen = new Set<string>([ownerTaskId])
  const re = /\[task:([a-zA-Z0-9-]+)\]/g
  let match: RegExpExecArray | null
  while ((match = re.exec(details)) !== null) {
    const id = match[1]
    if (!seen.has(id) && isSafeId(id)) {
      seen.add(id)
      ids.push(id)
      if (ids.length >= MAX_EMBEDDED_TASKS) break
    }
  }
  return ids
}

export async function getPublicPageBySlug(
  slug: string,
): Promise<PublicPageData | null> {
  if (!isSafeId(slug)) return null

  let pubDoc: FirestoreDoc | null = null
  try {
    const direct = await firestoreGet(`public_pages/${slug}`)
    if (direct.exists) {
      pubDoc = direct
    } else {
      const byTask = await firestoreList("public_pages", {
        where: { field: "taskId", op: "EQUAL", value: slug },
        limit: 1,
      })
      if (byTask.length > 0 && byTask[0].exists) {
        pubDoc = byTask[0]
      }
    }
  } catch (err) {
    console.error("[PublicPages] Failed to lookup public_pages index:", err)
    return null
  }

  if (!pubDoc || !pubDoc.exists) return null
  const pubData = pubDoc.data()
  if (!pubData) return null

  const ownerUid = pubData.ownerUid
  const taskId = pubData.taskId
  const publishedAt = toEpochMs(pubData.updatedAt)
  const publicId = pubDoc.id

  if (!isSafeId(ownerUid) || !isSafeId(taskId) || !isSafeId(publicId)) {
    return null
  }

  let taskDoc: FirestoreDoc
  try {
    taskDoc = await firestoreGet(`users/${ownerUid}/tasks/${taskId}`)
  } catch (err) {
    console.error("[PublicPages] Failed to fetch task document:", err)
    return null
  }

  if (!taskDoc.exists) return null
  const raw = taskDoc.data() || {}

  if (raw._deleted === true) return null

  const taskUpdatedAt = toEpochMs(raw.updated_at)
  if (raw.is_public !== true) {
    const withinGraceWindow =
      publishedAt !== null && Date.now() - publishedAt < INITIAL_PUSH_GRACE_MS
    const explicitlyUnpublishedAfterPublish =
      raw.is_public === false &&
      taskUpdatedAt !== null &&
      publishedAt !== null &&
      taskUpdatedAt > publishedAt + 2000

    if (!withinGraceWindow || explicitlyUnpublishedAfterPublish) {
      return null
    }
  }

  const objectType: ObjectType = raw.type === "note" ? "note" : "task"
  const detailsStr = typeof raw.details === "string" ? raw.details : null

  const urgencyCache = new Map<
    string,
    Promise<{ name: string; color: string } | null>
  >()
  const fetchUrgency = (urgencyId: unknown) => {
    if (!isSafeId(urgencyId)) return Promise.resolve(null)
    const cached = urgencyCache.get(urgencyId)
    if (cached) return cached
    const promise = firestoreGet(`users/${ownerUid}/urgencies/${urgencyId}`)
      .then((doc) => {
        if (!doc.exists) return null
        const d = doc.data()
        if (!d || typeof d.name !== "string" || typeof d.color !== "string") {
          return null
        }
        return { name: d.name, color: d.color }
      })
      .catch(() => null)
    urgencyCache.set(urgencyId, promise)
    return promise
  }

  const urgencyPromise =
    objectType !== "note" ? fetchUrgency(raw.urgency_id) : Promise.resolve(null)

  const projectStylePromise =
    objectType === "note" &&
    (!raw.icon || !raw.color) &&
    isSafeId(raw.project_id)
      ? firestoreGet(`users/${ownerUid}/projects/${raw.project_id}`)
          .then((doc) => {
            if (!doc.exists) return { icon: null, color: null }
            const d = doc.data() || {}
            return {
              icon: typeof d.icon === "string" ? d.icon : null,
              color: typeof d.color === "string" ? d.color : null,
            }
          })
          .catch(() => ({ icon: null, color: null }))
      : Promise.resolve({ icon: null, color: null })

  const embeddedIds = detailsStr
    ? extractEmbeddedTaskIds(detailsStr, taskId)
    : []
  const embeddedPromise = Promise.all(
    embeddedIds.map(async (embId): Promise<PublicEmbeddedTask | null> => {
      try {
        const embDoc = await firestoreGet(`users/${ownerUid}/tasks/${embId}`)
        if (!embDoc.exists) return null
        const embRaw = embDoc.data() || {}
        if (embRaw._deleted === true) return null
        const embType: ObjectType = embRaw.type === "note" ? "note" : "task"
        const embUrgency =
          embType !== "note" ? await fetchUrgency(embRaw.urgency_id) : null
        return {
          id: embId,
          type: embType,
          description:
            typeof embRaw.description === "string" ? embRaw.description : "",
          status: embRaw.status === "Done" ? "Done" : "Open",
          icon: typeof embRaw.icon === "string" ? embRaw.icon : null,
          color: typeof embRaw.color === "string" ? embRaw.color : null,
          urgency: embUrgency,
        }
      } catch {
        return null
      }
    }),
  )

  const [urgency, projectStyle, embeddedList] = await Promise.all([
    urgencyPromise,
    projectStylePromise,
    embeddedPromise,
  ])

  const embeddedTasks: Record<string, PublicEmbeddedTask> = {}
  for (const item of embeddedList) {
    if (item) {
      embeddedTasks[item.id] = item
    }
  }

  const effectiveIcon =
    typeof raw.icon === "string" && raw.icon
      ? raw.icon
      : projectStyle.icon
  const effectiveColor =
    typeof raw.color === "string" && raw.color
      ? raw.color
      : projectStyle.color

  return {
    id: taskId,
    public_id: publicId,
    type: objectType,
    description: typeof raw.description === "string" ? raw.description : "",
    details: detailsStr,
    date_created:
      toIsoString(raw.date_created) ?? new Date(0).toISOString(),
    updated_at: taskUpdatedAt,
    action_date: toIsoString(raw.action_date),
    status: raw.status === "Done" ? "Done" : "Open",
    icon: effectiveIcon ?? null,
    color: effectiveColor ?? null,
    urgency,
    is_list: raw.is_list === true,
    list_items: normalizeListItems(raw.list_items),
    list_categories: normalizeListCategories(raw.list_categories),
    list_fields: normalizeListFields(raw.list_fields),
    embedded_tasks: embeddedTasks,
  }
}

export async function setPublicPageState(params: {
  uid: string
  taskId: string
  isPublic: boolean
  publicId?: string | null
}): Promise<{ isPublic: boolean; publicId: string | null }> {
  const { uid, taskId, isPublic, publicId } = params
  if (!isSafeId(uid)) {
    throw new Error("Invalid user ID")
  }
  if (!isSafeId(taskId)) {
    throw new Error("Invalid task ID")
  }

  if (isPublic) {
    let finalPublicId: string | null = null

    if (publicId && isSafeId(publicId) && publicId.length >= 8) {
      const existing = await firestoreGet(`public_pages/${publicId}`)
      if (!existing.exists || existing.data()?.ownerUid === uid) {
        finalPublicId = publicId
      }
    }

    if (!finalPublicId) {
      const existingByTask = await firestoreList("public_pages", {
        where: { field: "taskId", op: "EQUAL", value: taskId },
        limit: 10,
      }).catch(() => [])
      const owned = existingByTask.find((d) => d.data()?.ownerUid === uid)
      if (owned && isSafeId(owned.id)) {
        finalPublicId = owned.id
      }
    }

    if (!finalPublicId) {
      finalPublicId = randomUUID()
    }

    await firestoreSet(`public_pages/${finalPublicId}`, {
      ownerUid: uid,
      taskId,
      updatedAt: Date.now(),
    })

    return { isPublic: true, publicId: finalPublicId }
  }

  const idsToDelete = new Set<string>()
  if (publicId && isSafeId(publicId)) {
    const existing = await firestoreGet(`public_pages/${publicId}`).catch(
      () => null,
    )
    if (existing?.exists && existing.data()?.ownerUid === uid) {
      idsToDelete.add(publicId)
    }
  }

  const existingByTask = await firestoreList("public_pages", {
    where: { field: "taskId", op: "EQUAL", value: taskId },
    limit: 10,
  }).catch(() => [])
  for (const doc of existingByTask) {
    if (doc.data()?.ownerUid === uid && isSafeId(doc.id)) {
      idsToDelete.add(doc.id)
    }
  }

  await Promise.all(
    [...idsToDelete].map((id) => firestoreDelete(`public_pages/${id}`)),
  )

  return { isPublic: false, publicId: publicId ?? null }
}
