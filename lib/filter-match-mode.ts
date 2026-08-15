import { useState, useEffect } from "react"

export type FilterMatchMode = "and" | "or"

const STORAGE_KEY = "default_filter_match_mode"
const EVENT_NAME = "default-filter-match-mode-changed"

export function getDefaultFilterMatchMode(): FilterMatchMode {
  if (typeof window === "undefined") return "and"
  return (localStorage.getItem(STORAGE_KEY) as FilterMatchMode) || "and"
}

export function setDefaultFilterMatchMode(mode: FilterMatchMode): void {
  if (typeof window === "undefined") return
  localStorage.setItem(STORAGE_KEY, mode)
  window.dispatchEvent(new Event(EVENT_NAME))
}

export function useDefaultFilterMatchMode(): FilterMatchMode {
  const [mode, setMode] = useState<FilterMatchMode>(getDefaultFilterMatchMode)

  useEffect(() => {
    const handleChange = () => {
      setMode(getDefaultFilterMatchMode())
    }
    window.addEventListener(EVENT_NAME, handleChange)
    window.addEventListener("storage", handleChange)
    return () => {
      window.removeEventListener(EVENT_NAME, handleChange)
      window.removeEventListener("storage", handleChange)
    }
  }, [])

  return mode
}
