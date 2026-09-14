import { NextRequest, NextResponse } from "next/server";
import { withAdminAuth } from "@/lib/admin-middleware";
import { adminDb } from "@/lib/firebase/admin";

export const PATCH = async (req: NextRequest, { params }: { params: Promise<{ uid: string }> }) => {
  return withAdminAuth(req, async () => {
    try {
      const { uid } = await params;
      const updates = await req.json();

      if (!updates.plan || !updates.status) {
        return NextResponse.json({ error: "Missing plan or status" }, { status: 400 });
      }

      const ref = adminDb.doc(`users/${uid}/subscription`);
      await ref.set({
        plan: updates.plan,
        status: updates.status,
      }, { merge: true });

      const updatedDoc = await ref.get();

      return NextResponse.json({ subscription: updatedDoc.data() });
    } catch (error: any) {
      console.error("[subscription update] Error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
  });
};
