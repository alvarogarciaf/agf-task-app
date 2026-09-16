import type { Task } from "./types"

// Task IDs that are currently being created in a modal and should not be synced until committed
const heldBackTaskIds = new Set<string>()

// Task IDs that were discarded during creation and should not trigger task_delete
const discardedTaskIds = new Set<string>()

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
}

export function isHeldBack(taskId: string): boolean {
  return heldBackTaskIds.has(taskId)
}

export function discardHeldBackTask(taskId: string) {
  heldBackTaskIds.delete(taskId)
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
  if (syncTaskCallback) {
    await syncTaskCallback(taskId, true, finalTask)
  }
}
