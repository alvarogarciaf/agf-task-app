import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  // Completely isolated health check — no firebase imports
  const diag: Record<string, any> = {
    ok: true,
    timestamp: new Date().toISOString(),
    node: process.version,
    env: {
      ADMIN_UID: process.env.ADMIN_UID ? "SET" : "MISSING",
      NEXT_PUBLIC_ADMIN_UID: process.env.NEXT_PUBLIC_ADMIN_UID ? "SET" : "MISSING",
      FIREBASE_ADMIN_SERVICE_ACCOUNT: process.env.FIREBASE_ADMIN_SERVICE_ACCOUNT
        ? `SET (${process.env.FIREBASE_ADMIN_SERVICE_ACCOUNT.length} chars)`
        : "MISSING",
      NEXT_PUBLIC_FIREBASE_PROJECT_ID: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "MISSING",
    },
  };

  // Try dynamic import of credentials.ts to see if it was replaced at build
  try {
    const creds = await import("@/lib/firebase/credentials");
    diag.credentialsModule = {
      serviceAccountJson: creds.serviceAccountJson
        ? `SET (${creds.serviceAccountJson.length} chars)`
        : "NULL",
    };
  } catch (e: any) {
    diag.credentialsModuleError = e.message;
  }

  // Try dynamic import of firebase-admin to see if it's available
  try {
    const fa = await import("firebase-admin/app");
    diag.firebaseAdminAvailable = true;
    diag.existingApps = fa.getApps().length;
  } catch (e: any) {
    diag.firebaseAdminError = e.message;
  }

  return NextResponse.json(diag);
}
