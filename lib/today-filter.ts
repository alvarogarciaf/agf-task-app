import { useState, useEffect } from "react"

export type TodaySectionFilterMode = "today_only" | "today_and_overdue"

const STORAGE_KEY = "today_section_filter"
const EVENT_NAME = "today-section-filter-changed"

export function getTodaySectionFilter(): TodaySectionFilterMode {
  if (typeof window === "undefined") return "today_only"
  return (localStorage.getItem(STORAGE_KEY) as TodaySectionFilterMode) || "today_only"
}

export function setTodaySectionFilter(mode: TodaySectionFilterMode): void {
  if (typeof window === "undefined") return
  localStorage.setItem(STORAGE_KEY, mode)
  window.dispatchEvent(new Event(EVENT_NAME))
}

export function useTodaySectionFilter(): TodaySectionFilterMode {
  const [mode, setMode] = useState<TodaySectionFilterMode>(getTodaySectionFilter)

  useEffect(() => {
    const handleChange = () => {
      setMode(getTodaySectionFilter())
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

export function isTaskForTodaySection(
  task: { status: string; action_date?: string | null },
  filter: TodaySectionFilterMode,
  todayStr = new Date().toLocaleDateString("en-CA")
): boolean {
  if (task.status === "Done" || !task.action_date) return false
  const taskDateStr = task.action_date.slice(0, 10)
  if (filter === "today_and_overdue") {
    return taskDateStr <= todayStr
  }
  return taskDateStr === todayStr
}
