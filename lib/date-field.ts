/** Shared date helpers for date inputs in the tasks table and task edit form. */

/** Extract the YYYY-MM-DD portion of an ISO string for a native date input. */
export function isoToDateInputValue(iso?: string | null): string {
  if (!iso) return ""
  return iso.split("T")[0]
}

/** Convert a native date input value (YYYY-MM-DD) to a UTC-midnight ISO string. */
export function dateInputToIso(value: string): string | null {
  if (!value) return null
  return new Date(value + "T00:00:00.000Z").toISOString()
}

/** Format an ISO string for display (e.g. "May 24"), avoiding timezone shifts. */
export function formatDateLabel(iso?: string | null): string {
  if (!iso) return ""
  const match = iso.match(/^(\d{4})-(\d{2})-(\d{2})/)
  const d = match
    ? new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]))
    : new Date(iso)
  if (Number.isNaN(d.getTime())) return ""
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" })
}
