"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteUserAccount = void 0;
const https_1 = require("firebase-functions/v2/https");
const firestore_1 = require("firebase-admin/firestore");
const storage_1 = require("firebase-admin/storage");
const auth_1 = require("firebase-admin/auth");
exports.deleteUserAccount = (0, https_1.onCall)(async (request) => {
    const uid = request.auth?.uid;
    if (!uid) {
        throw new https_1.HttpsError("unauthenticated", "User must be authenticated to delete their account.");
    }
    const db = (0, firestore_1.getFirestore)();
    const auth = (0, auth_1.getAuth)();
    const storage = (0, storage_1.getStorage)();
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
        }
        catch (e) {
            console.log("No storage files to delete, or bucket not configured:", e.message);
        }
        // 6. Delete Firebase Auth account
        await auth.deleteUser(uid);
        console.log(`Successfully deleted Firebase Auth user ${uid}`);
        return { success: true };
    }
    catch (error) {
        console.error(`Account deletion failed for ${uid}:`, error);
        throw new https_1.HttpsError("internal", `Account deletion failed: ${error.message}`);
    }
});
//# sourceMappingURL=deleteUserAccount.js.map