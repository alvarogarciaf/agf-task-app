export interface SeedUrgency {
  id: string;
  name: string;
  color: string;
  order: number;
}

export interface SeedContext {
  id: string;
  name: string;
  icon: string;
  color: string;
  order: number;
}

export interface SeedProject {
  id: string;
  name: string;
  status: "Ongoing" | "Closed";
  order_dependent: boolean;
  order: number;
  default_context_ids: string[];
}

export interface SeedTag {
  id: string;
  name: string;
  icon: string;
  color: string;
}

export interface SeedTask {
  id: string;
  type: "task" | "note";
  description: string;
  details: string;
  date_created: string;
  context_ids: string[];
  tag_ids: string[];
  processed: boolean;
  status: "Open" | "Done";
  urgency_id: string;
  archived: boolean;
  bookmarked: boolean;
  order: number;
}

export const SEED_URGENCIES: SeedUrgency[] = [
  { id: "u_top", name: "TOP", color: "oklch(0.5 0.25 10)", order: 0 },
  { id: "u_highest", name: "Highest", color: "oklch(0.6 0.25 25)", order: 1 },
  { id: "u_high", name: "High", color: "oklch(0.65 0.2 40)", order: 2 },
  { id: "u_medium", name: "Medium", color: "oklch(0.7 0.15 250)", order: 3 },
  { id: "u_low", name: "Low", color: "oklch(0.8 0 0)", order: 4 },
];

export const SEED_CONTEXTS: SeedContext[] = [
  { id: "c_home", name: "Home", icon: "Home", color: "#eab308", order: 0 },
  { id: "c_errands", name: "Errands", icon: "Car", color: "#22c55e", order: 1 },
  { id: "c_work", name: "Work", icon: "Briefcase", color: "#ef4444", order: 2 },
];

export const SEED_PROJECTS: SeedProject[] = [
  {
    id: "p_first",
    name: "My First Project",
    status: "Ongoing",
    order_dependent: false,
    order: 0,
    default_context_ids: [],
  },
];

export const SEED_TAGS: SeedTag[] = [
  { id: "tag_meeting_notes", name: "Meeting notes", icon: "NotebookPen", color: "#3b82f6" },
  { id: "tag_health", name: "Health", icon: "HeartPulse", color: "#ec4899" },
];

export function buildSeedTasks(nowIso: string): SeedTask[] {
  return [
    {
      id: "t_sample",
      type: "task",
      description: "This is a sample task",
      details:
        "Click to open it. Add a context or project, then tick the circle to mark it processed. Delete me when you're done!",
      date_created: nowIso,
      context_ids: [],
      tag_ids: [],
      processed: false,
      status: "Open",
      urgency_id: "u_medium",
      archived: false,
      bookmarked: false,
      order: 0,
    },
  ];
}
