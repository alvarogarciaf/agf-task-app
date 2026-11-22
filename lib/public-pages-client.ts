"use client"

import { toast } from "sonner"
import { auth } from "@/lib/firebase/config"
import type { Task } from "@/lib/types"

export function buildPublicPageUrl(publicId: string): string {
  return `${window.location.origin}/p/${encodeURIComponent(publicId)}`
}

export function buildAppObjectUrl(
  task: Pick<Task, "id" | "description" | "type">,
): string {
  const title =
    (task.description || "").trim() ||
    (task.type === "note" ? "Note" : "Task")
  const params = new URLSearchParams()
  params.set("objectId", task.id)
  params.set("title", title)
  params.set("_t", Date.now().toString(36))
  return `${window.location.origin}/?${params.toString()}`
}

export async function copyTextToClipboard(text: string): Promise<boolean> {
  try {
    if (navigator?.clipboard?.writeText) {
      await navigator.clipboard.writeText(text)
      return true
    }
    const textArea = document.createElement("textarea")
    textArea.value = text
    textArea.style.position = "fixed"
    textArea.style.opacity = "0"
    document.body.appendChild(textArea)
    textArea.focus()
    textArea.select()
    const copied = document.execCommand("copy")
    document.body.removeChild(textArea)
    return copied
  } catch {
    return false
  }
}

export async function shareTaskLink(
  task: Pick<Task, "id" | "description" | "type" | "is_public" | "public_id">,
  opts?: { isMobile?: boolean; forceAppLink?: boolean },
): Promise<void> {
  if (!task?.id) return
  const title =
    (task.description || "").trim() ||
    (task.type === "note" ? "Note" : "Task")
  const usePublic = !opts?.forceAppLink && !!task.is_public && !!task.public_id
  const url = usePublic
    ? buildPublicPageUrl(task.public_id!)
    : buildAppObjectUrl(task)

  if (opts?.isMobile && typeof navigator !== "undefined" && navigator.share) {
    try {
      await navigator.share({ title, url })
      return
    } catch (err: any) {
      if (err?.name === "AbortError") return
    }
  }

  const copied = await copyTextToClipboard(url)
  if (copied) {
    toast.success(
      usePublic ? "Public link copied to clipboard" : "Link copied to clipboard",
    )
  } else {
    toast.error("Could not copy link")
  }
}

export async function syncPublicPageSetting(
  taskId: string,
  isPublic: boolean,
  publicId?: string | null,
): Promise<{ isPublic: boolean; publicId: string | null }> {
  await auth.authStateReady()
  const user = auth.currentUser
  if (!user) {
    throw new Error("Must be signed in to update public page settings")
  }
  const token = await user.getIdToken()

  const res = await fetch("/api/public", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      taskId,
      isPublic,
      publicId: publicId ?? null,
    }),
  })

  if (!res.ok) {
    const errText = await res.text().catch(() => "")
    throw new Error(errText || `Request failed with status ${res.status}`)
  }

  const data = await res.json()
  return {
    isPublic: !!data.isPublic,
    publicId: typeof data.publicId === "string" ? data.publicId : null,
  }
}

export async function unpublishPublicPageQuietly(
  taskId: string,
  publicId?: string | null,
): Promise<void> {
  try {
    await syncPublicPageSetting(taskId, false, publicId)
  } catch {
    // Ignore transient offline/auth failures during quiet unpublish
  }
}
