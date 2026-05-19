"use client";

import { useEffect, useRef, ReactNode } from "react";
import { collection, query, onSnapshot, doc, deleteDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { firestoreDb } from "@/lib/firebase/config";
import { useDatabase } from "@/components/db-provider";
import { useAuth } from "@/components/auth-provider";
import type { Task } from "@/lib/types";
import { Subscription } from "rxjs";
import objectHash from "object-hash";

export interface SyncMessage {
  id: string;
  type: "task_upsert" | "task_delete" | "invite" | "invite_accepted";
  fromUid: string;
  fromEmail?: string;
  task?: Partial<Task>;
  timestamp?: any;
}

export function MessageSyncProvider({ children }: { children: ReactNode }) {
  const db = useDatabase();
  const { user } = useAuth();
  const uid = user?.uid;
  const lastProcessedTaskHash = useRef<Record<string, string>>({});

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
    });
  };

  // 1. Process incoming messages
  useEffect(() => {
    if (!uid || !db) return;

    const messagesRef = collection(firestoreDb, `users/${uid}/messages`);
    const q = query(messagesRef);

    const unsubscribe = onSnapshot(q, async (snapshot) => {
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
                  });
                } else {
                  // Create new task with defaults for local-only fields
                  const defaultUrgency = await db.urgencies.findOne().exec();
                  await db.tasks.insert({
                    id: msg.task.id,
                    description: msg.task.description!,
                    details: msg.task.details,
                    date_created: msg.task.date_created!,
                    action_date: msg.task.action_date,
                    status: msg.task.status as any,
                    processed: msg.task.processed!,
                    archived: msg.task.archived,
                    urgency_id: defaultUrgency?.id || "u_medium",
                    context_ids: [],
                    person_id: mappedPerson.id,
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
    });

    return () => unsubscribe();
  }, [uid, db]);

  // 2. Process outgoing task changes
  useEffect(() => {
    if (!uid || !db) return;

    const sub = new Subscription();

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
            },
            timestamp: serverTimestamp()
          });

        } catch (err) {
          console.error("[Sync] Outgoing sync error", err);
        }
      })
    );

    return () => sub.unsubscribe();
  }, [uid, db]);

  return <>{children}</>;
}
