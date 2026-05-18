"use client";

import { createRxDatabase, addRxPlugin } from 'rxdb';
import { getRxStorageDexie } from 'rxdb/plugins/storage-dexie';
import { DatabaseCollections } from './schema';
import { RxDBQueryBuilderPlugin } from 'rxdb/plugins/query-builder';
import { RxDBUpdatePlugin } from 'rxdb/plugins/update';
import { RxDBMigrationSchemaPlugin } from 'rxdb/plugins/migration-schema';

// Add necessary plugins
addRxPlugin(RxDBQueryBuilderPlugin);
addRxPlugin(RxDBUpdatePlugin);
addRxPlugin(RxDBMigrationSchemaPlugin);

const dbCache: Record<string, Promise<RxDatabase>> = {};
const resolvedDbCache: Record<string, RxDatabase> = {};

export const getDatabaseSync = (userUid: string) => {
  return resolvedDbCache[`taskeragf_${userUid}`] || null;
};

export const getDatabase = async (userUid: string) => {
  const dbName = `taskeragf_${userUid}`;
  
  // Prevent multiple creations for the same user
  if (dbName in dbCache) return dbCache[dbName];

  const create = async () => {
    const db = await createRxDatabase({
      name: dbName,
      storage: getRxStorageDexie(),
      multiInstance: true,
      eventReduce: true,
    });

    // Add collections
    await db.addCollections({
      ...DatabaseCollections,
      tasks: {
        ...DatabaseCollections.tasks,
        migrationStrategies: {
          // 1: Migrate from version 0 to 1
          1: (oldDoc: any) => {
            oldDoc.status = oldDoc.status || "Open";
            oldDoc.processed = oldDoc.processed ?? true;
            return oldDoc;
          },
          // 2: Migrate from version 1 to 2
          2: (oldDoc: any) => {
            oldDoc.status = oldDoc.status || "Open";
            oldDoc.processed = oldDoc.processed ?? true;
            oldDoc.urgency_id = oldDoc.urgency_id || "u_medium";
            return oldDoc;
          },
          // 3: Migrate from version 2 to 3 (ensure details is not undefined for Firestore)
          3: (oldDoc: any) => {
            oldDoc.details = oldDoc.details ?? null;
            return oldDoc;
          },
          // 4: Migrate from version 3 to 4 (add google_event_id)
          4: (oldDoc: any) => {
            oldDoc.google_event_id = oldDoc.google_event_id ?? null;
            return oldDoc;
          }
        }
      },
      projects: {
        ...DatabaseCollections.projects,
        migrationStrategies: {
          // 1: Ensure details is not undefined for Firestore
          1: (oldDoc: any) => {
            oldDoc.details = oldDoc.details ?? null;
            return oldDoc;
          }
        }
      },
      saved_views: {
        ...DatabaseCollections.saved_views,
        migrationStrategies: {
          // 1: Add default icon and color
          1: (oldDoc: any) => {
            oldDoc.icon = oldDoc.icon || "LayoutList";
            oldDoc.color = oldDoc.color || "#78716c";
            return oldDoc;
          },
          // 2: Add order field
          2: (oldDoc: any) => {
            oldDoc.order = oldDoc.order ?? 0;
            return oldDoc;
          },
          // 3: Convert context_id to context_ids array
          3: (oldDoc: any) => {
            if (oldDoc.context_id) {
              oldDoc.context_ids = [oldDoc.context_id];
            } else {
              oldDoc.context_ids = [];
            }
            delete oldDoc.context_id;
            return oldDoc;
          }
        }
      }
    });
    
    // Seed system data if missing
    const [urgencyCount, projectCount, personCount, contextCount] = await Promise.all([
      db.urgencies.count().exec(),
      db.projects.count().exec(),
      db.persons.count().exec(),
      db.contexts.count().exec(),
    ]);

    const hasSeeded = typeof window !== 'undefined' ? localStorage.getItem('tasker_has_seeded') : 'true';
    const needsUrgencies = urgencyCount === 0;
    const needsInitialSeed = !hasSeeded && (projectCount === 0 || personCount === 0 || contextCount === 0);

    if (needsUrgencies || needsInitialSeed) {
      const mockData = await import('../mock-data');
      const seeds = [];
      
      if (needsUrgencies) seeds.push(db.urgencies.bulkInsert(mockData.urgencies));
      if (needsInitialSeed) {
        if (projectCount === 0) seeds.push(db.projects.bulkInsert(mockData.projects));
        if (personCount === 0) seeds.push(db.persons.bulkInsert(mockData.persons));
        if (contextCount === 0) seeds.push(db.contexts.bulkInsert(mockData.contexts));
        
        if (typeof window !== 'undefined') {
          localStorage.setItem('tasker_has_seeded', 'true');
        }
      }
      
      if (seeds.length > 0) {
        await Promise.all(seeds);
      }
    }
    
    resolvedDbCache[dbName] = db;
    return db;
  };

  dbCache[dbName] = create();
  return dbCache[dbName];
};
