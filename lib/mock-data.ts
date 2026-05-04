import type { Task, Project, Person, Context, UrgencyLevel } from "./types"

export const urgencies: UrgencyLevel[] = [
  { id: "u_highest", name: "Highest", color: "oklch(0.6 0.25 25)", order: 0 },
  { id: "u_high", name: "High", color: "oklch(0.65 0.2 40)", order: 1 },
  { id: "u_medium", name: "Medium", color: "oklch(0.7 0.15 250)", order: 2 },
  { id: "u_low", name: "Low", color: "oklch(0.8 0 0)", order: 3 },
];

export const projects: Project[] = [
  {
    id: "p_velocity",
    name: "Velocity v2 launch",
    status: "Ongoing",
    details:
      "Ship the next major version with conflict-free replication, multi-device sync, and PWA install flow.",
  },
  {
    id: "p_research",
    name: "Local-first research",
    status: "Ongoing",
    details: "Catalogue prior art on CRDTs, Yjs, RxDB, and Automerge.",
  },
  {
    id: "p_marketing",
    name: "Q3 marketing site",
    status: "Ongoing",
    details: "Rebuild marketing site with new positioning around offline speed.",
  },
  {
    id: "p_house",
    name: "House move",
    status: "Ongoing",
    details: "Coordinate movers, utilities, and final walkthrough.",
  },
  {
    id: "p_taxes",
    name: "2025 taxes",
    status: "Closed",
    details: "Filed and accepted. Archive receipts.",
  },
]

export const persons: Person[] = [
  { id: "u_anna", name: "Anna Park", initials: "AP", color: "oklch(0.62 0.2 258)" },
  { id: "u_marco", name: "Marco Reyes", initials: "MR", color: "oklch(0.72 0.15 220)" },
  { id: "u_priya", name: "Priya Shah", initials: "PS", color: "oklch(0.78 0.16 75)" },
  { id: "u_jules", name: "Jules Tan", initials: "JT", color: "oklch(0.55 0.18 280)" },
  { id: "u_sam", name: "Sam Okafor", initials: "SO", color: "oklch(0.6 0.18 145)" },
  { id: "u_lin", name: "Lin Wei", initials: "LW", color: "oklch(0.7 0.15 30)" },
]

export const contexts: Context[] = [
  { id: "c_deep", name: "Deep Work", icon: "Brain", color: "oklch(0.62 0.2 258)" },
  { id: "c_calls", name: "Calls", icon: "Phone", color: "oklch(0.72 0.15 220)" },
  { id: "c_errands", name: "Errands", icon: "ShoppingBag", color: "oklch(0.78 0.16 75)" },
  { id: "c_home", name: "Home", icon: "Home", color: "oklch(0.6 0.18 145)" },
  { id: "c_review", name: "Review", icon: "Eye", color: "oklch(0.55 0.18 280)" },
  { id: "c_writing", name: "Writing", icon: "PenLine", color: "oklch(0.7 0.15 30)" },
  { id: "c_offline", name: "Offline", icon: "WifiOff", color: "oklch(0.5 0.02 260)" },
  { id: "c_quick", name: "Quick wins", icon: "Zap", color: "oklch(0.78 0.16 75)" },
]

const today = new Date()
function daysAgo(n: number) {
  const d = new Date(today)
  d.setDate(d.getDate() - n)
  return d.toISOString()
}
function daysFromNow(n: number) {
  const d = new Date(today)
  d.setDate(d.getDate() + n)
  return d.toISOString().slice(0, 10)
}

