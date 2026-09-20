import { NextResponse } from "next/server";
import { listUsers } from "@/lib/firebase/admin-rest";
import { serviceAccountJson } from "@/lib/firebase/credentials";

export const dynamic = "force-dynamic";

export async function GET() {
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
    credentialsModule: {
      serviceAccountJson: serviceAccountJson
        ? `SET (${serviceAccountJson.length} chars)`
        : "NULL",
    },
  };

  // Test REST-based admin
  try {
    const users = await listUsers(1);
    diag.restAdminAuth = { success: true, userCount: users.users.length };
  } catch (e: any) {
    diag.restAdminAuth = { error: e.message };
  }

  return NextResponse.json(diag);
}
