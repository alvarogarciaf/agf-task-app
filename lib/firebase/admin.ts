import "server-only";
import { initializeApp, getApps, cert, App } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';

const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'agf-task-manager';
const storageBucket = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || 'agf-task-manager.firebasestorage.app';

function resolveServiceAccount(): any | null {
  // 1. Check for build-time bundled service-account.json
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const bundled = require('./service-account.json');
    if (bundled && bundled.project_id && bundled.private_key) {
      return bundled;
    }
  } catch {
    // Bundled file not present; proceed to env checks
  }

  // 2. Check process.env.FIREBASE_ADMIN_SERVICE_ACCOUNT
  const raw = process.env.FIREBASE_ADMIN_SERVICE_ACCOUNT;
  if (raw) {
    let str = raw.trim();
    if ((str.startsWith('"') && str.endsWith('"')) || (str.startsWith("'") && str.endsWith("'"))) {
      str = str.slice(1, -1).trim();
    }

    // Try parsing as raw JSON
    try {
      const parsed = JSON.parse(str);
      if (parsed && parsed.project_id && parsed.private_key) {
        return parsed;
      }
    } catch {}

    // Try parsing as Base64 encoded JSON
    try {
      const decoded = Buffer.from(str, 'base64').toString('utf-8');
      const parsed = JSON.parse(decoded);
      if (parsed && parsed.project_id && parsed.private_key) {
        return parsed;
      }
    } catch {}
  }

  return null;
}

let app: App;

if (!getApps().length) {
  const serviceAccount = resolveServiceAccount();
  if (serviceAccount) {
    app = initializeApp({
      credential: cert(serviceAccount),
      projectId: serviceAccount.project_id || projectId,
      storageBucket,
    });
  } else {
    console.warn('[FirebaseAdmin] No service account found. Initializing with default credentials.');
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

