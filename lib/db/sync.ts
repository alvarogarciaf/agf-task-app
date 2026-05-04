import { replicateFirestore } from 'rxdb/plugins/replication-firestore';
import { firestoreDb } from '../firebase/config';
import { collection } from 'firebase/firestore';
import type { RxDatabase } from 'rxdb';

export const setupReplication = (db: RxDatabase, userUid: string) => {
  if (typeof window === 'undefined') return []; // Only replicate on client

  const syncCollections = ['tasks', 'projects', 'persons', 'contexts'];

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
      pull: {},
      push: {},
      live: true,
    });
  });
};
