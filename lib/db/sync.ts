import { replicateFirestore } from 'rxdb/plugins/replication-firestore';
import { firestoreDb } from '../firebase/config';
import { collection } from 'firebase/firestore';
import type { RxDatabase } from 'rxdb';

export const setupReplication = (db: RxDatabase) => {
  if (typeof window === 'undefined') return; // Only replicate on client

  const syncCollections = ['tasks', 'projects', 'persons', 'contexts'];

  syncCollections.forEach((collectionName) => {
    const firestoreCollection = collection(firestoreDb, collectionName);
    
    replicateFirestore({
      replicationIdentifier: `firestore-sync-${collectionName}`,
      collection: db[collectionName],
      firestore: {
        projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID!,
        database: firestoreDb,
        collection: firestoreCollection
      },
      pull: {},
      push: {},
      live: true,
      // We don't use auto-retry if we want to handle offline nicely,
      // but RxDB handles offline by default when live: true.
    });
  });
};
