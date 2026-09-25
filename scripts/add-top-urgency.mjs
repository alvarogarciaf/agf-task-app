import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';
import { config } from 'dotenv';
import { readFileSync } from 'fs';
import { resolve } from 'path';

// Load .env.local
config({ path: resolve(process.cwd(), '.env.local') });

function getServiceAccount() {
  const raw = process.env.FIREBASE_ADMIN_SERVICE_ACCOUNT;
  if (!raw) throw new Error("Missing FIREBASE_ADMIN_SERVICE_ACCOUNT in .env.local");
  return JSON.parse(Buffer.from(raw, 'base64').toString('utf-8'));
}

initializeApp({
  credential: cert(getServiceAccount()),
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID
});

const db = getFirestore();
const auth = getAuth();

async function run() {
  console.log("Starting urgency update...");
  
  // 1. Get all users from Auth
  const listUsersResult = await auth.listUsers(1000);
  const users = listUsersResult.users;
  console.log(`Found ${users.length} users in Auth.`);

  for (const userRecord of users) {
    const uid = userRecord.uid;
    const urgenciesRef = db.collection(`users/${uid}/urgencies`);
    
    // Get existing urgencies
    const uSnap = await urgenciesRef.get();
    
    if (uSnap.empty) {
      console.log(`Skipping user ${uid} (no urgencies found).`);
      continue;
    }

    const batch = db.batch();

    // The desired standard order
    const standardUrgencies = {
      "u_top":     { name: "TOP",     color: "oklch(0.5 0.25 10)",  order: 0 },
      "u_highest": { name: "Highest", color: "oklch(0.6 0.25 25)",  order: 1 },
      "u_high":    { name: "High",    color: "oklch(0.65 0.2 40)",  order: 2 },
      "u_medium":  { name: "Medium",  color: "oklch(0.7 0.15 250)", order: 3 },
      "u_low":     { name: "Low",     color: "oklch(0.8 0 0)",      order: 4 },
    };

    let hasTop = false;

    for (const doc of uSnap.docs) {
      const data = doc.data();
      if (doc.id === "u_top") {
        hasTop = true;
      }
      
      // Update order if it's one of the standard ones
      if (standardUrgencies[doc.id] && data.order !== standardUrgencies[doc.id].order) {
        batch.update(doc.ref, { order: standardUrgencies[doc.id].order, updated_at: Date.now() });
      }
    }

    if (!hasTop) {
      batch.set(urgenciesRef.doc("u_top"), {
        ...standardUrgencies["u_top"],
        updated_at: Date.now()
      });
      console.log(`Adding u_top to user ${uid}`);
    } else {
      console.log(`User ${uid} already has u_top.`);
    }

    await batch.commit();
    console.log(`Committed updates for user ${uid}.`);
  }
  
  console.log("Done updating urgencies.");
}

run().catch(console.error);
