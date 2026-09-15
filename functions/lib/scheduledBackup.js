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
exports.scheduledBackup = void 0;
const scheduler_1 = require("firebase-functions/v2/scheduler");
const firestore = __importStar(require("@google-cloud/firestore"));
const client = new firestore.v1.FirestoreAdminClient();
// Change this to your Google Cloud Project ID and a bucket name you create for backups
const PROJECT_ID = process.env.GCLOUD_PROJECT || process.env.GCP_PROJECT;
const BUCKET_NAME = `${PROJECT_ID}-firestore-backups`;
exports.scheduledBackup = (0, scheduler_1.onSchedule)("every day 00:00", async (event) => {
    if (!PROJECT_ID) {
        console.error("No project ID found. Cannot run backup.");
        return;
    }
    const databaseName = client.databasePath(PROJECT_ID, "(default)");
    // Format the backup folder name with a timestamp
    const timestamp = new Date().toISOString();
    const outputUriPrefix = `gs://${BUCKET_NAME}/${timestamp}`;
    try {
        console.log(`Starting Firestore backup to ${outputUriPrefix}`);
        const [operation] = await client.exportDocuments({
            name: databaseName,
            outputUriPrefix,
            // Empty array means export all collections
            collectionIds: [],
        });
        console.log(`Backup operation started: ${operation.name}`);
        // Note: the operation is long-running and will complete asynchronously.
        // We just return success that it started.
    }
    catch (err) {
        console.error("Backup operation failed:", err);
        throw new Error("Export operation failed");
    }
});
//# sourceMappingURL=scheduledBackup.js.map