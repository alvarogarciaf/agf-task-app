import { NextRequest, NextResponse } from "next/server";
import { withAdminAuth } from "@/lib/admin-middleware";
import { firestoreSet, firestoreGet } from "@/lib/firebase/admin-rest";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const PATCH = async (req: NextRequest, { params }: { params: Promise<{ uid: string }> }) => {
  return withAdminAuth(req, async () => {
    try {
      const { uid } = await params;
      const updates = await req.json();

      if (!updates.plan || !updates.status) {
        return NextResponse.json({ error: "Missing plan or status" }, { status: 400 });
      }

      const docPath = `users/${uid}/settings/subscription`;
      
      // Read existing, merge, and write back
      const existing = await firestoreGet(docPath).catch(() => null);
      const merged = {
        ...(existing?.exists ? existing.data() : {}),
        plan: updates.plan,
        status: updates.status,
      };
      await firestoreSet(docPath, merged);

      const updatedDoc = await firestoreGet(docPath);

      return NextResponse.json({ subscription: updatedDoc.data() });
    } catch (error: any) {
      console.error("[subscription update] Error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
  });
};
