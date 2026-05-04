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
  if (dbCache[dbName]) return dbCache[dbName];

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
            return oldDoc;
          }
        }
      }
    });
    
    // Seed system data (Urgencies) if missing
    const urgencyCount = await db.urgencies.count().exec();
    if (urgencyCount === 0) {
      const mockData = await import('../mock-data');
      await db.urgencies.bulkInsert(mockData.urgencies);
    }
    
    return db;
  };

  dbCache[dbName] = create();
  return dbCache[dbName];
};
