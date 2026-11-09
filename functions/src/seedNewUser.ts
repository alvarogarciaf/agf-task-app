import * as functions from "firebase-functions/v1";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import {
  SEED_URGENCIES,
  SEED_CONTEXTS,
  SEED_PROJECTS,
  SEED_TAGS,
  buildSeedTasks,
} from "./seed-data";

/**
 * Converts a seed record with an `id` into the Firestore document payload
 * expected by `rxdb/plugins/replication-firestore`:
 *  - `id` is stripped from the payload (stored as the Firestore doc ID)
 *  - `_deleted: false` is required by RxDB replication
 *  - `serverTimestamp: FieldValue.serverTimestamp()` is required so the client's
 *    checkpoint query (`orderBy('serverTimestamp')`) pulls the document
 */
function toRxFirestoreDoc<T extends { id: string }>(
  item: T,
  extra?: Record<string, unknown>
): { id: string; data: Record<string, unknown> } {
  const { id, ...rest } = item;
  return {
    id,
    data: {
      ...rest,
      ...extra,
      _deleted: false,
      serverTimestamp: FieldValue.serverTimestamp(),
    },
  };
}

export const seedNewUser = functions.auth.user().onCreate(async (user) => {
  const uid = user.uid;
  const db = getFirestore();
  const onboardingRef = db.doc(`users/${uid}/settings/onboarding`);

  // Idempotency guard: if already seeded (e.g. function retry), do nothing
  const existing = await onboardingRef.get();
  if (existing.exists && existing.data()?.seededAt) {
    console.log(`[seedNewUser] User ${uid} already seeded; skipping.`);
    return;
  }

  const nowMs = Date.now();
  const nowIso = new Date(nowMs).toISOString();
  const batch = db.batch();

  for (const urgency of SEED_URGENCIES) {
    const { id, data } = toRxFirestoreDoc(urgency);
    batch.set(db.doc(`users/${uid}/urgencies/${id}`), data, { merge: true });
  }

  for (const ctx of SEED_CONTEXTS) {
    const { id, data } = toRxFirestoreDoc(ctx);
    batch.set(db.doc(`users/${uid}/contexts/${id}`), data, { merge: true });
  }

  for (const project of SEED_PROJECTS) {
    const { id, data } = toRxFirestoreDoc(project, { updated_at: nowMs });
    batch.set(db.doc(`users/${uid}/projects/${id}`), data, { merge: true });
  }

  for (const tag of SEED_TAGS) {
    const { id, data } = toRxFirestoreDoc(tag);
    batch.set(db.doc(`users/${uid}/tags/${id}`), data, { merge: true });
  }

  for (const task of buildSeedTasks(nowIso)) {
    const { id, data } = toRxFirestoreDoc(task, { updated_at: nowMs });
    batch.set(db.doc(`users/${uid}/tasks/${id}`), data, { merge: true });
  }

  batch.set(
    onboardingRef,
    {
      seededAt: nowMs,
      tutorial: {
        status: "pending",
        version: 1,
      },
    },
    { merge: true }
  );

  await batch.commit();
  console.log(`[seedNewUser] Seeded starter data and onboarding state for ${uid}`);
});
