"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.seedNewUser = void 0;
const functions = __importStar(require("firebase-functions/v1"));
const firestore_1 = require("firebase-admin/firestore");
const seed_data_1 = require("./seed-data");
/**
 * Converts a seed record with an `id` into the Firestore document payload
 * expected by `rxdb/plugins/replication-firestore`:
 *  - `id` is stripped from the payload (stored as the Firestore doc ID)
 *  - `_deleted: false` is required by RxDB replication
 *  - `serverTimestamp: FieldValue.serverTimestamp()` is required so the client's
 *    checkpoint query (`orderBy('serverTimestamp')`) pulls the document
 */
function toRxFirestoreDoc(item, extra) {
    const { id, ...rest } = item;
    return {
        id,
        data: {
            ...rest,
            ...extra,
            _deleted: false,
            serverTimestamp: firestore_1.FieldValue.serverTimestamp(),
        },
    };
}
exports.seedNewUser = functions.auth.user().onCreate(async (user) => {
    const uid = user.uid;
    const db = (0, firestore_1.getFirestore)();
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
    for (const urgency of seed_data_1.SEED_URGENCIES) {
        const { id, data } = toRxFirestoreDoc(urgency);
        batch.set(db.doc(`users/${uid}/urgencies/${id}`), data, { merge: true });
    }
    for (const ctx of seed_data_1.SEED_CONTEXTS) {
        const { id, data } = toRxFirestoreDoc(ctx);
        batch.set(db.doc(`users/${uid}/contexts/${id}`), data, { merge: true });
    }
    for (const project of seed_data_1.SEED_PROJECTS) {
        const { id, data } = toRxFirestoreDoc(project, { updated_at: nowMs });
        batch.set(db.doc(`users/${uid}/projects/${id}`), data, { merge: true });
    }
    for (const tag of seed_data_1.SEED_TAGS) {
        const { id, data } = toRxFirestoreDoc(tag);
        batch.set(db.doc(`users/${uid}/tags/${id}`), data, { merge: true });
    }
    for (const task of (0, seed_data_1.buildSeedTasks)(nowIso)) {
        const { id, data } = toRxFirestoreDoc(task, { updated_at: nowMs });
        batch.set(db.doc(`users/${uid}/tasks/${id}`), data, { merge: true });
    }
    batch.set(onboardingRef, {
        seededAt: nowMs,
        tutorial: {
            status: "pending",
            version: 1,
        },
    }, { merge: true });
    await batch.commit();
    console.log(`[seedNewUser] Seeded starter data and onboarding state for ${uid}`);
});
//# sourceMappingURL=seedNewUser.js.map