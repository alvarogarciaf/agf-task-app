import "server-only";
import { initializeApp, getApps, cert, App } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';
import { serviceAccountJson } from './credentials';

const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'agf-task-manager';
const storageBucket = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || 'agf-task-manager.firebasestorage.app';

function resolveServiceAccount(): any | null {
  const raw = serviceAccountJson || process.env.FIREBASE_ADMIN_SERVICE_ACCOUNT;
  if (!raw) return null;

  let str = raw.trim();
  if ((str.startsWith('"') && str.endsWith('"')) || (str.startsWith("'") && str.endsWith("'"))) {
    str = str.slice(1, -1).trim();
  }

  // Try parsing as raw JSON
  try {
    const parsed = JSON.parse(str);
    if (parsed && (parsed.project_id || parsed.projectId) && (parsed.private_key || parsed.privateKey)) {
      return parsed;
    }
  } catch {}

  // Try parsing as Base64 encoded JSON
  try {
    const decoded = Buffer.from(str, 'base64').toString('utf-8');
    const parsed = JSON.parse(decoded);
    if (parsed && (parsed.project_id || parsed.projectId) && (parsed.private_key || parsed.privateKey)) {
      return parsed;
    }
  } catch {}

  return null;
}

let _app: App | null = null;

export function getAdminApp(): App {
  if (_app) return _app;

  const existingApps = getApps();
  if (existingApps.length > 0) {
    _app = existingApps[0];
    return _app;
  }

  const serviceAccount = resolveServiceAccount();
  if (serviceAccount) {
    _app = initializeApp({
      credential: cert(serviceAccount),
      projectId: serviceAccount.project_id || serviceAccount.projectId || projectId,
      storageBucket,
    });
  } else {
    console.warn('[FirebaseAdmin] No service account found. Initializing with default project ID.');
    _app = initializeApp({
      projectId,
      storageBucket,
    });
  }
  return _app;
}

export const adminAuth = new Proxy({} as ReturnType<typeof getAuth>, {
  get(_target, prop) {
    const instance = getAuth(getAdminApp()) as any;
    const val = instance[prop];
    return typeof val === 'function' ? val.bind(instance) : val;
  }
});

export const adminDb = new Proxy({} as ReturnType<typeof getFirestore>, {
  get(_target, prop) {
    const instance = getFirestore(getAdminApp()) as any;
    const val = instance[prop];
    return typeof val === 'function' ? val.bind(instance) : val;
  }
});

export const adminStorage = new Proxy({} as ReturnType<typeof getStorage>, {
  get(_target, prop) {
    const instance = getStorage(getAdminApp()) as any;
    const val = instance[prop];
    return typeof val === 'function' ? val.bind(instance) : val;
  }
});


