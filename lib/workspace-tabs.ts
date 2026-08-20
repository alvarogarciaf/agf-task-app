import type { TabKey } from "@/components/views/settings-view"
import type { SavedView, ViewKey } from "@/lib/types"

export type TabRoute =
  | { kind: "empty" }
  | {
      kind: "view"
      view: ViewKey
      savedViewId?: string | null
      settingsTab?: TabKey
    }

export type TabUiState = {
  initialContextId?: string
  initialPersonId?: string
  initialTagId?: string
  initialProjectId?: string
  /** Desktop only: when set, the tab renders a full-screen object editor
   *  over its current route. The route remains the "previous screen". */
  objectId?: string
  objectMode?: "view" | "edit"
}

export type WorkspaceTab = {
  id: string
  route: TabRoute
  ui: TabUiState
}

export const VIEW_TITLES: Record<ViewKey, string> = {
  home: "Inbox",
  inbox: "Inbox",
  all: "All Tasks",
  contexts: "Contexts",
  persons: "People",
  projects: "Projects",
  settings: "Settings",
  "saved-view": "Saved View",
  today: "Today",
  notes: "Notes",
  bookmarks: "Bookmarks",
  tags: "Tags",
}

export function createEmptyTab(): WorkspaceTab {
  return {
    id: crypto.randomUUID(),
    route: { kind: "empty" },
    ui: {},
  }
}

export function createTabFromRoute(route: TabRoute): WorkspaceTab {
  return {
    id: crypto.randomUUID(),
    route,
    ui: {},
  }
}

export function getTabTitle(
  tab: WorkspaceTab,
  savedViews: SavedView[],
  objectTitle?: string,
  projectName?: string,
  contextName?: string,
  personName?: string,
  tagName?: string
): string {
  if (objectTitle) {
    return objectTitle.length > 25 ? objectTitle.slice(0, 25) + "..." : objectTitle
  }
  if (tab.route.kind === "empty") return "New tab"
  const { view, savedViewId } = tab.route
  if (view === "saved-view") {
    return savedViews.find((v) => v.id === savedViewId)?.name || "Saved View"
  }
  if (view === "projects" && projectName) {
    return projectName
  }
  if (view === "contexts" && contextName) {
    return contextName
  }
  if (view === "persons" && personName) {
    return personName
  }
  if (view === "tags" && tagName) {
    return tagName
  }
  return VIEW_TITLES[view]
}

export function routeFromSearchParams(search: string): TabRoute {
  const params = new URLSearchParams(search)
  const view = params.get("view") as ViewKey | null
  if (!view) return { kind: "view", view: "home" }
  return {
    kind: "view",
    view,
    savedViewId: params.get("savedViewId"),
    settingsTab: (params.get("tab") as TabKey) || undefined,
  }
}

export function syncUrlToRoute(route: TabRoute) {
  if (typeof window === "undefined") return
  const params = new URLSearchParams(window.location.search)
  if (route.kind === "empty") {
    params.delete("view")
    params.delete("savedViewId")
    params.delete("tab")
    params.delete("project")
    params.delete("objectId")
  } else {
    params.set("view", route.view)
    if (route.savedViewId) params.set("savedViewId", route.savedViewId)
    else params.delete("savedViewId")
    if (route.settingsTab) params.set("tab", route.settingsTab)
    else params.delete("tab")
    params.delete("project")
    params.delete("objectId")
  }
  const qs = params.toString()
  const newUrl = qs ? `${window.location.pathname}?${qs}` : window.location.pathname
  const currentIdx = typeof window.history.state?.idx === "number" ? window.history.state.idx : 0
  const nextIdx = currentIdx + 1
  window.history.pushState({ idx: nextIdx }, "", newUrl)
  window.dispatchEvent(new CustomEvent("app-history-change", { detail: { idx: nextIdx } }))
}

export function getSidebarActive(route: TabRoute): {
  view: ViewKey | null
  savedViewId: string | null
} {
  if (route.kind !== "view") {
    return { view: null, savedViewId: null }
  }
  return {
    view: route.view,
    savedViewId: route.savedViewId ?? null,
  }
}
