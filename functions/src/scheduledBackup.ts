import { onSchedule } from "firebase-functions/v2/scheduler";

export const scheduledBackup = onSchedule("every day 00:00", async (event) => {
  const projectId = process.env.GCLOUD_PROJECT || process.env.GCP_PROJECT;
  if (!projectId) {
    console.error("No project ID found. Cannot run backup.");
    return;
  }

  const firestore = await import("@google-cloud/firestore");
  const client = new firestore.v1.FirestoreAdminClient();
  const databaseName = client.databasePath(projectId, "(default)");
  
  // Format the backup folder name with a timestamp
  const bucketName = `${projectId}-firestore-backups`;
  const timestamp = new Date().toISOString();
  const outputUriPrefix = `gs://${bucketName}/${timestamp}`;

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
