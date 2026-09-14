import { NextRequest, NextResponse } from "next/server";
import { withAdminAuth } from "@/lib/admin-middleware";
import { adminStorage } from "@/lib/firebase/admin";

export const GET = async (req: NextRequest, { params }: { params: Promise<{ uid: string }> }) => {
  return withAdminAuth(req, async () => {
    try {
      const { uid } = await params;
      
      const bucket = adminStorage.bucket();
      const [files] = await bucket.getFiles({ prefix: `users/${uid}/` });
      
      let totalBytes = 0;
      files.forEach((file: any) => {
        const size = parseInt(file.metadata.size as string || "0", 10);
        totalBytes += size;
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
