const MONTH_NAMES = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"
];

/**
 * Formats a date to "DD-MMM-YYYY" format (e.g. 14-Sep-2026).
 */
export function formatDateDDMMMYYYY(dateInput: string | number | Date | null | undefined): string {
  if (!dateInput) return "-";
  const date = new Date(dateInput);
  if (isNaN(date.getTime())) return "-";

  const day = String(date.getDate()).padStart(2, "0");
  const month = MONTH_NAMES[date.getMonth()];
  const year = date.getFullYear();

  return `${day}-${month}-${year}`;
}

/**
 * Formats last sign in date:
 * - If less than a week (0 to 6 days), shows the number of days (e.g. "Today" or "X days ago").
 * - If 7 or more days, returns "DD-MMM-YYYY".
 * - If null or invalid, returns "Never".
 */
export function formatLastSignIn(dateInput: string | number | Date | null | undefined): string {
  if (!dateInput) return "Never";
  const date = new Date(dateInput);
  if (isNaN(date.getTime())) return "Never";

  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfSignDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const diffTime = startOfToday.getTime() - startOfSignDate.getTime();
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays <= 0) {
    return "Today";
  }

  if (diffDays < 7) {
    if (diffDays === 1) return "1 day ago";
    return `${diffDays} days ago`;
  }

  return formatDateDDMMMYYYY(date);
}
