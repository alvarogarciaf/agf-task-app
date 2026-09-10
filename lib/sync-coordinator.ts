import type { Task } from "./types"

// Task IDs that are currently being created in a modal and should not be synced until committed
const heldBackTaskIds = new Set<string>()

// Task IDs that were discarded during creation and should not trigger task_delete
const discardedTaskIds = new Set<string>()

// Task IDs that are actively being edited in TaskDetailDialog
const activeEditingTaskIds = new Set<string>()

// Syncer callback registered by MessageSyncProvider
type SyncerFn = (taskId: string, isFromCreation?: boolean, taskOverride?: Task) => Promise<void>
let syncTaskCallback: SyncerFn | null = null

export function registerTaskSyncer(fn: SyncerFn) {
  syncTaskCallback = fn
}

export function unregisterTaskSyncer() {
  syncTaskCallback = null
}

export function holdBackTask(taskId: string) {
  heldBackTaskIds.add(taskId)
  activeEditingTaskIds.add(taskId)
}

export function isHeldBack(taskId: string): boolean {
  return heldBackTaskIds.has(taskId)
}

export function discardHeldBackTask(taskId: string) {
  heldBackTaskIds.delete(taskId)
  activeEditingTaskIds.delete(taskId)
  discardedTaskIds.add(taskId)
  // Clean up discarded ID after 60s
  setTimeout(() => {
    discardedTaskIds.delete(taskId)
  }, 60000)
}

export function isDiscarded(taskId: string): boolean {
  return discardedTaskIds.has(taskId)
}

export async function commitHeldBackTask(taskId: string, finalTask?: Task) {
  heldBackTaskIds.delete(taskId)
  activeEditingTaskIds.delete(taskId)
  if (syncTaskCallback) {
    await syncTaskCallback(taskId, true, finalTask)
  }
}

export function startEditingTask(taskId: string) {
  activeEditingTaskIds.add(taskId)
}

export function isEditingTask(taskId: string): boolean {
  return activeEditingTaskIds.has(taskId)
}

export async function finishEditingTask(taskId: string, finalTask?: Task) {
  activeEditingTaskIds.delete(taskId)
  if (syncTaskCallback) {
    await syncTaskCallback(taskId, false, finalTask)
  }
}
