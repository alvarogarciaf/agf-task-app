"use client"

import { useEffect, useState } from "react"

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
