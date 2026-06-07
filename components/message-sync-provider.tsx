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

  // Function to hash the shared portion of a task
  const getSharedTaskHash = (task: Partial<Task>) => {
    return objectHash({
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
                      description: msg.task.description,
                      details: msg.task.details,
                      date_created: msg.task.date_created,
                      action_date: msg.task.action_date,
                      status: msg.task.status,
                      processed: msg.task.processed,
                      archived: msg.task.archived,
                      person_id: mappedPerson.id, // Ensure it's assigned to the linked person
                      project_id: finalProjId,
                    });
                  } else {
                    // Create new task with defaults for local-only fields
                    const defaultUrgency = await db.urgencies.findOne().exec();
                    await db.tasks.insert({
                      id: msg.task.id,
                      type: "task",
                      description: msg.task.description!,
                      details: msg.task.details,
                      date_created: msg.task.date_created!,
                      action_date: msg.task.action_date,
                      status: msg.task.status as any,
                      processed: msg.task.processed!,
                      archived: msg.task.archived,
                      urgency_id: defaultUrgency?.id || "u_medium",
                      context_ids: [],
                      tag_ids: [],
                      person_id: mappedPerson.id,
                      project_id: finalProjId,
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

  // 2. Process outgoing changes (tasks and projects)
  useEffect(() => {
    if (!uid || !db) return;

    const sub = new Subscription();

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

            const msgRef = doc(collection(firestoreDb, `users/${person.linked_uid}/messages`));
            await setDoc(msgRef, {
              type: "task_delete",
              fromUid: uid,
              task: { id: taskData.id },
              timestamp: serverTimestamp()
            });
            return;
          }

          const newHash = getSharedTaskHash(taskData);
          
          if (lastProcessedTaskHash.current[taskData.id] === newHash) {
            return;
          }

          if (changeEvent.operation === "UPDATE" && previousData) {
            const oldHash = getSharedTaskHash(previousData);
            const personChanged = previousData.person_id !== taskData.person_id;
            if (oldHash === newHash && !personChanged) return;
          }

          lastProcessedTaskHash.current[taskData.id] = newHash;
          
          const msgRef = doc(collection(firestoreDb, `users/${person.linked_uid}/messages`));
          await setDoc(msgRef, {
            type: "task_upsert",
            fromUid: uid,
            task: {
              id: taskData.id,
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

          // ── Push notification logic ──
          const hasBeenNotified = notifiedTasksRef.current.has(taskData.id);
          const isPlaceholder = taskData.description === "New task" || !taskData.description.trim();

          if (!hasBeenNotified && !isPlaceholder) {
            let shouldNotify = false;

            if (changeEvent.operation === "INSERT") {
              shouldNotify = true;
            } else if (changeEvent.operation === "UPDATE" && previousData) {
              const wasPlaceholder = previousData.description === "New task" || !previousData.description.trim();
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
                  fetch("/api/notifications/push", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      subscriptions,
                      title: `New task added by ${senderName}`,
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

            const msgRef = doc(collection(firestoreDb, `users/${person.linked_uid}/messages`));
            await setDoc(msgRef, {
              type: "project_delete",
              fromUid: uid,
              project: { id: projectData.id },
              timestamp: serverTimestamp()
            });
            return;
          }

          const newHash = getSharedProjectHash(projectData);

          if (lastProcessedProjectHash.current[projectData.id] === newHash) {
            return;
          }

          if (changeEvent.operation === "UPDATE" && previousData) {
            const oldHash = getSharedProjectHash(previousData);
            if (oldHash === newHash) return;
          }

          lastProcessedProjectHash.current[projectData.id] = newHash;

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
            },
            timestamp: serverTimestamp()
          });

        } catch (err) {
          console.error("[Sync] Outgoing project sync error", err);
        }
      })
    );

    return () => sub.unsubscribe();
  }, [uid, db]);

  return <>{children}</>;
}
