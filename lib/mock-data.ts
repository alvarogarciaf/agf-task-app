import type { Task, Project, Person, Context, UrgencyLevel } from "./types"

export const urgencies: UrgencyLevel[] = [
  { id: "u_top", name: "TOP", color: "oklch(0.5 0.25 10)", order: 0 },
  { id: "u_highest", name: "Highest", color: "oklch(0.6 0.25 25)", order: 1 },
  { id: "u_high", name: "High", color: "oklch(0.65 0.2 40)", order: 2 },
  { id: "u_medium", name: "Medium", color: "oklch(0.7 0.15 250)", order: 3 },
  { id: "u_low", name: "Low", color: "oklch(0.8 0 0)", order: 4 },
];

export const projects: Project[] = [
  { id: "p_first", name: "My First Project", status: "Ongoing", order_dependent: false, order: 0 }
]

export const persons: Person[] = []

export const contexts: Context[] = [
  { id: "c_home", name: "Home", icon: "Home", color: "#eab308" },
  { id: "c_errands", name: "Errands", icon: "Car", color: "#22c55e" },
  { id: "c_work", name: "Work", icon: "Briefcase", color: "#ef4444" },
]

export const tasks: Task[] = []
