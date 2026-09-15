import type { Task, Project, Person, Context, UrgencyLevel } from "./types"

export const urgencies: UrgencyLevel[] = [
  { id: "u_highest", name: "Highest", color: "oklch(0.6 0.25 25)", order: 0 },
  { id: "u_high", name: "High", color: "oklch(0.65 0.2 40)", order: 1 },
  { id: "u_medium", name: "Medium", color: "oklch(0.7 0.15 250)", order: 2 },
  { id: "u_low", name: "Low", color: "oklch(0.8 0 0)", order: 3 },
];

export const projects: Project[] = []

export const persons: Person[] = [
  { id: "u_anna", name: "Anna Park", initials: "AP", color: "oklch(0.62 0.2 258)" },
  { id: "u_marco", name: "Marco Reyes", initials: "MR", color: "oklch(0.72 0.15 220)" },
  { id: "u_priya", name: "Priya Shah", initials: "PS", color: "oklch(0.78 0.16 75)" },
  { id: "u_jules", name: "Jules Tan", initials: "JT", color: "oklch(0.55 0.18 280)" },
  { id: "u_sam", name: "Sam Okafor", initials: "SO", color: "oklch(0.6 0.18 145)" },
  { id: "u_lin", name: "Lin Wei", initials: "LW", color: "oklch(0.7 0.15 30)" },
]

export const contexts: Context[] = [
  { id: "c_home", name: "Home", icon: "Home", color: "#eab308" },
  { id: "c_errands", name: "Errands", icon: "Car", color: "#22c55e" },
  { id: "c_work", name: "Work", icon: "Briefcase", color: "#ef4444" },
]

export const tasks: Task[] = []
