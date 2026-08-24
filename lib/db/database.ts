"use client";

import { createRxDatabase, addRxPlugin, type RxDatabase } from 'rxdb';
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
          },
          // 5: Migrate from version 4 to 5 (unified object: add type + tag_ids)
          5: (oldDoc: any) => {
            oldDoc.type = oldDoc.type ?? 'task';
            oldDoc.tag_ids = oldDoc.tag_ids ?? [];
            return oldDoc;
          },
          // 6: Migrate from version 5 to 6 (add bookmarked)
          6: (oldDoc: any) => {
            oldDoc.bookmarked = oldDoc.bookmarked ?? false;
            return oldDoc;
          },
          // 7: Migrate from version 6 to 7 (add order)
          7: (oldDoc: any) => {
            oldDoc.order = oldDoc.order ?? 0;
            return oldDoc;
          },
          // 8: Migrate from version 7 to 8 (add is_list)
          8: (oldDoc: any) => {
            oldDoc.is_list = oldDoc.is_list ?? null;
            return oldDoc;
          },
          // 9: Migrate from version 8 to 9 (add list_items)
          9: (oldDoc: any) => {
            oldDoc.list_items = oldDoc.list_items ?? null;
            return oldDoc;
          },
          // 10: Migrate from version 9 to 10 (add list_categories)
          10: (oldDoc: any) => {
            oldDoc.list_categories = oldDoc.list_categories ?? null;
            return oldDoc;
          },
          // 11: Migrate from version 10 to 11 (add details to list_items)
          11: (oldDoc: any) => {
            if (oldDoc.list_items) {
              oldDoc.list_items = oldDoc.list_items.map((item: any) => ({
                ...item,
                details: item.details ?? null,
              }));
            }
            return oldDoc;
          },
          // 12: Migrate from version 11 to 12 (add icon to task/note)
          12: (oldDoc: any) => {
            oldDoc.icon = oldDoc.icon ?? null;
            return oldDoc;
          },
          // 13: Migrate from version 12 to 13 (add updated_at to task/note)
          13: (oldDoc: any) => {
            oldDoc.updated_at = oldDoc.updated_at ?? Date.now();
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
          },
          // 2: Add linked_person_id field
          2: (oldDoc: any) => {
            oldDoc.linked_person_id = oldDoc.linked_person_id ?? null;
            return oldDoc;
          },
          // 3: Add icon and color fields
          3: (oldDoc: any) => {
            oldDoc.icon = oldDoc.icon ?? null;
            oldDoc.color = oldDoc.color ?? null;
            return oldDoc;
          },
          // 4: Add order_dependent, order and background_image fields
          4: (oldDoc: any) => {
            oldDoc.order_dependent = oldDoc.order_dependent ?? false;
            oldDoc.order = oldDoc.order ?? 0;
            oldDoc.background_image = oldDoc.background_image ?? null;
            return oldDoc;
          },
          // 5: Migrate from version 4 to 5 (add updated_at)
          5: (oldDoc: any) => {
            oldDoc.updated_at = oldDoc.updated_at ?? Date.now();
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
          },
          // 4: Add default filter_mode
          4: (oldDoc: any) => {
            oldDoc.filter_mode = oldDoc.filter_mode || "and";
            return oldDoc;
          }
        }
      },
      persons: {
        ...DatabaseCollections.persons,
        migrationStrategies: {
          1: (oldDoc: any) => {
            oldDoc.linked_uid = oldDoc.linked_uid ?? null;
            oldDoc.pending_invite_email = oldDoc.pending_invite_email ?? null;
            return oldDoc;
          },
          2: (oldDoc: any) => {
            oldDoc.linked_email = oldDoc.linked_email ?? null;
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