const tasksSeed: Omit<Task, "status">[] = [
  {
    id: "t_001",
    description: "Replace Firestore push adapter with delta-based sync",
    details:
      "Investigate moving from full-document writes to delta payloads. Should reduce write count by ~60% on the Spark plan.",
    date_created: daysAgo(0),
    project_id: "p_velocity",
    person_id: "u_marco",
    context_ids: ["c_deep"],
    processed: false,
    urgency_id: "u_highest",
  },
  {
    id: "t_002",
    description: "Draft positioning doc: 'Notion is slow, we are not'",
    date_created: daysAgo(0),
    project_id: "p_marketing",
    context_ids: ["c_writing"],
    processed: false,
    urgency_id: "u_high",
  },
  {
    id: "t_003",
    description: "Call landlord about lease renewal options",
    date_created: daysAgo(1),
    project_id: "p_house",
    person_id: "u_lin",
    context_ids: ["c_calls"],
    processed: false,
    urgency_id: "u_medium",
  },
  {
    id: "t_004",
    description: "Review pull request #482: conflict resolution strategy",
    details: "Anna proposed last-write-wins for `description` and three-way merge for `details`.",
    date_created: daysAgo(1),
    project_id: "p_velocity",
    person_id: "u_anna",
    context_ids: ["c_review", "c_deep"],
    processed: true,
    urgency_id: "u_high",
  },
  {
    id: "t_005",
    description: "Read Martin Kleppmann's local-first paper, take notes",
    date_created: daysAgo(2),
    project_id: "p_research",
    context_ids: ["c_deep", "c_writing"],
    processed: true,
    urgency_id: "u_medium",
  },
  {
    id: "t_006",
    description: "Pick up keys from new apartment",
    date_created: daysAgo(2),
    show_on: daysFromNow(3),
    action_date: daysFromNow(3),
    project_id: "p_house",
    context_ids: ["c_errands"],
    processed: true,
    urgency_id: "u_high",
  },
  {
    id: "t_007",
    description: "Outline service worker upgrade flow for PWA",
    date_created: daysAgo(3),
    project_id: "p_velocity",
    person_id: "u_priya",
    context_ids: ["c_deep"],
    processed: true,
    urgency_id: "u_medium",
  },
  {
    id: "t_008",
    description: "Cancel old electricity account",
    date_created: daysAgo(3),
    project_id: "p_house",
    context_ids: ["c_calls", "c_quick"],
    processed: true,
    urgency_id: "u_low",
  },
  {
    id: "t_009",
    description: "Collect testimonials from beta users",
    date_created: daysAgo(4),
    project_id: "p_marketing",
    person_id: "u_jules",
    context_ids: ["c_writing"],
    processed: true,
    urgency_id: "u_medium",
  },
  {
    id: "t_010",
    description: "Book dentist for Q3 cleaning",
    date_created: daysAgo(5),
    context_ids: ["c_calls", "c_quick"],
    processed: true,
    urgency_id: "u_low",
  },
  {
    id: "t_011",
    description: "Audit IndexedDB schema migrations for v1 → v2",
    date_created: daysAgo(5),
    project_id: "p_velocity",
    person_id: "u_sam",
    context_ids: ["c_deep", "c_review"],
    processed: true,
    urgency_id: "u_high",
  },
  {
    id: "t_012",
    description: "Write blog post: 'Why we chose RxDB over Yjs'",
    date_created: daysAgo(6),
    project_id: "p_marketing",
    context_ids: ["c_writing"],
    processed: false,
    urgency_id: "u_medium",
  },
  {
    id: "t_013",
    description: "Forward archived 2024 receipts to accountant",
    date_created: daysAgo(60),
    project_id: "p_taxes",
    context_ids: ["c_quick"],
    processed: true,
    urgency_id: "u_low",
  },
  {
    id: "t_014",
    description: "Sketch onboarding empty states for first-run",
    date_created: daysAgo(7),
    project_id: "p_velocity",
    person_id: "u_jules",
    context_ids: ["c_deep"],
    processed: true,
    urgency_id: "u_medium",
  },
  {
    id: "t_015",
    description: "Order packing boxes",
    date_created: daysAgo(0),
    project_id: "p_house",
    context_ids: ["c_errands", "c_quick"],
    processed: false,
    urgency_id: "u_low",
  },
]

export const tasks: Task[] = tasksSeed.map((t) => ({
  ...t,
  status: "Open" as const,
}))
