import { NextResponse } from "next/server";
import { getAdminApp, adminAuth, adminDb } from "@/lib/firebase/admin";

export const dynamic = "force-dynamic";

export async function GET() {
  const result: any = {
    timestamp: new Date().toISOString(),
    node: process.version,
    adminUid: process.env.ADMIN_UID || process.env.NEXT_PUBLIC_ADMIN_UID || null,
    hasServiceAccountEnv: !!process.env.FIREBASE_ADMIN_SERVICE_ACCOUNT,
  };

  try {
    const app = getAdminApp();
    result.appName = app.name;
    result.projectId = app.options.projectId;
  } catch (e: any) {
    result.appError = { message: e.message, stack: e.stack };
  }

  try {
    const users = await adminAuth.listUsers(1);
    result.listUsersSuccess = true;
    result.sampleUserCount = users.users.length;
  } catch (e: any) {
    result.listUsersError = { message: e.message, code: e.code };
  }

  return NextResponse.json(result);
}
