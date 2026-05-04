import type { Task } from "@/lib/types"

/** Local calendar date as YYYY-MM-DD for the given instant. */
export function localDateKey(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  return `${y}-${m}-${day}`
}

/** Calendar day of the task's Show on value in local time, or null if unset / invalid. */
export function taskShowOnLocalKey(task: Task): string | null {
  if (task.show_on == null || String(task.show_on).trim() === "") return null
  const d = new Date(task.show_on)
  if (Number.isNaN(d.getTime())) return null
  return localDateKey(d)
}

/** Default list: no Show on, or Show on is today or in the past (local calendar). */
export function isTaskVisibleByShowOnRule(task: Task): boolean {
  const key = taskShowOnLocalKey(task)
  if (key == null) return true
  return key <= localDateKey(new Date())
}

/** Tasks hidden from the default list because Show on is strictly after today. */
export function isTaskHiddenOnlyByShowOn(task: Task): boolean {
  const key = taskShowOnLocalKey(task)
  if (key == null) return false
  return key > localDateKey(new Date())
}
