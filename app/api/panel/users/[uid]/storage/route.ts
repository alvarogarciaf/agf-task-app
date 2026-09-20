import { NextRequest, NextResponse } from "next/server";
import { withAdminAuth } from "@/lib/admin-middleware";
import { storageListFiles } from "@/lib/firebase/admin-rest";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const GET = async (req: NextRequest, { params }: { params: Promise<{ uid: string }> }) => {
  return withAdminAuth(req, async () => {
    try {
      const { uid } = await params;
      
      const files = await storageListFiles(`users/${uid}/`);
      
      let totalBytes = 0;
      files.forEach((file) => {
        totalBytes += file.size;
      });

      const totalMB = totalBytes / (1024 * 1024);

      return NextResponse.json({ 
        totalBytes, 
        totalMB: Number(totalMB.toFixed(2)), 
        fileCount: files.length 
      });
    } catch (error: any) {
      console.error("[storage detail] Error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
  });
};
