import { NextResponse } from "next/server";
import { verifyIdToken, listUsers } from "@/lib/firebase/admin-rest";

export const dynamic = "force-dynamic";

export async function GET() {
  const result: Record<string, any> = {
    timestamp: new Date().toISOString(),
    node: process.version,
    adminUid: process.env.ADMIN_UID || process.env.NEXT_PUBLIC_ADMIN_UID || null,
    hasServiceAccountEnv: !!process.env.FIREBASE_ADMIN_SERVICE_ACCOUNT,
  };

  try {
    const users = await listUsers(1);
    result.listUsersSuccess = true;
    result.sampleUserCount = users.users.length;
  } catch (e: any) {
    result.listUsersError = { message: e.message };
  }

  return NextResponse.json(result);
}
