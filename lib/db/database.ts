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

const dbCache: Record<string, Promise<any>> = {};

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
      }
    });
    
    // Seed system data if missing
    const mockData = await import('../mock-data');
    
    const [urgencyCount, projectCount, personCount, contextCount] = await Promise.all([
      db.urgencies.count().exec(),
      db.projects.count().exec(),
      db.persons.count().exec(),
      db.contexts.count().exec(),
    ]);

    const seeds = [];
    
    // Urgencies are system data, seed if empty
    if (urgencyCount === 0) seeds.push(db.urgencies.bulkInsert(mockData.urgencies));

    // For projects, persons, and contexts, only seed if it's the FIRST time on this browser
    // to avoid cluttering existing accounts on new devices.
    const hasSeeded = typeof window !== 'undefined' ? localStorage.getItem('tasker_has_seeded') : 'true';
    
    if (!hasSeeded) {
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
    
    return db;
  };

  dbCache[dbName] = create();
  return dbCache[dbName];
};
