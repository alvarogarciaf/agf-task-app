import { onSchedule } from "firebase-functions/v2/scheduler";
import * as firestore from "@google-cloud/firestore";

const client = new firestore.v1.FirestoreAdminClient();

// Change this to your Google Cloud Project ID and a bucket name you create for backups
const PROJECT_ID = process.env.GCLOUD_PROJECT || process.env.GCP_PROJECT;
const BUCKET_NAME = `${PROJECT_ID}-firestore-backups`;

export const scheduledBackup = onSchedule("every day 00:00", async (event) => {
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
  } catch (err) {
    console.error("Backup operation failed:", err);
    throw new Error("Export operation failed");
  }
});
