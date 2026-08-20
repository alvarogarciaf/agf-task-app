import { replicateFirestore } from 'rxdb/plugins/replication-firestore';
import { firestoreDb } from '../firebase/config';
import { collection } from 'firebase/firestore';
import type { RxDatabase } from 'rxdb';

/**
 * Recursively cleans undefined values by converting them to null or valid defaults.
 * Firestore writeBatch.update() and set() throw fatal errors if ANY field is undefined.
 */
function cleanUndefined(obj: any): any {
  if (obj === undefined) return null;
  if (obj === null || typeof obj !== 'object') return obj;
  if (obj instanceof Date) return obj;
  if (Array.isArray(obj)) {
    return obj.map((item) => (item === undefined ? null : cleanUndefined(item)));
  }
  const result: Record<string, any> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value === undefined) {
      result[key] = null;
    } else if (value !== null && typeof value === 'object' && !Array.isArray(value) && !(value instanceof Date)) {
      result[key] = cleanUndefined(value);
    } else if (Array.isArray(value)) {
      result[key] = value.map((item) => (item === undefined ? null : cleanUndefined(item)));
    } else {
      result[key] = value;
    }
  }
  return result;
}

export function sanitizeDocForFirestore(collectionName: string, doc: any): any {
  if (!doc) return doc;
  const cleaned = cleanUndefined(doc);

  if (collectionName === 'tasks') {
    return {
      ...cleaned,
      type: cleaned.type ?? 'task',
      details: cleaned.details ?? null,
      show_on: cleaned.show_on ?? null,
      action_date: cleaned.action_date ?? null,
      project_id: cleaned.project_id ?? null,
      person_id: cleaned.person_id ?? null,
      context_ids: Array.isArray(cleaned.context_ids) ? cleaned.context_ids : [],
      tag_ids: Array.isArray(cleaned.tag_ids) ? cleaned.tag_ids : [],
      processed: cleaned.processed ?? false,
      status: cleaned.status ?? 'Open',
      archived: cleaned.archived ?? false,
      google_event_id: cleaned.google_event_id ?? null,
      bookmarked: cleaned.bookmarked ?? false,
      order: cleaned.order ?? 0,
    };
  }

  if (collectionName === 'projects') {
    return {
      ...cleaned,
      details: cleaned.details ?? null,
      linked_person_id: cleaned.linked_person_id ?? null,
      icon: cleaned.icon ?? null,
      color: cleaned.color ?? null,
      background_image: cleaned.background_image ?? null,
      order_dependent: cleaned.order_dependent ?? false,
      order: cleaned.order ?? 0,
      status: cleaned.status ?? 'Ongoing',
    };
  }

  if (collectionName === 'persons') {
    return {
      ...cleaned,
      linked_uid: cleaned.linked_uid ?? null,
      linked_email: cleaned.linked_email ?? null,
      pending_invite_email: cleaned.pending_invite_email ?? null,
    };
  }

  if (collectionName === 'saved_views') {
    return {
      ...cleaned,
      context_ids: Array.isArray(cleaned.context_ids) ? cleaned.context_ids : [],
      project_id: cleaned.project_id ?? null,
      person_id: cleaned.person_id ?? null,
      show_status: cleaned.show_status ?? 'all',
      is_grouped_by_project: cleaned.is_grouped_by_project ?? false,
      show_hidden_by_show_on: cleaned.show_hidden_by_show_on ?? false,
      sort_key: cleaned.sort_key ?? 'date_created',
      sort_direction: cleaned.sort_direction ?? 'desc',
      filter_mode: cleaned.filter_mode ?? 'and',
      order: cleaned.order ?? 0,
    };
  }

  return cleaned;
}

export function sanitizeDocFromFirestore(collectionName: string, doc: any): any {
  if (!doc) return doc;
  const cleaned = cleanUndefined(doc);

  if (collectionName === 'tasks') {
    return {
      ...cleaned,
      type: cleaned.type ?? 'task',
      details: cleaned.details ?? null,
      show_on: cleaned.show_on ?? null,
      action_date: cleaned.action_date ?? null,
      project_id: cleaned.project_id ?? null,
      person_id: cleaned.person_id ?? null,
      context_ids: Array.isArray(cleaned.context_ids) ? cleaned.context_ids : [],
      tag_ids: Array.isArray(cleaned.tag_ids) ? cleaned.tag_ids : [],
      processed: cleaned.processed ?? false,
      status: cleaned.status ?? 'Open',
      archived: cleaned.archived ?? false,
      google_event_id: cleaned.google_event_id ?? null,
      bookmarked: cleaned.bookmarked ?? false,
      order: cleaned.order ?? 0,
    };
  }

  if (collectionName === 'projects') {
    return {
      ...cleaned,
      details: cleaned.details ?? null,
      linked_person_id: cleaned.linked_person_id ?? null,
      icon: cleaned.icon ?? null,
      color: cleaned.color ?? null,
      background_image: cleaned.background_image ?? null,
      order_dependent: cleaned.order_dependent ?? false,
      order: cleaned.order ?? 0,
      status: cleaned.status ?? 'Ongoing',
    };
  }

  if (collectionName === 'persons') {
    return {
      ...cleaned,
      linked_uid: cleaned.linked_uid ?? null,
      linked_email: cleaned.linked_email ?? null,
      pending_invite_email: cleaned.pending_invite_email ?? null,
    };
  }

  if (collectionName === 'saved_views') {
    return {
      ...cleaned,
      context_ids: Array.isArray(cleaned.context_ids) ? cleaned.context_ids : [],
      project_id: cleaned.project_id ?? null,
      person_id: cleaned.person_id ?? null,
      show_status: cleaned.show_status ?? 'all',
      is_grouped_by_project: cleaned.is_grouped_by_project ?? false,
      show_hidden_by_show_on: cleaned.show_hidden_by_show_on ?? false,
      sort_key: cleaned.sort_key ?? 'date_created',
      sort_direction: cleaned.sort_direction ?? 'desc',
      filter_mode: cleaned.filter_mode ?? 'and',
      order: cleaned.order ?? 0,
    };
  }

  return cleaned;
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
        modifier: (doc: any) => sanitizeDocFromFirestore(collectionName, doc),
      },
      push: {
        modifier: (doc: any) => sanitizeDocForFirestore(collectionName, doc),
      },
      live: true,
    });
  });
};
