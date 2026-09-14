import { NextRequest, NextResponse } from "next/server";
import { adminAuth } from "@/lib/firebase/admin";

export interface AdminContext {
  uid: string;
  email?: string;
}

export async function withAdminAuth(
  request: NextRequest,
  handler: (request: NextRequest, context: AdminContext, params?: any) => Promise<NextResponse> | NextResponse,
  params?: any
): Promise<NextResponse> {
  try {
    const authHeader = request.headers.get("authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Missing or invalid authorization header" }, { status: 401 });
    }

    const idToken = authHeader.split("Bearer ")[1];
    const decodedToken = await adminAuth.verifyIdToken(idToken);

    const adminUid = process.env.ADMIN_UID;
    if (!adminUid) {
      console.error("ADMIN_UID environment variable is not set.");
      return NextResponse.json({ error: "Server configuration error" }, { status: 500 });
    }

    if (decodedToken.uid !== adminUid) {
      return NextResponse.json({ error: "Forbidden: Admin access required" }, { status: 403 });
    }

    return handler(request, { uid: decodedToken.uid, email: decodedToken.email }, params);
  } catch (error: any) {
    console.error("[AdminAuth] Error verifying token:", error);
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}
