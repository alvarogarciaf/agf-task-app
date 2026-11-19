"use client"

import { useCallback, useEffect, useRef, useState } from "react"

/**
 * Persisted table column state: visibility map + ordering.
 * Stored together so visibility toggles and drag-reordering both survive reloads.
 *
 * Shape on disk:
 *   { visibility: Record<K, boolean>, order: K[] }
 *
 * On hydration we merge against `defaultOrder` so newly-added columns appear
 * automatically (appended) and removed columns are dropped.
 */
export function useTableColumns<K extends string>(
  storageKey: string,
  defaultOrder: K[],
  defaultVisibility: Record<K, boolean>,
) {
  const [order, setOrder] = useState<K[]>(defaultOrder)
  const [visibility, setVisibility] = useState<Record<K, boolean>>(defaultVisibility)
  const [hydrated, setHydrated] = useState(false)

  // Hydrate from localStorage on mount
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(storageKey)
      if (raw) {
        const parsed = JSON.parse(raw) as {
          visibility?: Record<string, boolean>
          order?: string[]
        }

        // Visibility: merge with defaults (handles newly-added keys)
        const mergedVis = { ...defaultVisibility } as Record<K, boolean>
        if (parsed.visibility) {
          for (const key of Object.keys(defaultVisibility) as K[]) {
            if (typeof parsed.visibility[key] === "boolean") {
              mergedVis[key] = parsed.visibility[key]!
            }
          }
        }
        setVisibility(mergedVis)

        // Order: keep stored order for known keys, append any new keys
        if (Array.isArray(parsed.order)) {
          const known = new Set(defaultOrder)
          const filtered = parsed.order.filter((k): k is K => known.has(k as K))
          const missing = defaultOrder.filter((k) => !filtered.includes(k))
          setOrder([...filtered, ...missing])
        }
      }
    } catch {
      // Ignore corrupted state, fall back to defaults
    }
    setHydrated(true)
    // We intentionally only run this on mount (storageKey is stable per usage).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storageKey])

  // Persist on change (only after hydration so we don't overwrite stored state)
  useEffect(() => {
    if (!hydrated) return
    try {
      window.localStorage.setItem(
        storageKey,
        JSON.stringify({ visibility, order }),
      )
    } catch {
      // Storage may be unavailable (private mode, quota) — fail silently
    }
  }, [storageKey, visibility, order, hydrated])

  function toggle(key: K) {
    setVisibility((prev) => {
      const next = { ...prev, [key]: !prev[key] }
      // Guarantee at least one column stays visible
      const anyVisible = Object.values(next).some(Boolean)
      return anyVisible ? next : prev
    })
  }

  /** Move column `sourceKey` to the position of `targetKey` (insert before). */
  function reorder(sourceKey: K, targetKey: K) {
    if (sourceKey === targetKey) return
    setOrder((prev) => {
      const next = prev.filter((k) => k !== sourceKey)
      const targetIdx = next.indexOf(targetKey)
      if (targetIdx === -1) return prev
      next.splice(targetIdx, 0, sourceKey)
      return next
    })
  }

  function reset() {
    setVisibility(defaultVisibility)
    setOrder(defaultOrder)
  }

  return { order, visibility, toggle, reorder, reset, hydrated }
}

export interface DynamicColumnSpec {
  key: string
  defaultVisible: boolean
}

function buildDefaultVisibility(columns: DynamicColumnSpec[]): Record<string, boolean> {
  const vis: Record<string, boolean> = {}
  for (const col of columns) {
    vis[col.key] = col.defaultVisible
  }
  if (columns.length > 0 && !Object.values(vis).some(Boolean)) {
    vis[columns[0].key] = true
  }
  return vis
}

