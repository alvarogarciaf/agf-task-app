import { initializeApp, getApps, cert, App } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';

const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'agf-task-manager';
const storageBucket = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET;

let app: App;

if (!getApps().length) {
  if (process.env.FIREBASE_ADMIN_SERVICE_ACCOUNT) {
    try {
      const serviceAccount = JSON.parse(
        Buffer.from(process.env.FIREBASE_ADMIN_SERVICE_ACCOUNT, 'base64').toString('utf-8')
      );
      app = initializeApp({
        credential: cert(serviceAccount),
        projectId: serviceAccount.project_id || projectId,
        storageBucket,
      });
    } catch (error) {
      console.error('Error parsing FIREBASE_ADMIN_SERVICE_ACCOUNT. Falling back to default credentials.', error);
      app = initializeApp({
        projectId,
        storageBucket,
      });
    }
  } else {
    app = initializeApp({
      projectId,
      storageBucket,
    });
  }
} else {
  app = getApps()[0];
}

export const adminAuth = getAuth(app);
export const adminDb = getFirestore(app);
export const adminStorage = getStorage(app);
