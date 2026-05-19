"use client"

import { useEffect, useState } from "react"
import { Inbox as InboxIcon, Sparkles, ArrowRight, UserPlus, Check, X } from "lucide-react"
import { FilteredTasks } from "@/components/filtered-tasks"
import { useAuth } from "@/components/auth-provider"
import { firestoreDb } from "@/lib/firebase/config"
import { collection, query, where, onSnapshot, doc, deleteDoc, setDoc, serverTimestamp } from "firebase/firestore"
import type { Context, Person, Project, Task, UrgencyLevel } from "@/lib/types"

interface InboxViewProps {
  tasks: Task[]
  projects: Project[]
  persons: Person[]
  contexts: Context[]
  urgencies: UrgencyLevel[]
  onToggleProcessed: (id: string) => void
  onToggleStatus: (id: string) => void
  onUpdate: (task: Task) => void
  onCreate?: (input: {
    description: string
    contextIds: string[]
    projectId: string | null
    personId: string | null
    processed: boolean
  }) => Promise<string | void>
  onAddPerson?: (person: Omit<Person, "id">) => Promise<void>
}

export function InboxView({
  tasks,
  projects,
  persons,
  contexts,
  urgencies,
  onToggleProcessed,
  onToggleStatus,
  onUpdate,
  onCreate,
  onAddPerson,
}: InboxViewProps) {
  const { user } = useAuth()
  const [invites, setInvites] = useState<any[]>([])
  const inbox = tasks  // Already filtered to !processed && !archived by RxDB query

  useEffect(() => {
    if (!user?.uid) return
    const q = query(
      collection(firestoreDb, `users/${user.uid}/messages`),
      where("type", "==", "invite")
    )
    const unsub = onSnapshot(q, (snap) => {
      setInvites(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    })
    return () => unsub()
  }, [user?.uid])

  const acceptInvite = async (invite: any) => {
    if (!user?.uid || !onAddPerson) return
    try {
      // 1. Create the new linked person locally
      const senderName = invite.fromEmail.split('@')[0]
      await onAddPerson({
        name: senderName,
        initials: senderName.substring(0, 2).toUpperCase(),
        color: "#3b82f6",
        linked_uid: invite.fromUid,
        pending_invite_email: null,
      })
      
      // 2. Send acceptance message
      await setDoc(doc(collection(firestoreDb, `users/${invite.fromUid}/messages`)), {
        type: "invite_accepted",
        fromUid: user.uid,
        fromEmail: user.email,
        timestamp: serverTimestamp()
      })
      
      // 3. Delete the invite message
      await deleteDoc(doc(firestoreDb, `users/${user.uid}/messages/${invite.id}`))
    } catch (e) {
      console.error("Failed to accept invite", e)
    }
  }

  const declineInvite = async (inviteId: string) => {
    if (!user?.uid) return
    try {
      await deleteDoc(doc(firestoreDb, `users/${user.uid}/messages/${inviteId}`))
    } catch (e) {
      console.error("Failed to decline invite", e)
    }
  }

  if (inbox.length === 0 && invites.length === 0) {
    return (
      <div className="px-6 py-12">
        <div className="mx-auto flex max-w-md flex-col items-center rounded-lg border border-dashed border-border bg-card px-8 py-12 text-center">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Sparkles className="h-5 w-5" />
          </div>
          <h2 className="mt-4 text-base font-semibold">Inbox zero</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Nothing to triage. Everything you&apos;ve captured has been processed.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="px-6 py-6">
      {/* Pending Invites */}
      {invites.length > 0 && (
        <div className="mb-6 space-y-2">
          {invites.map((inv) => (
            <div key={inv.id} className="flex items-center justify-between gap-3 rounded-lg border border-primary/20 bg-primary/5 px-4 py-3">
              <div className="flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary/20 text-primary">
                  <UserPlus className="h-4 w-4" />
                </div>
                <div>
                  <div className="text-sm font-medium">Link Request</div>
                  <div className="text-xs text-muted-foreground">
                    <strong className="text-foreground">{inv.fromEmail}</strong> wants to link accounts.
                  </div>
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => declineInvite(inv.id)}
                  className="rounded-md border border-border bg-background px-3 py-1.5 text-xs text-muted-foreground hover:bg-muted"
                >
                  Decline
                </button>
                <button
                  type="button"
                  onClick={() => acceptInvite(inv)}
                  className="inline-flex items-center gap-1 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90"
                >
                  <Check className="h-3.5 w-3.5" />
                  Accept
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="mb-4 flex items-center justify-between gap-3 rounded-lg border border-border bg-card px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary/15 text-primary">
            <InboxIcon className="h-4 w-4" />
          </div>
          <div>
            <div className="text-sm font-medium">{inbox.length} items to triage</div>
            <div className="text-xs text-muted-foreground">
              Click a row to edit, or toggle the circle to mark as processed.
            </div>
          </div>
        </div>
        <button
          type="button"
          className="inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-3 py-1.5 text-xs hover:bg-muted"
        >
          Process all
          <ArrowRight className="h-3 w-3" />
        </button>
      </div>

      <div className="h-[calc(100vh-200px)] -mx-6">
        <FilteredTasks
          tasks={inbox}
          projects={projects}
          persons={persons}
          contexts={contexts}
          urgencies={urgencies}
          onToggleProcessed={onToggleProcessed}
          onToggleStatus={onToggleStatus}
          onUpdate={onUpdate}
          itemNoun="item"
          emptyTitle="Inbox zero"
          emptyHint="Nothing to triage right now."
          hideFilters={["status"]}
          inboxMode={true}
          onCreate={onCreate}
        />
      </div>
    </div>
  )
}
