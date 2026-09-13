import { onCall, HttpsError } from "firebase-functions/v2/https";
import { getFirestore } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";
import { getAuth } from "firebase-admin/auth";

export const deleteUserAccount = onCall(async (request) => {
  const uid = request.auth?.uid;
  if (!uid) {
    throw new HttpsError("unauthenticated", "User must be authenticated to delete their account.");
  }

  const db = getFirestore();
  const auth = getAuth();
  const storage = getStorage();

  console.log(`Starting account deletion for uid: ${uid}`);

  try {
    // 1. Delete all subcollections under /users/{uid}
    const subcollections = [
      "tasks", "projects", "persons", "contexts", "tags",
      "urgencies", "saved_views", "push_subscriptions", "messages"
    ];
    
    for (const sub of subcollections) {
      const snap = await db.collection(`users/${uid}/${sub}`).get();
      if (!snap.empty) {
        const batch = db.batch();
        snap.docs.forEach((doc) => batch.delete(doc.ref));
        await batch.commit();
        console.log(`Deleted ${snap.size} documents in subcollection: ${sub}`);
      }
    }

    // 2. Delete settings documents
    const settingsSnap = await db.collection(`users/${uid}/settings`).get();
    if (!settingsSnap.empty) {
      const settingsBatch = db.batch();
      settingsSnap.docs.forEach((doc) => settingsBatch.delete(doc.ref));
      await settingsBatch.commit();
      console.log(`Deleted ${settingsSnap.size} documents in settings`);
    }

    // 3. Delete user root document (if it exists)
    await db.doc(`users/${uid}`).delete();

    // 4. Delete directory entry by scanning
    const dirSnap = await db.collection("directory_by_email").where("uid", "==", uid).get();
    if (!dirSnap.empty) {
      const dirBatch = db.batch();
      dirSnap.docs.forEach((doc) => dirBatch.delete(doc.ref));
      await dirBatch.commit();
      console.log(`Deleted ${dirSnap.size} directory entries`);
    }

    // 5. Delete Firebase Storage files under users/{uid}/
    try {
      const bucket = storage.bucket();
      await bucket.deleteFiles({ prefix: `users/${uid}/` });
      console.log("Deleted storage files");
    } catch (e: any) {
      console.log("No storage files to delete, or bucket not configured:", e.message);
    }

    // 6. Delete Firebase Auth account
    await auth.deleteUser(uid);
    console.log(`Successfully deleted Firebase Auth user ${uid}`);

    return { success: true };
  } catch (error: any) {
    console.error(`Account deletion failed for ${uid}:`, error);
    throw new HttpsError("internal", `Account deletion failed: ${error.message}`);
  }
});
