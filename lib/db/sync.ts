import { replicateFirestore } from 'rxdb/plugins/replication-firestore';
import { firestoreDb } from '../firebase/config';
import { collection } from 'firebase/firestore';
import type { RxDatabase } from 'rxdb';

/**
 * Recursively replaces `undefined` values with `null` in a document.
 * Firestore writeBatch.update() and set() throw fatal errors if ANY field is undefined.
 * 
 * IMPORTANT: This function must NOT add new fields or change existing values.
 * It should ONLY convert undefined → null. Adding defaults for missing fields
 * causes RxDB replication conflicts: the pushed doc ends up different from the
 * local doc, so when it's pulled back, RxDB treats it as a "remote change"
 * and reverts the local state.
 */
function cleanUndefinedValues(obj: any): any {
  if (obj === undefined) return null;
  if (obj === null || typeof obj !== 'object') return obj;
  if (obj instanceof Date) return obj;
  if (Array.isArray(obj)) {
    return obj.map((item) => cleanUndefinedValues(item));
  }
  const result: Record<string, any> = {};
  for (const [key, value] of Object.entries(obj)) {
    result[key] = cleanUndefinedValues(value);
  }
  return result;
}

export const setupReplication = (db: RxDatabase, userUid: string) => {
  if (typeof window === 'undefined') return []; // Only replicate on client

  const syncCollections = ['tasks', 'projects', 'persons', 'contexts', 'tags', 'urgencies', 'saved_views'];

  return syncCollections.map((collectionName) => {
    // Isolate by user path: users/{uid}/{collection}
    const firestoreCollection = collection(firestoreDb, 'users', userUid, collectionName);
    
    return replicateFirestore({
      replicationIdentifier: `firestore-sync-${userUid}-${collectionName}`,
      collection: db[collectionName],
      firestore: {
        projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID!,
        database: firestoreDb,
        collection: firestoreCollection
      },
      pull: {
        modifier: (doc: any) => cleanUndefinedValues(doc),
      },
      push: {
        modifier: (doc: any) => cleanUndefinedValues(doc),
      },
      live: true,
    });
  });
};
