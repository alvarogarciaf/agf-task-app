"use client";

import { useEffect, useRef, ReactNode } from "react";
import { collection, query, onSnapshot, doc, deleteDoc, setDoc, serverTimestamp, getDocs } from "firebase/firestore";
import { firestoreDb } from "@/lib/firebase/config";
import { useDatabase } from "@/components/db-provider";
import { useAuth } from "@/components/auth-provider";
import type { Task, Project } from "@/lib/types";
import { Subscription } from "rxjs";
import objectHash from "object-hash";

export interface SyncMessage {
  id: string;
  type: "task_upsert" | "task_delete" | "invite" | "invite_accepted" | "project_upsert" | "project_delete";
  fromUid: string;
  fromEmail?: string;
  task?: Partial<Task>;
  project?: Partial<Project>;
  timestamp?: any;
}

export function MessageSyncProvider({ children }: { children: ReactNode }) {
  const db = useDatabase();
  const { user } = useAuth();
  const uid = user?.uid;
  const lastProcessedTaskHash = useRef<Record<string, string>>({});
  const lastProcessedProjectHash = useRef<Record<string, string>>({});
  const notifiedTasksRef = useRef<Set<string>>(new Set());
  const failedTaskQueue = useRef<Set<string>>(new Set());
  const failedProjectQueue = useRef<Set<string>>(new Set());
  const retryTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Function to hash the shared portion of a task
  const getSharedTaskHash = (task: Partial<Task>) => {
    return objectHash({
      type: task.type,
      description: task.description,
      details: task.details,
      date_created: task.date_created,
      action_date: task.action_date,
      status: task.status,
      processed: task.processed,
      archived: task.archived,
      project_id: task.project_id,
    });
  };

  // Function to hash the shared portion of a project
  const getSharedProjectHash = (project: Partial<Project>) => {
    return objectHash({
      name: project.name,
      details: project.details,
      status: project.status,
      linked_person_id: project.linked_person_id,
      icon: project.icon,
      color: project.color,
      background_image: project.background_image,
    });
  };

  // 1. Process incoming messages
  useEffect(() => {
    if (!uid || !db) return;

    const messagesRef = collection(firestoreDb, `users/${uid}/messages`);
    const q = query(messagesRef);

    const unsubscribe = onSnapshot(
      q,
      async (snapshot) => {
        if (snapshot.empty) return;

        for (const change of snapshot.docChanges()) {
          if (change.type === "added") {
            const msg = { id: change.doc.id, ...change.doc.data() } as SyncMessage;

            try {
              if (msg.type === "invite_accepted" && msg.fromEmail && msg.fromUid) {
                // Find local person with this pending email
                const persons = await db.persons.find().exec();
                const target = persons.find(p => p.pending_invite_email === msg.fromEmail);
                if (target) {
                  await target.patch({
                    linked_uid: msg.fromUid,
                    linked_email: msg.fromEmail,
                    pending_invite_email: null
                  });
                  console.log(`[Sync] Linked person ${target.name} to ${msg.fromEmail}`);
                }
              } 
              else if (msg.type === "task_upsert" && msg.task && msg.task.id) {
                // Find local person mapped to this sender UID
                const allPersons = await db.persons.find().exec();
                const mappedPerson = allPersons.find(p => p.linked_uid === msg.fromUid);

                if (!mappedPerson) {
                  console.warn(`[Sync] Received task from unlinked user ${msg.fromUid}`);
                } else {
                  const existingTask = await db.tasks.findOne(msg.task.id).exec();
                  
                  // Track this hash so our outbound listener ignores it
                  const hash = getSharedTaskHash(msg.task);
                  lastProcessedTaskHash.current[msg.task.id] = hash;

                  // Non-shared task-project sync logic
                  const incomingProjId = msg.task.project_id ?? null;
                  let finalProjId = existingTask ? existingTask.project_id : null;

                  // Helper to check if a project is shared locally
                  const isProjectSharedLocally = async (projId: string | null | undefined) => {
                    if (!projId) return false;
                    const projDoc = await db.projects.findOne(projId).exec();
                    return projDoc && projDoc.linked_person_id !== null && projDoc.linked_person_id !== undefined;
                  };

                  const incomingIsShared = await isProjectSharedLocally(incomingProjId);
                  const currentIsShared = await isProjectSharedLocally(finalProjId);

                  if (incomingIsShared) {
                    // Rule 1: incoming project is shared -> assign it
                    finalProjId = incomingProjId;
                  } else if (currentIsShared) {
                    // Rule 2: incoming project is NOT shared, but current local is shared -> clear it
                    finalProjId = null;
                  }
                  // Rule 3: incoming is NOT shared, current is NOT shared -> keep finalProjId as is

                  if (existingTask) {
                    await existingTask.patch({
                      type: msg.task.type ?? existingTask.type ?? "task",
                      description: msg.task.description,
                      details: msg.task.details ?? existingTask.details ?? null,
                      date_created: msg.task.date_created,
                      action_date: msg.task.action_date ?? existingTask.action_date ?? null,
                      show_on: msg.task.show_on ?? existingTask.show_on ?? null,
                      status: msg.task.status ?? existingTask.status ?? "Open",
                      processed: msg.task.processed ?? existingTask.processed ?? false,
                      archived: msg.task.archived ?? existingTask.archived ?? false,
                      person_id: mappedPerson.id, // Ensure it's assigned to the linked person
                      project_id: finalProjId ?? null,
                    });
                  } else {
                    // Create new task with defaults for local-only fields
                    const defaultUrgency = await db.urgencies.findOne().exec();
                    await db.tasks.insert({
                      id: msg.task.id,
                      type: msg.task.type ?? "task",
                      description: msg.task.description!,
                      details: msg.task.details ?? null,
                      date_created: msg.task.date_created!,
                      action_date: msg.task.action_date ?? null,
                      show_on: msg.task.show_on ?? null,
                      status: (msg.task.status as any) ?? "Open",
                      processed: msg.task.processed ?? false,
                      archived: msg.task.archived ?? false,
                      urgency_id: defaultUrgency?.id || "u_medium",
                      context_ids: [],
                      tag_ids: [],
                      person_id: mappedPerson.id,
                      project_id: finalProjId ?? null,
                      google_event_id: null,
                      bookmarked: false,
                      order: msg.task.order ?? 0,
                    });
                  }
                }
              }
              else if (msg.type === "task_delete" && msg.task?.id) {
                const existingTask = await db.tasks.findOne(msg.task.id).exec();
                if (existingTask) {
                  lastProcessedTaskHash.current[msg.task.id] = "deleted";
                  await existingTask.remove();
                }
              }
              else if (msg.type === "project_upsert" && msg.project && msg.project.id) {
                const allPersons = await db.persons.find().exec();
                const mappedPerson = allPersons.find(p => p.linked_uid === msg.fromUid);

                if (!mappedPerson) {
                  console.warn(`[Sync] Received project from unlinked user ${msg.fromUid}`);
                } else {
                  const existingProj = await db.projects.findOne(msg.project.id).exec();
                  
                  // If it is unlinked, linked_person_id is null. Otherwise map it to mappedPerson.id
                  const incomingLinkedPersonId = msg.project.linked_person_id === null ? null : mappedPerson.id;

                  const localProjRepresent = {
                    name: msg.project.name!,
                    details: msg.project.details,
                    status: msg.project.status as any,
                    linked_person_id: incomingLinkedPersonId,
                    icon: msg.project.icon ?? null,
                    color: msg.project.color ?? null,
                    background_image: msg.project.background_image ?? null,
                  };

                  const hash = getSharedProjectHash(localProjRepresent);
                  lastProcessedProjectHash.current[msg.project.id] = hash;

                  if (existingProj) {
                    await existingProj.patch(localProjRepresent);
                    console.log(`[Sync] Patched project ${msg.project.id}`);
                  } else {
                    await db.projects.insert({
                      id: msg.project.id,
                      ...localProjRepresent,
                    });
                    console.log(`[Sync] Inserted project ${msg.project.id}`);
                  }
                }
              }
              else if (msg.type === "project_delete" && msg.project?.id) {
                const existingProj = await db.projects.findOne(msg.project.id).exec();
                if (existingProj) {
                  lastProcessedProjectHash.current[msg.project.id] = "deleted";
                  await existingProj.remove();
                  console.log(`[Sync] Deleted project ${msg.project.id}`);
                }
              }

              // Always delete the message after processing, EXCEPT invites. 
              // Invites are handled by the Inbox UI manually.
              if (msg.type !== "invite") {
                await deleteDoc(doc(firestoreDb, `users/${uid}/messages/${msg.id}`));
              }
            } catch (err) {
              console.error("[Sync] Error processing message", msg, err);
            }
          }
        }
      },
      (error) => {
        console.warn("[Sync] messages snapshot error (expected offline):", error);
      }
    );

    return () => unsubscribe();
  }, [uid, db]);

  // 2. Process outgoing changes and event-driven reconciliation
  useEffect(() => {
    if (!uid || !db) return;

    const sub = new Subscription();

    const scheduleRetry = () => {
      if (retryTimerRef.current) return;
      retryTimerRef.current = setTimeout(() => {
        retryTimerRef.current = null;
        void reconcileSharedState();
      }, 30_000); // 30 seconds debounce
    };

    // Reconciles all shared projects and tasks to ensure no gaps exist
    const reconcileSharedState = async () => {
      try {
        const allPersons = await db.persons.find().exec();
        const linkedPersons = allPersons.filter(p => p.linked_uid);
        if (linkedPersons.length === 0) return;

        const allProjects = await db.projects.find().exec();
        const sharedProjects = allProjects.filter(p => p.linked_person_id);

        // 1. Reconcile shared projects
        for (const proj of sharedProjects) {
          const person = linkedPersons.find(p => p.id === proj.linked_person_id);
          if (!person || !person.linked_uid) continue;

          const localProjRepresent = {
            name: proj.name,
            details: proj.details ?? null,
            status: proj.status,
            linked_person_id: proj.linked_person_id ? person.id : null,
            icon: proj.icon ?? null,
            color: proj.color ?? null,
            background_image: proj.background_image ?? null,
          };

          const newHash = getSharedProjectHash(localProjRepresent);
          if (lastProcessedProjectHash.current[proj.id] === newHash && !failedProjectQueue.current.has(proj.id)) {
            continue;
          }

          try {
            const msgRef = doc(collection(firestoreDb, `users/${person.linked_uid}/messages`));
            await setDoc(msgRef, {
              type: "project_upsert",
              fromUid: uid,
              project: {
                id: proj.id,
                ...localProjRepresent,
              },
              timestamp: serverTimestamp(),
            });
            lastProcessedProjectHash.current[proj.id] = newHash;
            failedProjectQueue.current.delete(proj.id);
          } catch (projErr) {
            console.warn("[Sync] Reconciliation failed for project, queuing retry:", proj.id, projErr);
            delete lastProcessedProjectHash.current[proj.id];
            failedProjectQueue.current.add(proj.id);
            scheduleRetry();
          }
        }

        // 2. Reconcile shared tasks / notes
        const allTasks = await db.tasks.find().exec();
        for (const taskDoc of allTasks) {
          const taskData = taskDoc.toJSON() as Task;

          // Auto-fix: task is in a shared project but lacks person_id
          if (taskData.project_id && !taskData.person_id) {
            const proj = sharedProjects.find(p => p.id === taskData.project_id);
            if (proj && proj.linked_person_id) {
              await taskDoc.patch({ person_id: proj.linked_person_id });
              continue; // Patching emits to db.tasks.$ which will send the task_upsert
            }
          }

          if (!taskData.person_id) continue;
          const person = linkedPersons.find(p => p.id === taskData.person_id);
          if (!person || !person.linked_uid) continue;

          const newHash = getSharedTaskHash(taskData);
          if (lastProcessedTaskHash.current[taskData.id] === newHash && !failedTaskQueue.current.has(taskData.id)) {
            continue;
          }

          try {
            const msgRef = doc(collection(firestoreDb, `users/${person.linked_uid}/messages`));
            await setDoc(msgRef, {
              type: "task_upsert",
              fromUid: uid,
              task: {
                id: taskData.id,
                type: taskData.type ?? "task",
                description: taskData.description,
                details: taskData.details ?? null,
                date_created: taskData.date_created,
                action_date: taskData.action_date ?? null,
                status: taskData.status ?? "Open",
                processed: taskData.processed ?? false,
                archived: taskData.archived ?? false,
                project_id: taskData.project_id ?? null,
              },
              timestamp: serverTimestamp(),
            });
            lastProcessedTaskHash.current[taskData.id] = newHash;
            failedTaskQueue.current.delete(taskData.id);
          } catch (taskErr) {
            console.warn("[Sync] Reconciliation failed for task, queuing retry:", taskData.id, taskErr);
            delete lastProcessedTaskHash.current[taskData.id];
            failedTaskQueue.current.add(taskData.id);
            scheduleRetry();
          }
        }
      } catch (err) {
        console.error("[Sync] Error during reconcileSharedState:", err);
      }
    };

    // Outgoing task changes
    sub.add(
      db.tasks.$.subscribe(async (changeEvent) => {
        const taskData = changeEvent.documentData as Task;
        const previousData = changeEvent.previousDocumentData as Task | undefined;
        
        // We only care if it's assigned to a linked person
        if (!taskData.person_id) return;
        
        try {
          const person = await db.persons.findOne(taskData.person_id).exec();
          if (!person || !person.linked_uid) return;

          const isDeleted = changeEvent.operation === "DELETE";

          if (isDeleted) {
            notifiedTasksRef.current.delete(taskData.id);
            if (lastProcessedTaskHash.current[taskData.id] === "deleted") {
              delete lastProcessedTaskHash.current[taskData.id];
              return;
            }

            try {
              const msgRef = doc(collection(firestoreDb, `users/${person.linked_uid}/messages`));
              await setDoc(msgRef, {
                type: "task_delete",
                fromUid: uid,
                task: { id: taskData.id },
                timestamp: serverTimestamp()
              });
              lastProcessedTaskHash.current[taskData.id] = "deleted";
              failedTaskQueue.current.delete(taskData.id);
            } catch (delErr) {
              console.warn("[Sync] Failed to send task_delete, queuing retry:", taskData.id, delErr);
              failedTaskQueue.current.add(taskData.id);
              scheduleRetry();
            }
            return;
          }

          const newHash = getSharedTaskHash(taskData);
          
          if (lastProcessedTaskHash.current[taskData.id] === newHash && !failedTaskQueue.current.has(taskData.id)) {
            return;
          }

          if (changeEvent.operation === "UPDATE" && previousData) {
            const oldHash = getSharedTaskHash(previousData);
            const personChanged = previousData.person_id !== taskData.person_id;
            if (oldHash === newHash && !personChanged && !failedTaskQueue.current.has(taskData.id)) return;
          }

          try {
            const msgRef = doc(collection(firestoreDb, `users/${person.linked_uid}/messages`));
            await setDoc(msgRef, {
              type: "task_upsert",
              fromUid: uid,
              task: {
                id: taskData.id,
                type: taskData.type ?? "task",
                description: taskData.description,
                details: taskData.details ?? null,
                date_created: taskData.date_created,
                action_date: taskData.action_date ?? null,
                status: taskData.status ?? "Open",
                processed: taskData.processed ?? false,
                archived: taskData.archived ?? false,
                project_id: taskData.project_id ?? null,
              },
              timestamp: serverTimestamp()
            });

            // Set hash ONLY after successful Firestore write
            lastProcessedTaskHash.current[taskData.id] = newHash;
            failedTaskQueue.current.delete(taskData.id);
          } catch (writeErr) {
            console.error("[Sync] Failed to send task_upsert, queuing retry:", taskData.id, writeErr);
            delete lastProcessedTaskHash.current[taskData.id];
            failedTaskQueue.current.add(taskData.id);
            scheduleRetry();
            return;
          }

          // ── Push notification logic ──
          const hasBeenNotified = notifiedTasksRef.current.has(taskData.id);
          const isPlaceholder = taskData.description === "New task" || taskData.description === "New note" || !taskData.description.trim();

          if (!hasBeenNotified && !isPlaceholder) {
            let shouldNotify = false;

            if (changeEvent.operation === "INSERT") {
              shouldNotify = true;
            } else if (changeEvent.operation === "UPDATE" && previousData) {
              const wasPlaceholder = previousData.description === "New task" || previousData.description === "New note" || !previousData.description.trim();
              const wasUnassigned = !previousData.person_id;
              if (wasPlaceholder || wasUnassigned) {
                shouldNotify = true;
              }
            }

            if (shouldNotify) {
              notifiedTasksRef.current.add(taskData.id);
              try {
                const subsRef = collection(firestoreDb, `users/${person.linked_uid}/push_subscriptions`);
                const subsSnap = await getDocs(subsRef);
                if (!subsSnap.empty) {
                  const subscriptions = subsSnap.docs.map((d) => d.data());
                  const senderName = user?.displayName || user?.email || "Someone";
                  const itemType = taskData.type === "note" ? "note" : "task";
                  fetch("/api/notifications/push", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      subscriptions,
                      title: `New ${itemType} added by ${senderName}`,
                      body: taskData.description || "",
                    }),
                  }).catch((e) => console.warn("[Sync] Push notification failed:", e));
                }
              } catch (pushErr) {
                console.warn("[Sync] Push notification error:", pushErr);
              }
            }
          }

        } catch (err) {
          console.error("[Sync] Outgoing sync error", err);
        }
      })
    );

    // Outgoing project changes
    sub.add(
      db.projects.$.subscribe(async (changeEvent) => {
        const projectData = changeEvent.documentData as Project;
        const previousData = changeEvent.previousDocumentData as Project | undefined;

        // We care if it is shared (has linked_person_id) OR if it was previously shared and is now unlinked
        const isShared = !!projectData.linked_person_id;
        const wasShared = !!previousData?.linked_person_id;

        if (!isShared && !wasShared) return;

        const targetPersonId = projectData.linked_person_id || previousData?.linked_person_id;
        if (!targetPersonId) return;

        try {
          const person = await db.persons.findOne(targetPersonId).exec();
          if (!person || !person.linked_uid) return;

          const isDeleted = changeEvent.operation === "DELETE";

          if (isDeleted) {
            if (lastProcessedProjectHash.current[projectData.id] === "deleted") {
              delete lastProcessedProjectHash.current[projectData.id];
              return;
            }

            try {
              const msgRef = doc(collection(firestoreDb, `users/${person.linked_uid}/messages`));
              await setDoc(msgRef, {
                type: "project_delete",
                fromUid: uid,
                project: { id: projectData.id },
                timestamp: serverTimestamp()
              });
              lastProcessedProjectHash.current[projectData.id] = "deleted";
              failedProjectQueue.current.delete(projectData.id);
            } catch (delErr) {
              console.warn("[Sync] Failed to send project_delete, queuing retry:", projectData.id, delErr);
              failedProjectQueue.current.add(projectData.id);
              scheduleRetry();
            }
            return;
          }

          const newHash = getSharedProjectHash(projectData);

          if (lastProcessedProjectHash.current[projectData.id] === newHash && !failedProjectQueue.current.has(projectData.id)) {
            return;
          }

          if (changeEvent.operation === "UPDATE" && previousData) {
            const oldHash = getSharedProjectHash(previousData);
            if (oldHash === newHash && !failedProjectQueue.current.has(projectData.id)) return;
          }

          try {
            const msgRef = doc(collection(firestoreDb, `users/${person.linked_uid}/messages`));
            await setDoc(msgRef, {
              type: "project_upsert",
              fromUid: uid,
              project: {
                id: projectData.id,
                name: projectData.name,
                details: projectData.details ?? null,
                status: projectData.status,
                linked_person_id: projectData.linked_person_id ? person.id : null,
                icon: projectData.icon ?? null,
                color: projectData.color ?? null,
                background_image: projectData.background_image ?? null,
              },
              timestamp: serverTimestamp()
            });

            // Set hash ONLY after successful Firestore write
            lastProcessedProjectHash.current[projectData.id] = newHash;
            failedProjectQueue.current.delete(projectData.id);
          } catch (writeErr) {
            console.error("[Sync] Failed to send project_upsert, queuing retry:", projectData.id, writeErr);
            delete lastProcessedProjectHash.current[projectData.id];
            failedProjectQueue.current.add(projectData.id);
            scheduleRetry();
          }

        } catch (err) {
          console.error("[Sync] Outgoing project sync error", err);
        }
      })
    );

    // Event-driven triggers for reconciliation:
    // 1. Initial catch-up on mount (catches race conditions where tasks were inserted before subscription)
    void reconcileSharedState();

    // 2. Visibility change: catch up when user resumes the app from background
    const handleVisibilityChange = () => {
      if (typeof document !== "undefined" && document.visibilityState === "visible") {
        void reconcileSharedState();
      }
    };
    if (typeof document !== "undefined") {
      document.addEventListener("visibilitychange", handleVisibilityChange);
    }

    // 3. Online event: catch up when network connection is restored
    const handleOnline = () => {
      void reconcileSharedState();
    };
    if (typeof window !== "undefined") {
      window.addEventListener("online", handleOnline);
    }

    return () => {
      sub.unsubscribe();
      if (typeof document !== "undefined") {
        document.removeEventListener("visibilitychange", handleVisibilityChange);
      }
      if (typeof window !== "undefined") {
        window.removeEventListener("online", handleOnline);
      }
      if (retryTimerRef.current) {
        clearTimeout(retryTimerRef.current);
        retryTimerRef.current = null;
      }
    };
  }, [uid, db]);

  return <>{children}</>;
}
