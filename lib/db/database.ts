"use client";

import { createRxDatabase, addRxPlugin } from 'rxdb';
import { getRxStorageDexie } from 'rxdb/plugins/storage-dexie';
import { DatabaseCollections } from './schema';
import { RxDBQueryBuilderPlugin } from 'rxdb/plugins/query-builder';
import { RxDBUpdatePlugin } from 'rxdb/plugins/update';

// Add necessary plugins
addRxPlugin(RxDBQueryBuilderPlugin);
addRxPlugin(RxDBUpdatePlugin);

let dbPromise: any = null;

export const getDatabase = async () => {
  // Prevent multiple creations in React strict mode / HMR
  if (dbPromise) return dbPromise;

  const create = async () => {
    const db = await createRxDatabase({
      name: 'taskmanagerdb_v2',
      storage: getRxStorageDexie(),
      multiInstance: true,
      eventReduce: true,
    });

    // Add collections
    await db.addCollections(DatabaseCollections);
    
    // Seed initial data if the database is completely empty
    const tasksCount = await db.tasks.count().exec();
    if (tasksCount === 0) {
      const mockData = await import('../mock-data');
      await db.urgencies.bulkInsert(mockData.urgencies);
      await db.contexts.bulkInsert(mockData.contexts);
      await db.persons.bulkInsert(mockData.persons);
      await db.projects.bulkInsert(mockData.projects);
      await db.tasks.bulkInsert(mockData.tasks);
    }
    
    return db;
  };

  dbPromise = create();
  return dbPromise;
};