export function useDynamicTableColumns(
  storageKey: string | undefined,
  columns: DynamicColumnSpec[],
) {
  const columnsRef = useRef(columns)
  useEffect(() => {
    columnsRef.current = columns
  })

  const columnsSignature = columns.map((c) => c.key).join("|")

  const [order, setOrder] = useState<string[]>(() => columns.map((c) => c.key))
  const [visibility, setVisibility] = useState<Record<string, boolean>>(() =>
    buildDefaultVisibility(columns),
  )
  const [hydrated, setHydrated] = useState(false)

  // Hydrate from localStorage on mount or when storageKey changes
  useEffect(() => {
    setHydrated(false)
    const currentCols = columnsRef.current
    const defaultOrder = currentCols.map((c) => c.key)
    const defaultVis = buildDefaultVisibility(currentCols)

    if (!storageKey) {
      setOrder(defaultOrder)
      setVisibility(defaultVis)
      setHydrated(true)
      return
    }

    try {
      const raw = window.localStorage.getItem(storageKey)
      if (raw) {
        const parsed = JSON.parse(raw) as {
          visibility?: Record<string, boolean>
          order?: string[]
        }

        const mergedVis = { ...defaultVis }
        if (parsed.visibility) {
          for (const col of currentCols) {
            if (typeof parsed.visibility[col.key] === "boolean") {
              mergedVis[col.key] = parsed.visibility[col.key]!
            }
          }
        }
        if (currentCols.length > 0 && !Object.values(mergedVis).some(Boolean)) {
          mergedVis[currentCols[0].key] = true
        }
        setVisibility(mergedVis)

        if (Array.isArray(parsed.order)) {
          const known = new Set(defaultOrder)
          const filtered = parsed.order.filter((k) => known.has(k))
          const missing = defaultOrder.filter((k) => !filtered.includes(k))
          setOrder([...filtered, ...missing])
        } else {
          setOrder(defaultOrder)
        }
      } else {
        setOrder(defaultOrder)
        setVisibility(defaultVis)
      }
    } catch {
      setOrder(defaultOrder)
      setVisibility(defaultVis)
    }

    setHydrated(true)
  }, [storageKey])

  // Reconcile order & visibility when dynamic columns are added or removed
  useEffect(() => {
    if (!hydrated) return
    const currentCols = columnsRef.current
    const validKeys = new Set(currentCols.map((c) => c.key))

    setOrder((prev) => {
      const filtered = prev.filter((k) => validKeys.has(k))
      const filteredSet = new Set(filtered)
      const added = currentCols.map((c) => c.key).filter((k) => !filteredSet.has(k))
      if (filtered.length === prev.length && added.length === 0) {
        return prev
      }
      return [...filtered, ...added]
    })

    setVisibility((prev) => {
      const next: Record<string, boolean> = {}
      let changed = Object.keys(prev).some((k) => !validKeys.has(k))

      for (const col of currentCols) {
        if (typeof prev[col.key] === "boolean") {
          next[col.key] = prev[col.key]!
        } else {
          next[col.key] = col.defaultVisible
          changed = true
        }
      }

      if (currentCols.length > 0 && !Object.values(next).some(Boolean)) {
        next[currentCols[0].key] = true
        changed = true
      }

      return changed ? next : prev
    })
  }, [columnsSignature, hydrated])

  // Persist changes to localStorage
  useEffect(() => {
    if (!hydrated || !storageKey) return
    try {
      window.localStorage.setItem(
        storageKey,
        JSON.stringify({ visibility, order }),
      )
    } catch {
      // Storage may be unavailable — fail silently
    }
  }, [storageKey, visibility, order, hydrated])

  const toggle = useCallback((key: string) => {
    setVisibility((prev) => {
      const next = { ...prev, [key]: !prev[key] }
      const anyVisible = Object.values(next).some(Boolean)
      return anyVisible ? next : prev
    })
  }, [])

  const reorder = useCallback((sourceKey: string, targetKey: string) => {
    if (sourceKey === targetKey) return
    setOrder((prev) => {
      const next = prev.filter((k) => k !== sourceKey)
      const targetIdx = next.indexOf(targetKey)
      if (targetIdx === -1) return prev
      next.splice(targetIdx, 0, sourceKey)
      return next
    })
  }, [])

  const reset = useCallback(() => {
    const currentCols = columnsRef.current
    setOrder(currentCols.map((c) => c.key))
    setVisibility(buildDefaultVisibility(currentCols))
  }, [])

  return { order, visibility, toggle, reorder, reset, hydrated }
}
